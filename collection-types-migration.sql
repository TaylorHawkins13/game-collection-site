-- "What do you collect?" preferences — see ROADMAP.md/CHANGELOG.md and
-- components/CollectingPrompt.jsx. Requested directly: a new signup (or
-- an existing account that hasn't answered yet) is asked which of the 10
-- item types they actually collect, and everything else hides from the
-- Add Item type list, Quick add (search)'s item type picker, and the
-- dashboard Filters "type" dropdown — reachable again anytime afterward
-- from Settings > Collecting. Defaults to every type enabled, so an
-- existing account sees zero behavior change until it (or its owner)
-- actually goes through the prompt or narrows things down by hand. New
-- projects get this automatically from supabase-schema.sql — this is the
-- standalone version for a project set up before these columns existed.

alter table public.profiles
  add column if not exists enabled_item_types text[] not null default array[
    'game', 'comic', 'trading_card', 'vinyl', 'book', 'dvd', 'vhs', 'cd', 'console', 'funko_pop'
  ]::text[],
  add column if not exists types_onboarded_at timestamptz;
