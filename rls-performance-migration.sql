-- RLS performance cleanup, flagged by Supabase's own performance advisor
-- (auth_rls_initplan + multiple_permissive_policies lints). Two separate
-- issues, both non-urgent (query planner efficiency, not correctness —
-- every policy still returns the right rows before and after this):
--
-- 1. auth_rls_initplan: 33 policies across 12 public-schema tables (plus
--    6 more on storage.objects that the advisor doesn't scan but have the
--    same issue) call auth.uid() directly in USING/WITH CHECK, which
--    Postgres re-evaluates once per row. Wrapping it as
--    "(select auth.uid())" lets the planner evaluate it once per query
--    instead — same access rules, cheaper at scale. ALTER POLICY only
--    touches the qual/check expression, nothing about who can do what.
--
-- 2. multiple_permissive_policies: article_submissions had two separate
--    permissive SELECT policies ("Approved submissions are publicly
--    readable" and "Users can see their own submissions"), which Postgres
--    has to evaluate and OR together on every read. Folded into one
--    policy with both conditions — identical visibility (public sees
--    approved rows, an author always sees their own regardless of
--    status), one policy instead of two.

-- --- 1. auth_rls_initplan ---

alter policy "Activity readable if profile is public or owner"
  on activity_events
  using (((user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = activity_events.user_id) AND (p.is_public = true))))));

alter policy "Owners can insert their own activity"
  on activity_events
  with check ((user_id = (select auth.uid())));

alter policy "Reactions readable if the underlying event is readable"
  on activity_reactions
  using ((EXISTS ( SELECT 1
   FROM (activity_events ae
     JOIN profiles p ON ((p.id = ae.user_id)))
  WHERE ((ae.id = activity_reactions.event_id) AND ((p.is_public = true) OR (ae.user_id = (select auth.uid())))))));

alter policy "Signed-in users can react as themselves"
  on activity_reactions
  with check ((user_id = (select auth.uid())));

alter policy "Users can remove their own reaction"
  on activity_reactions
  using ((user_id = (select auth.uid())));

alter policy "Logged-in users can submit their own article"
  on article_submissions
  with check ((user_id = (select auth.uid())));

alter policy "Authors or profile owners can delete comments"
  on comments
  using (((author_id = (select auth.uid())) OR (profile_id = (select auth.uid()))));

alter policy "Comments readable if profile is public or owner/author"
  on comments
  using (((author_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = comments.profile_id) AND ((p.is_public = true) OR (p.id = (select auth.uid()))))))));

alter policy "Logged-in users can post comments as themselves"
  on comments
  with check ((author_id = (select auth.uid())));

alter policy "List items readable if list is readable"
  on custom_list_items
  using ((EXISTS ( SELECT 1
   FROM custom_lists l
  WHERE ((l.id = custom_list_items.list_id) AND ((l.user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM profiles p
          WHERE ((p.id = l.user_id) AND (p.is_public = true)))))))));

alter policy "Owners can add items to their own lists"
  on custom_list_items
  with check ((EXISTS ( SELECT 1
   FROM custom_lists l
  WHERE ((l.id = custom_list_items.list_id) AND (l.user_id = (select auth.uid()))))));

alter policy "Owners can remove items from their own lists"
  on custom_list_items
  using ((EXISTS ( SELECT 1
   FROM custom_lists l
  WHERE ((l.id = custom_list_items.list_id) AND (l.user_id = (select auth.uid()))))));

alter policy "Owners can reorder items in their own lists"
  on custom_list_items
  using ((EXISTS ( SELECT 1
   FROM custom_lists l
  WHERE ((l.id = custom_list_items.list_id) AND (l.user_id = (select auth.uid()))))));

alter policy "Lists readable if owner or profile is public"
  on custom_lists
  using (((user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = custom_lists.user_id) AND (p.is_public = true))))));

alter policy "Owners can create their own lists"
  on custom_lists
  with check ((user_id = (select auth.uid())));

alter policy "Owners can delete their own lists"
  on custom_lists
  using ((user_id = (select auth.uid())));

alter policy "Owners can update their own lists"
  on custom_lists
  using ((user_id = (select auth.uid())));

alter policy "Users can follow as themselves"
  on follows
  with check ((follower_id = (select auth.uid())));

alter policy "Users can unfollow as themselves"
  on follows
  using ((follower_id = (select auth.uid())));

alter policy "Games readable if profile is public or owner"
  on games
  using (((user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = games.user_id) AND (p.is_public = true))))));

alter policy "Owners can delete their own games"
  on games
  using ((user_id = (select auth.uid())));

alter policy "Owners can insert their own games"
  on games
  with check ((user_id = (select auth.uid())));

alter policy "Owners can update their own games"
  on games
  using ((user_id = (select auth.uid())));

alter policy "Actors can notify others, or notify themselves about trophies"
  on notifications
  with check (((actor_id = (select auth.uid())) OR ((type = 'trophy'::text) AND (actor_id IS NULL) AND (user_id = (select auth.uid())))));

alter policy "Recipients can delete their own notifications"
  on notifications
  using ((user_id = (select auth.uid())));

alter policy "Recipients can mark their own notifications read"
  on notifications
  using ((user_id = (select auth.uid())))
  with check ((user_id = (select auth.uid())));

alter policy "Recipients can read their own notifications"
  on notifications
  using ((user_id = (select auth.uid())));

alter policy "Users can delete their own passkeys"
  on passkey_credentials
  using (((select auth.uid()) = user_id));

alter policy "Users can view their own passkeys"
  on passkey_credentials
  using (((select auth.uid()) = user_id));

alter policy "Users can insert their own profile"
  on profiles
  with check (((select auth.uid()) = id));

alter policy "Users can update their own profile"
  on profiles
  using (((select auth.uid()) = id));

alter policy "Owners can insert their own value snapshots"
  on value_snapshots
  with check ((user_id = (select auth.uid())));

alter policy "Owners can read their own value snapshots"
  on value_snapshots
  using ((user_id = (select auth.uid())));

alter policy "Users can delete their own avatar"
  on storage.objects
  using (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = ((select auth.uid()))::text)));

alter policy "Users can delete their own item photos"
  on storage.objects
  using (((bucket_id = 'item-photos'::text) AND ((storage.foldername(name))[1] = ((select auth.uid()))::text)));

alter policy "Users can update their own avatar"
  on storage.objects
  using (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = ((select auth.uid()))::text)));

alter policy "Users can update their own item photos"
  on storage.objects
  using (((bucket_id = 'item-photos'::text) AND ((storage.foldername(name))[1] = ((select auth.uid()))::text)));

alter policy "Users can upload their own avatar"
  on storage.objects
  with check (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = ((select auth.uid()))::text)));

alter policy "Users can upload their own item photos"
  on storage.objects
  with check (((bucket_id = 'item-photos'::text) AND ((storage.foldername(name))[1] = ((select auth.uid()))::text)));

-- --- 2. multiple_permissive_policies (article_submissions duplicate SELECT) ---

drop policy if exists "Users can see their own submissions" on article_submissions;

alter policy "Approved submissions are publicly readable"
  on article_submissions
  using ((status = 'approved'::text) or (user_id = (select auth.uid())));
