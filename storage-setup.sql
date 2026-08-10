-- ============================================================
-- Shelf Life — Avatar upload storage setup
-- Run this ONCE in your Supabase project's SQL editor.
-- Creates a public "avatars" bucket and locks down uploads so
-- each user can only write inside their own folder
-- (path pattern: avatars/<user_id>/avatar.<ext>).
-- ============================================================

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- No SELECT policy needed here on purpose: the bucket itself is public
-- (public = true above), so avatar images are already servable by their
-- direct URL (getPublicUrl(), used by the app) without RLS getting
-- involved at all. A broad `using (bucket_id = 'avatars')` SELECT
-- policy doesn't add anything for that — it only grants clients the
-- ability to LIST/query every row in storage.objects for this bucket
-- (filenames, upload times, sizes), which is more than the app needs
-- and is exactly what Supabase's Security Advisor flags as "broad
-- SELECT policy... allowing clients to list all files."

-- Users can only upload into a folder named after their own user id
create policy "Users can upload their own avatar"
on storage.objects for insert
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- Users can overwrite/replace their own avatar
create policy "Users can update their own avatar"
on storage.objects for update
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- Users can delete their own avatar
create policy "Users can delete their own avatar"
on storage.objects for delete
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- ============================================================
-- Condition-photos bucket (folded in here so a fresh install gets
-- both buckets from this one file — see item-photos-storage-migration.sql
-- for the standalone version used when updating an existing project)
-- ============================================================

insert into storage.buckets (id, name, public)
values ('item-photos', 'item-photos', true)
on conflict (id) do nothing;

create policy "Users can upload their own item photos"
on storage.objects for insert
with check (
  bucket_id = 'item-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users can update their own item photos"
on storage.objects for update
using (
  bucket_id = 'item-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users can delete their own item photos"
on storage.objects for delete
using (
  bucket_id = 'item-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
