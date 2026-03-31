-- Content Templates & Carousel Support
-- Adds visual content template definitions and carousel grouping for campaign assets.

-- ─── Content Templates Table ─────────────────────────────────────────────────

create table if not exists public.content_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  description text,
  category text not null check (category in (
    'promotional', 'educational', 'quote', 'product_showcase',
    'testimonial', 'announcement', 'behind_the_scenes', 'event',
    'question_poll', 'statistic', 'listicle', 'comparison', 'ugc', 'story_cover'
  )),
  format text not null default 'single' check (format in ('single', 'carousel', 'story')),
  thumbnail_url text,
  platforms text[] not null default '{}',
  slides jsonb not null default '[]',
  default_overlay_style text not null default 'centered',
  brand_tokens jsonb not null default '{"useBrandColors": true, "useBrandFonts": true, "useLogoWatermark": false}',
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS
alter table public.content_templates enable row level security;

-- Anyone can read system templates; users can read their own custom templates
create policy "content_templates_select" on public.content_templates
  for select using (is_system = true or auth.uid() = user_id);

-- Users can insert/update/delete only their own custom templates
create policy "content_templates_insert" on public.content_templates
  for insert with check (auth.uid() = user_id and is_system = false);

create policy "content_templates_update" on public.content_templates
  for update using (auth.uid() = user_id and is_system = false);

create policy "content_templates_delete" on public.content_templates
  for delete using (auth.uid() = user_id and is_system = false);

-- ─── Carousel Support on Campaign Assets ─────────────────────────────────────

alter table public.campaign_assets
  add column if not exists carousel_group_id uuid,
  add column if not exists slide_order integer not null default 0;

-- Index for fetching carousel slides together
create index if not exists idx_campaign_assets_carousel
  on public.campaign_assets(carousel_group_id) where carousel_group_id is not null;
