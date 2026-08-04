-- ============================================================
-- Collectibles expansion migration
-- Run this once in your Supabase project's SQL editor
-- (Project → SQL Editor → New query → paste → Run)
-- Adds: Trading Cards, Vinyl Records, Books, DVDs, and CDs
-- alongside the existing Games and Comics.
-- Safe to run on an existing project, and safe to re-run — purely
-- additive plus a one-time data fixup (see below).
-- ============================================================

-- New shared columns. A few new item types reuse existing columns
-- (artist/publisher/writer/grade/is_variant/variant_notes already had
-- the right shape), these are the only genuinely new ones needed:
alter table games add column if not exists format text default '';        -- e.g. "LP", "Hardcover", "Blu-ray"
alter table games add column if not exists edition text default '';       -- e.g. "1st pressing", "Director's Cut"
alter table games add column if not exists card_set text default '';      -- trading card set/expansion
alter table games add column if not exists card_number text default '';  -- trading card number within the set
alter table games add column if not exists player_name text default '';  -- trading card player/character name

-- If you ran an earlier version of this migration, it briefly had a
-- single combined "media" type (Books/DVDs/CDs together) with a
-- media_kind column to tell them apart. Books, DVDs, and CDs are now
-- fully separate types instead, matching how Trading Cards and Vinyl
-- work. This converts any existing "media" rows over automatically —
-- safe to run whether or not you ever had that column.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'games' and column_name = 'media_kind'
  ) then
    update games set item_type = case
      when media_kind = 'dvd' then 'dvd'
      when media_kind = 'cd' then 'cd'
      else 'book'
    end
    where item_type = 'media';
  else
    update games set item_type = 'book' where item_type = 'media';
  end if;
end $$;

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
  check (item_type in ('game', 'comic', 'trading_card', 'vinyl', 'book', 'dvd', 'cd'));
