-- ============================================================
-- Context Attachments: file uploads linked to context files
-- ============================================================

create table public.context_attachments (
  id uuid primary key default gen_random_uuid(),
  context_file_id uuid references public.context_files(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  file_type text not null,
  file_size integer not null,
  storage_path text not null,
  public_url text not null,
  extracted_text text,
  created_at timestamptz not null default now()
);

alter table public.context_attachments enable row level security;

create policy "Users can CRUD own context attachments"
  on public.context_attachments for all
  using (auth.uid() = user_id);
