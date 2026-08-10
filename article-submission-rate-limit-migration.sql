-- Server-enforced article/review submission rate limit — same shape as
-- comment-rate-limit-migration.sql. A submission can't go public without
-- admin approval in /admin/articles, so this isn't a content-safety hole,
-- but a burst of junk submissions would flood that queue and spam the
-- admin's inbox (each one sends a notification email). A trigger blocks it
-- regardless of how the insert is made (app UI or a direct API call),
-- rather than relying on client-side throttling alone.
create or replace function enforce_article_submission_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recent_count int;
begin
  select count(*) into v_recent_count
  from article_submissions
  where user_id = new.user_id
    and created_at > now() - interval '5 minutes';

  if v_recent_count >= 5 then
    raise exception 'rate_limited: too many submissions — slow down and try again in a few minutes';
  end if;

  return new;
end;
$$;

drop trigger if exists article_submissions_rate_limit on article_submissions;
create trigger article_submissions_rate_limit
  before insert on article_submissions
  for each row execute function enforce_article_submission_rate_limit();

-- Trigger-only function, never meant to be callable directly via the API
-- (same pattern already used for enforce_comment_rate_limit()).
revoke execute on function enforce_article_submission_rate_limit() from public, anon, authenticated;
