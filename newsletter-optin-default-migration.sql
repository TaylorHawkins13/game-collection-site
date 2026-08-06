-- ============================================================
-- Shelf Life — Newsletter opt-in: default flipped to true for new accounts
-- Run this ONCE in your Supabase project's SQL editor (or skip it if
-- starting from a fresh project — supabase-schema.sql already includes
-- this default).
--
-- This only changes what a *brand-new* signup starts with. It does NOT
-- touch any existing row — nobody's actual preference gets silently
-- flipped by running this. If you want to see who's currently opted in
-- either way, `select newsletter_opt_in, count(*) from profiles group by
-- 1;` before running this shows the current split.
-- ============================================================

alter table public.profiles
  alter column newsletter_opt_in set default true;
