-- Lets a signed-in visitor refresh eBay prices on someone ELSE's public
-- collection, not just their own. Normal RLS ("Owners can update their own
-- games") blocks this — SECURITY DEFINER bypasses it, but the function does
-- its own narrower check: allowed if you own the item, or if the item's
-- owner has a public profile. Only ever touches market_price,
-- market_price_checked_at, and market_price_currency — nothing else on the
-- row is reachable through this.
create or replace function refresh_item_market_price(
  p_game_id uuid,
  p_market_price numeric,
  p_currency text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_is_public boolean;
begin
  if auth.uid() is null then
    raise exception 'must be signed in';
  end if;

  select g.user_id, p.is_public into v_owner_id, v_is_public
  from games g
  join profiles p on p.id = g.user_id
  where g.id = p_game_id;

  if v_owner_id is null then
    raise exception 'item not found';
  end if;

  if auth.uid() <> v_owner_id and not coalesce(v_is_public, false) then
    raise exception 'not allowed';
  end if;

  update games
  set market_price = p_market_price,
      market_price_checked_at = now(),
      market_price_currency = p_currency
  where id = p_game_id;
end;
$$;

-- Supabase grants EXECUTE on every new public-schema function to
-- anon/authenticated directly by default — revoke that first so only
-- the explicit grant below actually applies. (The function's own
-- auth.uid() is null check already blocked signed-out callers either
-- way, but the grant existing at all is what Supabase's Security
-- Advisor flags on a SECURITY DEFINER function.)
revoke execute on function refresh_item_market_price(uuid, numeric, text) from public, anon, authenticated;
grant execute on function refresh_item_market_price(uuid, numeric, text) to authenticated;
