-- ============================================================
-- 00008_screenshots_features.sql
-- Adds:
--   * project_screenshots table for storing captured website previews
--   * 'features' file_type to context_files
-- ============================================================

-- 1. Project screenshots table
create table if not exists public.project_screenshots (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  viewport text not null check (viewport in ('desktop', 'mobile')),
  storage_path text not null,
  public_url text not null,
  width integer not null,
  height integer not null,
  captured_at timestamptz not null default now(),
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_project_screenshots_project
  on public.project_screenshots(project_id);

alter table public.project_screenshots enable row level security;

create policy "Users can manage own project screenshots"
  on public.project_screenshots for all
  using (auth.uid() = user_id);

-- 2. Expand context_files file_type to include 'features'
alter table public.context_files drop constraint context_files_file_type_check;
alter table public.context_files add constraint context_files_file_type_check
  check (file_type in (
    'brand', 'product', 'audience', 'competitors',
    'intake', 'character_brief', 'visual_style',
    'sop', 'storytelling', 'features'
  ));
