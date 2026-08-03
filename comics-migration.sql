-- ============================================================
-- Shelf Life — Comics support migration
-- Run this ONCE in your Supabase project's SQL editor if your
-- project was set up before comics support existed.
-- (Brand new projects can skip this — supabase-schema.sql
-- already includes these columns.)
--
-- This is additive only: it adds new columns with safe defaults
-- and does not touch or remove any existing data.
-- ============================================================

alter table games
  add column if not exists item_type text not null default 'game'
    check (item_type in ('game', 'comic'));

alter table games
  add column if not exists series text default '';

alter table games
  add column if not exists issue_number text default '';

alter table games
  add column if not exists publisher text default '';

alter table games
  add column if not exists writer text default '';

alter table games
  add column if not exists artist text default '';

alter table games
  add column if not exists grade text default '';

alter table games
  add column if not exists is_variant boolean not null default false;

alter table games
  add column if not exists variant_notes text default '';

create index if not exists games_item_type_idx on games (item_type);
