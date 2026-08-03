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

-- Anyone can view avatar images (they're profile pictures, not sensitive)
create policy "Avatar images are publicly readable"
on storage.objects for select
using (bucket_id = 'avatars');

-- Users can only upload into a folder named after their own user id
create policy "Users can upload their own avatar"
on storage.objects for insert
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can overwrite/replace their own avatar
create policy "Users can update their own avatar"
on storage.objects for update
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can delete their own avatar
create policy "Users can delete their own avatar"
on storage.objects for delete
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);
