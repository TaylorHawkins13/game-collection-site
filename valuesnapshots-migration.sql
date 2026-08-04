-- Run this in Supabase SQL Editor if you already have an existing project
-- (brand new projects can skip this — supabase-schema.sql already includes it).
-- Adds the value_snapshots table behind the "collection value over time" chart.

create table if not exists value_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  total_value numeric not null,
  item_count int not null,
  taken_at timestamptz not null default now()
);

create index if not exists value_snapshots_user_id_idx on value_snapshots (user_id, taken_at);

alter table value_snapshots enable row level security;

drop policy if exists "Owners can read their own value snapshots" on value_snapshots;
create policy "Owners can read their own value snapshots"
  on value_snapshots for select
  using (user_id = auth.uid());

drop policy if exists "Owners can insert their own value snapshots" on value_snapshots;
create policy "Owners can insert their own value snapshots"
  on value_snapshots for insert
  with check (user_id = auth.uid());
