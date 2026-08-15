-- Lets a signed-in user report a comment or a profile for review — the
-- one thing the site had no lever for at all before this, unlike article
-- submissions which already have a real moderation flow (/admin/articles)
-- this copies the shape of. Closes a real gap flagged in ROADMAP.md: this
-- is now a public, search-indexed site with strangers (not just friends
-- and family) leaving comments on each other's profiles.
create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references profiles(id) on delete cascade,
  target_type text not null check (target_type in ('comment', 'profile')),
  -- No foreign key here on purpose — target_id points at either
  -- comments(id) or profiles(id) depending on target_type, and the
  -- target can legitimately be deleted (comment removed, account
  -- deleted) after a report's filed without the report itself needing
  -- to disappear too.
  target_id uuid not null,
  reason text check (char_length(reason) <= 500),
  status text not null default 'open' check (status in ('open', 'reviewed', 'actioned')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists reports_status_idx on reports (status, created_at desc);

alter table reports enable row level security;

-- Reporters can insert their own report but never read any of them back
-- (not even their own) — the queue is only ever seen by Taylor, via the
-- service-role client on /admin/reports, same zero-select-policy pattern
-- feedback/webauthn's rate-limit tables already use. Sign-in required
-- (unlike /feedback, which is deliberately open to anyone) so RLS has a
-- real reporter_id to key on and so the report system itself is a little
-- harder to spam anonymously.
create policy "Signed-in users can file a report as themselves"
  on reports for insert
  to authenticated
  with check (reporter_id = (select auth.uid()));

revoke all on reports from anon, authenticated;
grant insert on reports to authenticated;

-- Server-enforced rate limit — same shape as comments' (5 per 5
-- minutes), so the report system itself can't be used to spam Taylor's
-- inbox regardless of how the insert is made.
create or replace function enforce_report_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recent_count int;
begin
  select count(*) into v_recent_count
  from reports
  where reporter_id = new.reporter_id
    and created_at > now() - interval '5 minutes';

  if v_recent_count >= 5 then
    raise exception 'rate_limited: too many reports — slow down and try again in a few minutes';
  end if;

  return new;
end;
$$;

drop trigger if exists reports_rate_limit on reports;
create trigger reports_rate_limit
  before insert on reports
  for each row execute function enforce_report_rate_limit();
