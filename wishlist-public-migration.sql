-- Lets someone share app/u/[username]/wishlist without making their
-- whole profile/collection public via profiles.is_public. New projects
-- get this automatically from supabase-schema.sql — this is the
-- standalone version for a project set up before this column existed.
-- See supabase-schema.sql's "Gift list (wishlist) sharing independent of
-- full-profile privacy" section for the full explanation, including why
-- the games RLS policy also needs widening (not just the new column) for
-- a shared gift list to actually be visible to a non-owner viewer.

alter table public.profiles
  add column if not exists wishlist_public boolean not null default false;

alter policy "Games readable if profile is public or owner"
  on public.games
  using (
    user_id = (select auth.uid())
    or exists (select 1 from profiles p where p.id = games.user_id and p.is_public = true)
    or (
      games.ownership = 'wishlist'
      and exists (select 1 from profiles p where p.id = games.user_id and p.wishlist_public = true)
    )
  );
