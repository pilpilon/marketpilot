-- ============================================================
-- MarketPilot Core Schema
-- Profiles, Projects, Context Files, Campaigns, Campaign Assets
-- ============================================================

-- Enable required extensions
create extension if not exists "uuid-ossp";

-- ============================================================
-- PROFILES (extends auth.users)
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  plan text not null default 'free' check (plan in ('free', 'starter', 'pro')),
  paddle_customer_id text,
  paddle_subscription_id text,
  usage_credits_remaining integer not null default 50,
  locale text not null default 'en' check (locale in ('en', 'he')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- PROJECTS
-- ============================================================
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  url text,
  repo_url text,
  logo_url text,
  status text not null default 'setup' check (status in ('setup', 'active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, slug)
);

alter table public.projects enable row level security;

create policy "Users can CRUD own projects"
  on public.projects for all
  using (auth.uid() = user_id);

-- ============================================================
-- CONTEXT FILES (marketing docs per project)
-- ============================================================
create table public.context_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  file_type text not null check (file_type in (
    'brand', 'product', 'audience', 'competitors',
    'intake', 'character_brief', 'visual_style'
  )),
  content text not null default '',
  version integer not null default 1,
  source text not null default 'manual' check (source in ('auto', 'manual', 'refined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.context_files enable row level security;

create policy "Users can CRUD own context files"
  on public.context_files for all
  using (auth.uid() = user_id);

-- ============================================================
-- CAMPAIGNS
-- ============================================================
create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  campaign_type text not null check (campaign_type in (
    'social_media', 'video_ad', 'email', 'content_marketing'
  )),
  platforms text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'active', 'completed', 'archived')),
  goal text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.campaigns enable row level security;

create policy "Users can CRUD own campaigns"
  on public.campaigns for all
  using (auth.uid() = user_id);

-- ============================================================
-- CAMPAIGN ASSETS
-- ============================================================
create table public.campaign_assets (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  asset_type text not null check (asset_type in (
    'post_draft', 'image', 'video_script', 'scene_json',
    'content_calendar', 'strategy_doc'
  )),
  title text,
  content text,
  storage_path text,
  metadata jsonb not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'approved', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.campaign_assets enable row level security;

create policy "Users can CRUD own campaign assets"
  on public.campaign_assets for all
  using (auth.uid() = user_id);

-- ============================================================
-- ANALYSIS RUNS (tracks AI usage)
-- ============================================================
create table public.analysis_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  run_type text not null,
  provider text not null check (provider in ('claude', 'perplexity', 'gemini')),
  tokens_used integer not null default 0,
  credits_consumed integer not null default 0,
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  error_message text,
  metadata jsonb not null default '{}',
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.analysis_runs enable row level security;

create policy "Users can view own analysis runs"
  on public.analysis_runs for select
  using (auth.uid() = user_id);

create policy "Users can insert own analysis runs"
  on public.analysis_runs for insert
  with check (auth.uid() = user_id);

-- ============================================================
-- TEMPLATES (system + user-created)
-- ============================================================
create table public.templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade, -- null = system template
  name text not null,
  template_type text not null,
  content text not null,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.templates enable row level security;

create policy "Users can view system templates and own templates"
  on public.templates for select
  using (is_system = true or auth.uid() = user_id);

create policy "Users can CRUD own templates"
  on public.templates for all
  using (auth.uid() = user_id);

-- ============================================================
-- Updated_at trigger function
-- ============================================================
create or replace function public.update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Apply updated_at triggers
create trigger set_updated_at before update on public.profiles
  for each row execute function public.update_updated_at();
create trigger set_updated_at before update on public.projects
  for each row execute function public.update_updated_at();
create trigger set_updated_at before update on public.context_files
  for each row execute function public.update_updated_at();
create trigger set_updated_at before update on public.campaigns
  for each row execute function public.update_updated_at();
create trigger set_updated_at before update on public.campaign_assets
  for each row execute function public.update_updated_at();
create trigger set_updated_at before update on public.templates
  for each row execute function public.update_updated_at();
