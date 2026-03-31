-- Add Facebook as a supported social platform

-- Drop and recreate check constraints to include 'facebook'
ALTER TABLE public.oauth_states DROP CONSTRAINT IF EXISTS oauth_states_platform_check;
ALTER TABLE public.oauth_states ADD CONSTRAINT oauth_states_platform_check
  CHECK (platform IN ('twitter', 'instagram', 'tiktok', 'facebook'));

ALTER TABLE public.social_accounts DROP CONSTRAINT IF EXISTS social_accounts_platform_check;
ALTER TABLE public.social_accounts ADD CONSTRAINT social_accounts_platform_check
  CHECK (platform IN ('twitter', 'instagram', 'tiktok', 'facebook'));
