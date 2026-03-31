-- ============================================================
-- BRAND URLS: multi-source URL support for brand intelligence
-- ============================================================
-- Allows users to provide multiple brand source URLs (Facebook,
-- Instagram, LinkedIn, etc.) alongside the primary website URL.

alter table public.projects
  add column brand_urls jsonb not null default '[]'::jsonb;

comment on column public.projects.brand_urls is
  'Array of { url, type, label? } for social profiles and other brand sources';
