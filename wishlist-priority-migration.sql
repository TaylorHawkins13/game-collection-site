-- Gift list ranking — see ROADMAP.md "Gift list items have no
-- priority/ranking" and CHANGELOG.md. Adds a simple 1/2/3
-- (High/Medium/Low) priority field, settable only on wishlist rows
-- (components/GameModal.jsx), so app/u/[username]/wishlist can sort
-- "get this one first" items to the top instead of showing every item
-- with equal weight. New projects get this automatically from
-- supabase-schema.sql — this is the standalone version for a project set
-- up before this column existed.

alter table public.games
  add column if not exists wishlist_priority smallint check (wishlist_priority in (1, 2, 3));
