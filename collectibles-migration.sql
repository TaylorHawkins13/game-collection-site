-- ============================================================
-- Collectibles expansion migration
-- Run this once in your Supabase project's SQL editor
-- (Project → SQL Editor → New query → paste → Run)
-- Adds: Trading Cards, Vinyl Records, and Media (Books/DVDs/CDs)
-- alongside the existing Games and Comics.
-- Safe to run on an existing project — purely additive.
-- ============================================================

-- New shared columns. A few new item types reuse existing columns
-- (artist/publisher/writer/grade/is_variant/variant_notes already had
-- the right shape), these are the only genuinely new ones needed:
alter table games add column if not exists format text default '';        -- e.g. "LP", "Hardcover", "Blu-ray"
alter table games add column if not exists edition text default '';       -- e.g. "1st pressing", "Director's Cut"
alter table games add column if not exists card_set text default '';      -- trading card set/expansion
alter table games add column if not exists card_number text default '';  -- trading card number within the set
alter table games add column if not exists player_name text default '';  -- trading card player/character name
alter table games add column if not exists media_kind text default '';   -- for item_type = 'media': 'book' | 'dvd' | 'cd'

-- Widen the item_type check constraint to allow the new types. Finds
-- and drops whatever the existing check constraint on this column is
-- actually named (rather than guessing), so this works regardless of
-- how it got created, then adds the wider one back.
do $$
declare
  r record;
begin
  for r in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_attribute att on att.attrelid = rel.oid and att.attnum = any(con.conkey)
    where rel.relname = 'games'
      and con.contype = 'c'
      and att.attname = 'item_type'
  loop
    execute format('alter table games drop constraint %I', r.conname);
  end loop;
end $$;

alter table games add constraint games_item_type_check
  check (item_type in ('game', 'comic', 'trading_card', 'vinyl', 'media'));
