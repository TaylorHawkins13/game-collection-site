import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabaseServer';
import GameCard from '@/components/GameCard';

export async function generateMetadata({ params }) {
  const supabase = createClient();
  const { data: list } = await supabase.from('custom_lists').select('name, user_id').eq('id', params.id).single();
  if (!list) return { title: 'List not found' };
  const { data: owner } = await supabase.from('profiles').select('username, display_name').eq('id', list.user_id).single();
  const ownerName = owner?.display_name || owner?.username || 'a collector';
  return {
    title: `${list.name} — ${ownerName}'s list`,
    description: `See what's on ${ownerName}'s "${list.name}" list on Shelf Life.`,
  };
}

// One public list's full contents, linked from the /lists directory. Two
// separate queries (list+owner, then items) rather than a single
// embedded select — same defensive pattern app/collectible/page.js uses
// for its "Owned by" list, since guessing at Postgrest's foreign-key
// embed name for custom_lists -> profiles isn't worth the risk of a
// silent wrong-column mismatch.
export default async function ListDetailPage({ params }) {
  const supabase = createClient();

  const { data: list } = await supabase
    .from('custom_lists')
    .select('id, name, user_id, created_at')
    .eq('id', params.id)
    .single();

  if (!list) notFound();

  const { data: owner } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, is_public, currency')
    .eq('id', list.user_id)
    .single();

  // custom_lists' own RLS already only returns a row here if the owner is
  // public or this is the viewer's own list — but RLS returning nothing
  // and a private-profile edge case look identical from here (both give
  // an empty/mismatched owner), so this explicit check gives a real
  // "private" message instead of a bare notFound() either way.
  if (!owner || !owner.is_public) {
    const {
      data: { user: viewer },
    } = await supabase.auth.getUser();
    if (!viewer || viewer.id !== list.user_id) {
      return (
        <main className="container" style={{ maxWidth: 720 }}>
          <p className="sub" style={{ marginTop: 20 }}>This list is private.</p>
          <Link href="/lists">← Back to Lists</Link>
        </main>
      );
    }
  }

  const { data: listItems } = await supabase
    .from('custom_list_items')
    .select('game_id, sort_order')
    .eq('list_id', list.id)
    .order('sort_order', { ascending: true });

  const gameIds = (listItems || []).map((it) => it.game_id);
  const { data: games } = gameIds.length
    ? await supabase.from('games').select('*').in('id', gameIds)
    : { data: [] };
  const gamesById = new Map((games || []).map((g) => [g.id, g]));
  const orderedGames = (listItems || []).map((it) => gamesById.get(it.game_id)).filter(Boolean);

  const ownerName = owner?.display_name || owner?.username || 'a collector';

  return (
    <main className="container">
      <div style={{ marginTop: 20, marginBottom: 8 }}>
        <Link href="/lists" className="sub" style={{ textDecoration: 'none' }}>
          ← Back to Lists
        </Link>
      </div>
      <h1>{list.name}</h1>
      <p className="sub" style={{ marginBottom: 24 }}>
        By{' '}
        {owner?.username ? (
          <Link href={`/u/${owner.username}`} style={{ color: 'inherit' }}>
            {ownerName}
          </Link>
        ) : (
          ownerName
        )}{' '}
        · {orderedGames.length} item{orderedGames.length === 1 ? '' : 's'}
      </p>

      {orderedGames.length === 0 ? (
        <div className="empty-state">
          <div>This list is empty.</div>
        </div>
      ) : (
        <div className="grid">
          {orderedGames.map((g) => (
            <GameCard key={g.id} game={g} currency={owner?.currency} />
          ))}
        </div>
      )}
    </main>
  );
}
