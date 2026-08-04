-- Adds "Custom lists": curated sub-lists within a collection (e.g.
-- "Favorites," "For sale," "Currently replaying") beyond the 5-item
-- showcase. A list belongs to one person; an item can be in any number
-- of lists. Same visibility rule as everything else — a list (and its
-- items) is readable by its owner, or by anyone if the owning profile is
-- public.
create table if not exists custom_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists custom_lists_user_id_idx on custom_lists (user_id, sort_order);

alter table custom_lists enable row level security;

create policy "Lists readable if owner or profile is public"
  on custom_lists for select
  using (
    user_id = auth.uid()
    or exists (select 1 from profiles p where p.id = custom_lists.user_id and p.is_public = true)
  );

create policy "Owners can create their own lists"
  on custom_lists for insert
  with check (user_id = auth.uid());

create policy "Owners can update their own lists"
  on custom_lists for update
  using (user_id = auth.uid());

create policy "Owners can delete their own lists"
  on custom_lists for delete
  using (user_id = auth.uid());

create table if not exists custom_list_items (
  list_id uuid not null references custom_lists(id) on delete cascade,
  game_id uuid not null references games(id) on delete cascade,
  sort_order int not null default 0,
  added_at timestamptz not null default now(),
  primary key (list_id, game_id)
);

create index if not exists custom_list_items_list_id_idx on custom_list_items (list_id, sort_order);

alter table custom_list_items enable row level security;

create policy "List items readable if list is readable"
  on custom_list_items for select
  using (
    exists (
      select 1 from custom_lists l
      where l.id = custom_list_items.list_id
      and (
        l.user_id = auth.uid()
        or exists (select 1 from profiles p where p.id = l.user_id and p.is_public = true)
      )
    )
  );

create policy "Owners can add items to their own lists"
  on custom_list_items for insert
  with check (
    exists (select 1 from custom_lists l where l.id = custom_list_items.list_id and l.user_id = auth.uid())
  );

create policy "Owners can reorder items in their own lists"
  on custom_list_items for update
  using (
    exists (select 1 from custom_lists l where l.id = custom_list_items.list_id and l.user_id = auth.uid())
  );

create policy "Owners can remove items from their own lists"
  on custom_list_items for delete
  using (
    exists (select 1 from custom_lists l where l.id = custom_list_items.list_id and l.user_id = auth.uid())
  );
