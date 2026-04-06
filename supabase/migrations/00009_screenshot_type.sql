-- ============================================================
-- 00009_screenshot_type.sql
-- Adds screenshot_type column to distinguish auto-captured
-- landing pages from user-uploaded product interface screenshots.
-- ============================================================

ALTER TABLE public.project_screenshots
  ADD COLUMN IF NOT EXISTS screenshot_type text NOT NULL DEFAULT 'landing'
  CHECK (screenshot_type IN ('landing', 'product'));
