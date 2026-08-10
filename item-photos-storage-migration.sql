-- ============================================================
-- Shelf Life — Condition-photos storage bucket
-- Run this ONCE in your Supabase project's SQL editor (or skip
-- it if starting from a fresh project — storage-setup.sql
-- already includes this).
-- Creates a public "item-photos" bucket, folder-scoped by user id
-- and item id (path pattern: item-photos/<user_id>/<game_id>/<uuid>.<ext>),
-- same access pattern as the avatars bucket.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('item-photos', 'item-photos', true)
on conflict (id) do nothing;

-- Bucket is public — no SELECT policy needed, same reasoning as avatars
-- (see storage-setup.sql).

create policy "Users can upload their own item photos"
  on storage.objects for insert
  with check (bucket_id = 'item-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users can update their own item photos"
  on storage.objects for update
  using (bucket_id = 'item-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users can delete their own item photos"
  on storage.objects for delete
  using (bucket_id = 'item-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
