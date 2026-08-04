-- Lets a 'trophy' event show up in the activity feed alongside
-- added/completed/rated, for when someone lands a Shelf Life milestone
-- badge (bronze through platinum). trophy_key records which one.
alter table activity_events add column if not exists trophy_key text references achievement_defs(key) on delete cascade;

alter table activity_events drop constraint if exists activity_events_event_type_check;
alter table activity_events add constraint activity_events_event_type_check
  check (event_type in ('added', 'completed', 'rated', 'trophy'));
