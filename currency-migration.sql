-- ============================================================
-- Shelf Life — Currency support migration
-- Run this ONCE in your Supabase project's SQL editor if your
-- project was set up before currency selection existed.
-- (Brand new projects can skip this — supabase-schema.sql
-- already includes it.)
--
-- Additive only: adds one column with a safe default, no
-- existing data is touched.
-- ============================================================

alter table profiles
  add column if not exists currency text not null default 'USD';
