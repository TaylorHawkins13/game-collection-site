-- Reactions on feed activity_events entries. One reaction per user per
-- event (a plain "like", not a picker of different emoji — kept simple).
create table if not exists activity_reactions (
  event_id uuid not null references activity_events(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create index if not exists activity_reactions_event_id_idx on activity_reactions (event_id);

alter table activity_reactions enable row level security;

create policy "Reactions readable if the underlying event is readable"
  on activity_reactions for select
  using (
    exists (
      select 1 from activity_events ae
      join profiles p on p.id = ae.user_id
      where ae.id = activity_reactions.event_id
        and (p.is_public = true or ae.user_id = auth.uid())
    )
  );

create policy "Signed-in users can react as themselves"
  on activity_reactions for insert
  with check (user_id = auth.uid());

create policy "Users can remove their own reaction"
  on activity_reactions for delete
  using (user_id = auth.uid());

-- Reactions and price-drop alerts both notify through the same
-- notifications table as follows/comments/trophies.
alter table notifications drop constraint notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in ('follow', 'comment', 'trophy', 'reaction', 'price_drop'));
