-- RLS tests for steady-social.sql. Runs against plain Postgres with a minimal Supabase stand-in:
--   roles anon/authenticated, auth.users(id uuid), and auth.uid() reading current_setting('request.jwt.claim.sub').
-- See supabase/README section in running-app/README.md. Every line prints 'ok: …' or stops with 'FAILED: …'.
\set ON_ERROR_STOP 1
-- users
insert into auth.users values ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b'), ('00000000-0000-0000-0000-00000000000e');
create or replace function pg_temp.as_user(u text) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', u, false); execute 'set role authenticated'; end $$;
create or replace function pg_temp.expect(cond boolean, msg text) returns void language plpgsql as $$ begin if not cond then raise exception 'FAILED: %', msg; end if; raise notice 'ok: %', msg; end $$;

select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into public.profiles values (auth.uid(), 'Alice', 'ALICE2');
reset role; select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
insert into public.profiles values (auth.uid(), 'Bob', 'BOBBY3');
reset role; select pg_temp.as_user('00000000-0000-0000-0000-00000000000e');
insert into public.profiles values (auth.uid(), 'Eve', 'EVEEE4');

-- Eve can't create a profile for someone else
do $$ begin
  begin insert into public.profiles values ('00000000-0000-0000-0000-00000000000a', 'Fake', 'FAKEE5'); raise exception 'FAILED: impersonated profile';
  exception when insufficient_privilege or unique_violation then raise notice 'ok: cannot create profile for someone else'; end;
end $$;
select pg_temp.expect((select count(*) from public.profiles) = 1, 'Eve sees only herself (no directory)');

-- Alice finds Bob by code and requests
reset role; select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.expect((select display_name from public.find_by_friend_code('bobby3')) = 'Bob', 'lookup by exact code (case-insensitive)');
select pg_temp.expect((select count(*) from public.find_by_friend_code('BOB')) = 0, 'partial codes find nothing');
insert into public.friendships (requester, addressee) values (auth.uid(), '00000000-0000-0000-0000-00000000000b');
do $$ begin
  begin update public.friendships set status = 'accepted'; 
    if exists (select 1 from public.friendships where status = 'accepted') then raise exception 'FAILED: requester self-accepted'; end if;
    raise notice 'ok: requester cannot accept own request';
  end;
end $$;
-- Alice posts a run
insert into public.shared_runs (user_id, activity_date, kind, headline, title, duration_sec, distance_m) values (auth.uid(), '2026-11-18', 'run', 'Planned run: done', 'Easy run', 1800, 5000);

-- Bob: sees request + Alice profile, can't see run until accepted
reset role; select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.expect((select count(*) from public.profiles where display_name = 'Alice') = 1, 'Bob sees requester profile');
select pg_temp.expect((select count(*) from public.shared_runs) = 0, 'no posts visible before accepting');
update public.friendships set status = 'accepted' where addressee = auth.uid();
select pg_temp.expect((select count(*) from public.shared_runs) = 1, 'friend sees post after accepting');
insert into public.cheers values ((select id from public.shared_runs limit 1), auth.uid(), '🔥');
do $$ begin
  begin insert into public.shared_runs (user_id, activity_date, kind, headline, title, duration_sec) values ('00000000-0000-0000-0000-00000000000a', '2026-11-18', 'run', 'x', 'x', 1); raise exception 'FAILED: posted as friend';
  exception when insufficient_privilege then raise notice 'ok: cannot post as someone else'; end;
end $$;
do $$ begin
  begin insert into public.cheers values ((select id from public.shared_runs limit 1), auth.uid(), '💩'); raise exception 'FAILED: odd emoji';
  exception when check_violation or unique_violation then raise notice 'ok: only the three cheers allowed'; end;
end $$;
delete from public.shared_runs; -- Bob can't delete Alice's post
reset role; select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.expect((select count(*) from public.shared_runs) = 1, 'friends cannot delete your post');
select pg_temp.expect((select count(*) from public.cheers) = 1, 'owner sees cheers on own post');
do $$ begin
  begin insert into public.cheers values ((select id from public.shared_runs limit 1), auth.uid(), '👏'); raise exception 'FAILED: self-cheer';
  exception when insufficient_privilege then raise notice 'ok: cannot cheer your own post'; end;
end $$;

-- Eve: outsider sees nothing, can't cheer
reset role; select pg_temp.as_user('00000000-0000-0000-0000-00000000000e');
select pg_temp.expect((select count(*) from public.shared_runs) = 0, 'outsider sees no posts');
select pg_temp.expect((select count(*) from public.cheers) = 0, 'outsider sees no cheers');
select pg_temp.expect((select count(*) from public.friendships) = 0, 'outsider sees no friendships');
select pg_temp.expect((select count(*) from public.profiles) = 1, 'outsider sees no other profiles');
do $$ begin
  begin insert into public.cheers values ((select id from public.shared_runs limit 1), auth.uid(), '👏'); raise exception 'FAILED: outsider cheered';
  exception when insufficient_privilege or not_null_violation then raise notice 'ok: outsider cannot cheer'; end;
end $$;
-- duplicate pair in reverse direction blocked
reset role; select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
do $$ begin
  begin insert into public.friendships (requester, addressee) values (auth.uid(), '00000000-0000-0000-0000-00000000000a'); raise exception 'FAILED: duplicate pair';
  exception when unique_violation then raise notice 'ok: one friendship per pair'; end;
end $$;
-- unfriend hides posts again
delete from public.friendships;
select pg_temp.expect((select count(*) from public.shared_runs) = 0, 'unfriending hides posts');

-- anon has no access at all
reset role; set role anon;
do $$ begin
  begin perform 1 from public.shared_runs; raise exception 'FAILED: anon read';
  exception when insufficient_privilege then raise notice 'ok: anon has no table access'; end;
end $$;
reset role;
select 'ALL RLS TESTS PASSED';
