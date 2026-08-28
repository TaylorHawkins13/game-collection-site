-- Pokémon master-set variant cache — see ROADMAP.md "Pokémon master sets:
-- show variants you don't own yet" and CHANGELOG.md. Backs a new
-- background cron (app/api/cron/refresh-master-sets) that pre-fetches
-- real per-card TCGdex variant data for any Pokémon set someone here has
-- logged a trading card from, so "See master set" can show every real
-- print variant for every card, not just ones you've already logged a
-- copy of — see lib/tcgdexSetLookup.js's module comment for the full
-- reasoning. New projects get this automatically from
-- supabase-schema.sql — this is the standalone version for a project set
-- up before this table existed.

create table if not exists master_set_cache (
  set_id text primary key,
  set_name text not null,
  entries jsonb not null,
  refreshed_at timestamptz not null default now()
);

alter table master_set_cache enable row level security;
revoke all on master_set_cache from anon, authenticated;
