-- ============================================================
-- Shelf Life — Condition photos column
-- Run this ONCE in your Supabase project's SQL editor (or skip
-- it if starting from a fresh project — supabase-schema.sql
-- already includes this). Also run item-photos-storage-migration.sql
-- (or storage-setup.sql on a fresh project) — without it, uploading a
-- photo fails with a "bucket not found" error, same as avatars.
-- ============================================================

alter table public.games
  add column if not exists condition_photos text[] not null default '{}'::text[];
