-- ============================================================
-- 00010_post_media_bucket.sql
-- Creates the 'post-media' storage bucket for user-uploaded
-- media files (images/videos) in the Compose editor.
-- ============================================================

-- 1. Create the post-media bucket (public read)
insert into storage.buckets (id, name, public)
values ('post-media', 'post-media', true)
on conflict (id) do nothing;

-- 2. RLS: users can upload/update/delete only their own files
create policy "Users can upload own post media"
  on storage.objects for insert
  with check (
    bucket_id = 'post-media'
    and auth.uid() = (storage.foldername(name))[1]::uuid
  );

create policy " Users can update own post media"
  on storage.objects for update
  using (
    bucket_id = 'post-media'
    and auth.uid() = (storage.foldername(name))[1]::uuid
  );

create policy "Users can delete own post media"
  on storage.objects for delete
  using (
    bucket_id = 'post-media'
    and auth.uid() = (storage.foldername(name))[1]::uuid
  );

-- 3. Public read (bucket is public, but explicit policy for clarity)
create policy "Public can read post media"
  on storage.objects for select
  using (bucket_id = 'post-media');
