-- ============================================================
-- 00007_video_creator.sql
-- Adds support for the Video Creator skill:
--   * New asset_type 'video' on campaign_assets
--   * Reuses existing public.pipeline_jobs table with job_type='video_creator'
--   * Registers a pg_cron job that hits /api/cron/process-video-jobs
--     every minute (same pattern as publish-scheduled-posts)
-- ============================================================

-- 1. Allow 'video' as a campaign_assets.asset_type
alter table public.campaign_assets
  drop constraint if exists campaign_assets_asset_type_check;

alter table public.campaign_assets
  add constraint campaign_assets_asset_type_check
  check (asset_type in (
    'post_draft',
    'image',
    'video_script',
    'video',
    'scene_json',
    'content_calendar',
    'strategy_doc',
    'template_render'
  ));

-- 2. Add 'composing' to pipeline_jobs.status for video render jobs
alter table public.pipeline_jobs drop constraint if exists pipeline_jobs_status_check;
alter table public.pipeline_jobs add constraint pipeline_jobs_status_check
  check (status in (
    'pending', 'planning', 'generating', 'scheduling',
    'composing', 'completed', 'failed'
  ));

-- 3. Helpful index for worker queries
create index if not exists idx_pipeline_jobs_video_active
  on public.pipeline_jobs (job_type, status, updated_at)
  where job_type = 'video_creator'
    and status in ('pending', 'planning', 'generating', 'composing');

-- 3. Storage bucket for generated videos (public-read, service-role write)
insert into storage.buckets (id, name, public)
values ('generated-videos', 'generated-videos', true)
on conflict (id) do nothing;

-- 4. Storage bucket for background music tracks (public-read)
insert into storage.buckets (id, name, public)
values ('music-library', 'music-library', true)
on conflict (id) do nothing;

-- ============================================================
-- pg_cron job: process-video-jobs
-- NOTE: Requires pg_cron + pg_net extensions enabled on Supabase.
-- Run these once via the Supabase SQL editor if not already:
--   create extension if not exists pg_cron;
--   create extension if not exists pg_net;
--
-- The app URL and cron secret are baked into the schedule command.
-- Update them here if deployment changes.
-- ============================================================

-- Unschedule previous version (idempotent)
do $$
begin
  if exists (select 1 from cron.job where jobname = 'process-video-jobs') then
    perform cron.unschedule('process-video-jobs');
  end if;
exception
  when undefined_table then
    -- pg_cron not installed in this environment; skip silently
    null;
end $$;

-- Schedule every minute
do $$
begin
  perform cron.schedule(
    'process-video-jobs',
    '* * * * *',
    $job$
    select net.http_get(
      url := 'https://marketpilot-one.vercel.app/api/cron/process-video-jobs',
      headers := jsonb_build_object(
        'Authorization', 'Bearer marketpilot-cron-secret-2024'
      )
    );
    $job$
  );
exception
  when undefined_table then
    null;
  when undefined_function then
    null;
end $$;
