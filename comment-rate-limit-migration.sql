-- Server-enforced comment rate limit — nothing previously stopped spam
-- posting since the insert went straight through RLS with no cap. A
-- trigger blocks it regardless of how the insert is made (app UI or a
-- direct API call), rather than relying on client-side throttling alone.
create or replace function enforce_comment_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recent_count int;
begin
  select count(*) into v_recent_count
  from comments
  where author_id = new.author_id
    and created_at > now() - interval '5 minutes';

  if v_recent_count >= 5 then
    raise exception 'rate_limited: too many comments — slow down and try again in a few minutes';
  end if;

  return new;
end;
$$;

drop trigger if exists comments_rate_limit on comments;
create trigger comments_rate_limit
  before insert on comments
  for each row execute function enforce_comment_rate_limit();
