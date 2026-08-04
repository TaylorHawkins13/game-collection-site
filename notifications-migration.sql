-- Adds in-app notifications: a bell/inbox for follows, comments, and
-- trophies, so those moments don't only exist as an in-the-moment toast.
-- `actor_id` is who triggered it (the person who followed you or left the
-- comment) — null for trophy notifications, since those are about you and
-- nobody else. Recipients only ever see their own inbox; only the actor
-- (or, for trophies, the recipient themself) can create a row.
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  actor_id uuid references profiles(id) on delete cascade,
  type text not null check (type in ('follow', 'comment', 'trophy')),
  comment_id uuid references comments(id) on delete cascade,
  trophy_key text references achievement_defs(key) on delete cascade,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_id_idx on notifications (user_id, created_at desc);

alter table notifications enable row level security;

create policy "Recipients can read their own notifications"
  on notifications for select
  using (user_id = auth.uid());

create policy "Actors can notify others, or notify themselves about trophies"
  on notifications for insert
  with check (
    actor_id = auth.uid()
    or (type = 'trophy' and actor_id is null and user_id = auth.uid())
  );

create policy "Recipients can mark their own notifications read"
  on notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Recipients can delete their own notifications"
  on notifications for delete
  using (user_id = auth.uid());
