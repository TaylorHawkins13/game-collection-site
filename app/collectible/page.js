import Link from 'next/link';
import { createClient } from '@/lib/supabaseServer';
import { buildCollectibleDetail, buildIgdbDetail } from '@/lib/collectibleDetail';
import { searchIgdb } from '@/lib/igdbSearch';
import { TYPE_LABELS } from '@/lib/mosaicData';
import { CoverThumb } from '@/components/LeaderboardThumb';
import ItemReviews from './ItemReviews';

export const dynamic = 'force-dynamic';

const SELECT_COLS =
  'title, item_type, cover, ownership, rating, platforms, genre, series, issue_number, publisher, writer, artist, card_set, card_number, player_name, format, user_id';

async function loadDetail(type, title) {
  const supabase = await createClient();
  // RLS on `games` already scopes this to public collectors' items plus
  // the viewer's own — same implicit-scoping pattern as the players
  // search, no explicit is_public join needed here.
  const { data: rows } = await supabase
    .from('games')
    .select(SELECT_COLS)
    .eq('item_type', type)
    .ilike('title', title);

  if (rows && rows.length > 0) {
    const detail = buildCollectibleDetail(rows, type);
    const ownerIds = [...new Set(rows.map((r) => r.user_id))];
    const { data: owners } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .in('id', ownerIds);
    return { detail, owners: owners || [], rows };
  }

  // Nobody's logged this one yet. For games, fall back to the same IGDB
  // search GameModal's "Search" button uses when adding an item, so a
  // title someone found through search (even one nobody owns) still has
  // a real detail page instead of a dead end.
  if (type === 'game') {
    const igdb = await searchIgdb(title);
    const match =
      (igdb.results || []).find((g) => g.name?.trim().toLowerCase() === title.trim().toLowerCase()) ||
      (igdb.results || [])[0] ||
      null;
    const detail = buildIgdbDetail(match);
    if (detail) return { detail, owners: [], rows: [] };
  }

  return null;
}

// Reviews (ROADMAP.md "Per-item reviews (separate from personal
// rating)") — same item_type + case-insensitive title match the games
// query above uses, scoped by item_reviews' own RLS (readable if the
// reviewer is public, or it's the viewer's own).
async function loadReviews(type, title) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('item_reviews')
    .select(
      'id, user_id, rating, body, created_at, updated_at, author:profiles!item_reviews_user_id_fkey(username, display_name, avatar_url)'
    )
    .eq('item_type', type)
    .ilike('title', title)
    .order('created_at', { ascending: false });
  return data || [];
}

export async function generateMetadata({ searchParams }) {
  const sp = await searchParams;
  const title = sp?.title || 'Collectible';
  return { title: `${title} — Shelf Life` };
}

export default async function CollectiblePage({ searchParams }) {
  const sp = await searchParams;
  const type = sp?.type || '';
  const title = sp?.title || '';

  if (!type || !title) {
    return (
      <main className="container" style={{ maxWidth: 720 }}>
        <p className="sub" style={{ marginTop: 20 }}>Missing search parameters.</p>
        <Link href="/players">← Back to search</Link>
      </main>
    );
  }

  const result = await loadDetail(type, title);

  if (!result) {
    return (
      <main className="container" style={{ maxWidth: 720 }}>
        <p className="sub" style={{ marginTop: 20 }}>Couldn't find "{title}".</p>
        <Link href="/players">← Back to search</Link>
      </main>
    );
  }

  const { detail, owners, rows } = result;
  const encodedTitle = encodeURIComponent(detail.title);

  const supabase = await createClient();
  const [
    {
      data: { user: viewer },
    },
    reviews,
  ] = await Promise.all([supabase.auth.getUser(), loadReviews(type, detail.title)]);
  const canReview = !!viewer && rows.some((r) => r.user_id === viewer.id && r.ownership === 'owned');

  return (
    <main className="container" style={{ maxWidth: 720, marginTop: 20 }}>
      <Link href="/players" className="sub" style={{ display: 'inline-block', marginBottom: 16 }}>
        ← Back to search
      </Link>

      <div className="collectible-header">
        {/* CoverThumb, not a raw <img> — this page is a Server Component,
            and an onError handler can't be attached to an element rendered
            directly inside one (see LeaderboardThumb.jsx's header comment).
            CoverThumb is already its own small 'use client' component for
            exactly this reason. */}
        <CoverThumb cover={detail.primary.cover} title={detail.title} className="collectible-cover" />
        <div style={{ minWidth: 0 }}>
          <h1 className="collectible-title">{detail.title}</h1>
          <div className="collectible-type">{TYPE_LABELS[detail.itemType] || detail.itemType}</div>

          {detail.uncollected ? (
            <p className="sub" style={{ margin: '0 0 12px', maxWidth: 420 }}>
              No one's added this to Shelf Life yet — be the first to add it to your shelf.
            </p>
          ) : (
            <div className="stats-bar" style={{ margin: 0, gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))' }}>
              <div className="stat">
                <div className="num">{detail.count}</div>
                <div className="label">Collector{detail.count === 1 ? '' : 's'}</div>
              </div>
              <div className="stat">
                <div className="num">{detail.ownedCount}</div>
                <div className="label">Own it</div>
              </div>
              {detail.avgRating != null && (
                <div className="stat">
                  <div className="num">{detail.avgRating.toFixed(1)}★</div>
                  <div className="label">Avg rating</div>
                </div>
              )}
            </div>
          )}

          {type === 'game' && (
            <div className="toolbar" style={{ marginTop: 14, marginBottom: 0 }}>
              <a
                className="btn-ghost"
                href={`https://howlongtobeat.com/?q=${encodedTitle}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Check time to beat
              </a>
              <a
                className="btn-ghost"
                href={`https://gamefaqs.gamespot.com/search?game=${encodedTitle}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Find a guide
              </a>
              {detail.uncollected && (
                <Link
                  href={`/dashboard?add=1&title=${encodedTitle}&cover=${encodeURIComponent(detail.primary.cover || '')}`}
                  className="btn-ghost"
                  style={{ textDecoration: 'none' }}
                >
                  Add to your shelf
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      {detail.fields.length > 0 && (
        <>
          <h3 className="profile-list-heading">Details</h3>
          <div className="detail-panel">
            {detail.fields.map((f) => (
              <div key={f.label} className="detail-field-row">
                <span className="detail-field-label">{f.label}</span>
                <span className="detail-field-value">{f.value}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <ItemReviews
        itemType={type}
        title={detail.title}
        initialReviews={reviews}
        viewerId={viewer?.id || null}
        canReview={canReview}
      />

      {owners.length > 0 && (
        <>
          <h3 className="profile-list-heading">Owned by</h3>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', marginBottom: 32 }}>
            {owners.map((o) => (
              <Link
                key={o.id}
                href={`/u/${o.username}`}
                className="card"
                style={{ textDecoration: 'none', color: 'inherit', padding: 12, display: 'flex', gap: 10, alignItems: 'center' }}
              >
                <div className="avatar" style={{ width: 36, height: 36, fontSize: 14, flexShrink: 0 }}>
                  {o.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={o.avatar_url} alt={o.username} />
                  ) : (
                    (o.display_name || o.username || '?').slice(0, 1).toUpperCase()
                  )}
                </div>
                <div style={{ minWidth: 0, fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {o.display_name || o.username}
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
