-- ============================================================
-- Add settings to projects + SOP file type support
-- ============================================================

-- Add settings JSONB column to projects for locale/market config
alter table public.projects
  add column if not exists settings jsonb not null default '{}'::jsonb;

-- Expand context_files file_type to include 'sop' and 'storytelling'
alter table public.context_files drop constraint context_files_file_type_check;
alter table public.context_files add constraint context_files_file_type_check
  check (file_type in (
    'brand', 'product', 'audience', 'competitors',
    'intake', 'character_brief', 'visual_style',
    'sop', 'storytelling'
  ));
