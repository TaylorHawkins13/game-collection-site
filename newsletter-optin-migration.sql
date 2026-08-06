-- ============================================================
-- Shelf Life — Newsletter opt-in column
-- Run this ONCE in your Supabase project's SQL editor (or skip
-- it if starting from a fresh project — supabase-schema.sql
-- already includes this).
-- ============================================================

alter table public.profiles
  add column if not exists newsletter_opt_in boolean not null default false;
