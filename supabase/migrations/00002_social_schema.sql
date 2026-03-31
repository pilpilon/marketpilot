-- ============================================================
-- MarketPilot Social Publishing Schema
-- Social Accounts, Posts, Post Platforms, Media, Auto-Reply
-- ============================================================

-- Enable vault extension for encrypted token storage
create extension if not exists "supabase_vault";

-- ============================================================
-- OAUTH STATES (CSRF protection during OAuth flow)
-- ============================================================
create table public.oauth_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('twitter', 'instagram', 'tiktok')),
  state_token text not null unique,
  code_verifier text,
  redirect_url text,
  project_id uuid not null references public.projects(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.oauth_states enable row level security;

create policy "Users can CRUD own oauth states"
  on public.oauth_states for all
  using (auth.uid() = user_id);

-- Auto-cleanup expired states (run via pg_cron or app-level cron)
create index idx_oauth_states_expires on public.oauth_states (expires_at);

-- ============================================================
-- SOCIAL ACCOUNTS (connected platform credentials)
-- ============================================================
create table public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  platform text not null check (platform in ('twitter', 'instagram', 'tiktok')),
  platform_user_id text not null,
  platform_username text,
  platform_display_name text,
  platform_avatar_url text,
  -- Token storage: vault secret UUIDs (tokens encrypted at rest)
  access_token_secret_id uuid,
  refresh_token_secret_id uuid,
  token_expires_at timestamptz,
  scopes text[] not null default '{}',
  status text not null default 'active'
    check (status in ('active', 'expired', 'revoked', 'error')),
  last_token_refresh_at timestamptz,
  connected_at timestamptz not null default now(),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, platform, platform_user_id)
);

alter table public.social_accounts enable row level security;

create policy "Users can CRUD own social accounts"
  on public.social_accounts for all
  using (auth.uid() = user_id);

create index idx_social_accounts_project on public.social_accounts (project_id, platform);
create index idx_social_accounts_token_expiry on public.social_accounts (token_expires_at)
  where status = 'active';

-- ============================================================
-- POSTS (central post entity)
-- ============================================================
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  campaign_asset_id uuid references public.campaign_assets(id) on delete set null,
  status text not null default 'draft'
    check (status in ('draft', 'scheduled', 'publishing', 'published', 'failed', 'cancelled')),
  scheduled_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.posts enable row level security;

create policy "Users can CRUD own posts"
  on public.posts for all
  using (auth.uid() = user_id);

-- Critical index for the scheduling cron
create index idx_posts_scheduled
  on public.posts (scheduled_at)
  where status = 'scheduled' and scheduled_at is not null;

create index idx_posts_project on public.posts (project_id, status);

-- ============================================================
-- POST PLATFORMS (per-platform content & status)
-- ============================================================
create table public.post_platforms (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  social_account_id uuid not null references public.social_accounts(id) on delete cascade,
  platform text not null check (platform in ('twitter', 'instagram', 'tiktok')),
  caption text,
  hashtags text[] not null default '{}',
  media_urls text[] not null default '{}',
  -- Returned by platform after publish
  platform_post_id text,
  platform_post_url text,
  -- Instagram-specific: container processing
  platform_creation_id text,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'publishing', 'published', 'failed')),
  error_message text,
  published_at timestamptz,
  engagement_data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.post_platforms enable row level security;

-- Policy joins through posts table to verify ownership
create policy "Users can CRUD own post platforms"
  on public.post_platforms for all
  using (
    exists (
      select 1 from public.posts
      where posts.id = post_platforms.post_id
        and posts.user_id = auth.uid()
    )
  );

create index idx_post_platforms_post on public.post_platforms (post_id);

-- ============================================================
-- POST MEDIA (media attachments with ImageKit transforms)
-- ============================================================
create table public.post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  storage_path text not null,
  imagekit_file_id text,
  original_filename text,
  media_type text not null check (media_type in ('image', 'video', 'gif')),
  mime_type text,
  transforms jsonb not null default '{}',
  width integer,
  height integer,
  file_size_bytes bigint,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.post_media enable row level security;

create policy "Users can CRUD own post media"
  on public.post_media for all
  using (
    exists (
      select 1 from public.posts
      where posts.id = post_media.post_id
        and posts.user_id = auth.uid()
    )
  );

create index idx_post_media_post on public.post_media (post_id);

-- ============================================================
-- AUTO REPLY RULES
-- ============================================================
create table public.auto_reply_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  social_account_id uuid not null references public.social_accounts(id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  rule_type text not null check (rule_type in ('keyword_match', 'ai_generated')),
  -- For keyword_match rules
  trigger_keywords text[] not null default '{}',
  reply_template text,
  -- For ai_generated rules
  ai_prompt text,
  ai_tone text not null default 'professional'
    check (ai_tone in ('professional', 'friendly', 'casual', 'formal')),
  require_approval boolean not null default true,
  max_replies_per_hour integer not null default 10,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.auto_reply_rules enable row level security;

create policy "Users can CRUD own auto reply rules"
  on public.auto_reply_rules for all
  using (auth.uid() = user_id);

create index idx_auto_reply_rules_account
  on public.auto_reply_rules (social_account_id)
  where is_active = true;

-- ============================================================
-- AUTO REPLY LOG (history & approval queue)
-- ============================================================
create table public.auto_reply_log (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references public.auto_reply_rules(id) on delete cascade,
  social_account_id uuid not null references public.social_accounts(id) on delete cascade,
  platform text not null check (platform in ('twitter', 'instagram', 'tiktok')),
  original_comment_id text not null,
  original_comment_text text,
  original_author text,
  original_post_platform_id uuid references public.post_platforms(id) on delete set null,
  generated_reply text not null,
  status text not null default 'pending_approval'
    check (status in ('pending_approval', 'approved', 'sent', 'rejected', 'failed')),
  error_message text,
  approved_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.auto_reply_log enable row level security;

-- Policy joins through rules to verify ownership
create policy "Users can view own auto reply logs"
  on public.auto_reply_log for select
  using (
    exists (
      select 1 from public.auto_reply_rules
      where auto_reply_rules.id = auto_reply_log.rule_id
        and auto_reply_rules.user_id = auth.uid()
    )
  );

create policy "Users can update own auto reply logs"
  on public.auto_reply_log for update
  using (
    exists (
      select 1 from public.auto_reply_rules
      where auto_reply_rules.id = auto_reply_log.rule_id
        and auto_reply_rules.user_id = auth.uid()
    )
  );

create index idx_auto_reply_log_pending
  on public.auto_reply_log (created_at)
  where status = 'pending_approval';

create index idx_auto_reply_log_rule on public.auto_reply_log (rule_id);

-- ============================================================
-- Apply updated_at triggers to social tables
-- ============================================================
create trigger set_updated_at before update on public.social_accounts
  for each row execute function public.update_updated_at();
create trigger set_updated_at before update on public.posts
  for each row execute function public.update_updated_at();
create trigger set_updated_at before update on public.post_platforms
  for each row execute function public.update_updated_at();
create trigger set_updated_at before update on public.auto_reply_rules
  for each row execute function public.update_updated_at();
