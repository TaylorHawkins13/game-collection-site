-- Adds the "Activity feed" feature: a log of when someone adds, completes,
-- or rates an item, shown to the people who follow them on the new /feed
-- page. Same privacy rule as everything else — only visible if the actor's
-- profile is public (or you're looking at your own).
create table if not exists activity_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  game_id uuid references games(id) on delete cascade,
  event_type text not null check (event_type in ('added', 'completed', 'rated')),
  created_at timestamptz not null default now()
);

create index if not exists activity_events_user_id_idx on activity_events (user_id, created_at desc);
create index if not exists activity_events_created_at_idx on activity_events (created_at desc);

alter table activity_events enable row level security;

create policy "Activity readable if profile is public or owner"
  on activity_events for select
  using (
    user_id = auth.uid()
    or exists (select 1 from profiles p where p.id = activity_events.user_id and p.is_public = true)
  );

create policy "Owners can insert their own activity"
  on activity_events for insert
  with check (user_id = auth.uid());
