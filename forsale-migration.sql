-- "For sale" flag on owned items — see ROADMAP.md "'For sale' flag on
-- owned items, shown on your profile" and CHANGELOG.md. Adds a lightweight
-- toggle + asking price, settable only on owned rows (components/
-- GameModal.jsx), shown as a badge on the card wherever it renders,
-- including the public profile. New projects get this automatically from
-- supabase-schema.sql — this is the standalone version for a project set
-- up before these columns existed.

alter table public.games
  add column if not exists for_sale boolean not null default false,
  add column if not exists asking_price numeric;
