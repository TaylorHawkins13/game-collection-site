-- Per-item reviews, separate from the personal 1-5 star `rating` field
-- on `games` (see ROADMAP.md "Per-item reviews (separate from personal
-- rating)"). A rating on `games` is private-by-default and per-copy —
-- your own opinion of your own copy of something, folded into the
-- collectible detail page's existing "Avg rating" stat. A review here
-- is a deliberate, separate write: a star rating *plus* real written
-- text, aggregated per item (item_type + title) across every collector
-- who's reviewed it, shown on that item's /collectible page.
--
-- Same visibility rule as comments/custom_lists elsewhere in this
-- schema: readable by the reviewer themselves, or by anyone if the
-- reviewer's own profile is public. A private collector's rating
-- already doesn't count toward the page's aggregate stats (RLS on
-- `games` excludes it) — reviews follow the same default rather than
-- becoming the one place a private profile's opinion leaks out anyway.
--
-- Reviews require actually owning the item (a matching `games` row with
-- ownership = 'owned') to post one, enforced in the insert policy
-- itself rather than trusting the client — the same "avoid needing a
-- full moderation system" reasoning this project has applied to every
-- other trust-sensitive feature (see ROADMAP.md). Nobody can review
-- something they haven't actually logged as owning.
create table if not exists item_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  item_type text not null,
  title text not null,
  rating numeric(2,1) not null check (rating >= 0.5 and rating <= 5 and mod(rating * 10, 5) = 0),
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Looking up "every review for this item" (the read path the
-- /collectible page actually uses) is always item_type + a
-- case-insensitive title match, same as the games query it sits next
-- to — indexed to match.
create index if not exists item_reviews_item_idx on item_reviews (item_type, lower(title));

-- One review per person per item — posting a second one edits the
-- first instead (enforced client-side; this is the real backstop).
create unique index if not exists item_reviews_user_item_uidx on item_reviews (user_id, item_type, lower(title));

alter table item_reviews enable row level security;

create policy "Reviews readable if reviewer is public or the viewer's own"
  on item_reviews for select
  using (
    user_id = (select auth.uid())
    or exists (select 1 from profiles p where p.id = item_reviews.user_id and p.is_public = true)
  );

create policy "Only owners of the item can review it"
  on item_reviews for insert
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from games g
      where g.user_id = (select auth.uid())
        and g.item_type = item_reviews.item_type
        and lower(g.title) = lower(item_reviews.title)
        and g.ownership = 'owned'
    )
  );

create policy "Reviewers can edit their own review"
  on item_reviews for update
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Reviewers can delete their own review"
  on item_reviews for delete
  using (user_id = (select auth.uid()));

-- Reuses the same set_updated_at() helper every other updated_at
-- column on this project's `games` table already relies on — it's
-- already present in every existing project's database, defined
-- alongside `games` itself.
drop trigger if exists item_reviews_set_updated_at on item_reviews;
create trigger item_reviews_set_updated_at
  before update on item_reviews
  for each row execute function set_updated_at();

-- Server-enforced rate limit — same shape and same cap as comments' and
-- reports' (5 per 5 minutes), so review posting can't be used to spam
-- regardless of how the insert is made.
create or replace function enforce_review_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recent_count int;
begin
  select count(*) into v_recent_count
  from item_reviews
  where user_id = new.user_id
    and created_at > now() - interval '5 minutes';

  if v_recent_count >= 5 then
    raise exception 'rate_limited: too many reviews — slow down and try again in a few minutes';
  end if;

  return new;
end;
$$;

drop trigger if exists item_reviews_rate_limit on item_reviews;
create trigger item_reviews_rate_limit
  before insert on item_reviews
  for each row execute function enforce_review_rate_limit();
