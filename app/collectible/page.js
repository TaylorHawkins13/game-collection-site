import Link from 'next/link';
import { createClient } from '@/lib/supabaseServer';
import { buildCollectibleDetail } from '@/lib/collectibleDetail';
import { TYPE_LABELS } from '@/lib/mosaicData';

export const dynamic = 'force-dynamic';

const SELECT_COLS =
  'title, item_type, cover, ownership, rating, platforms, genre, series, issue_number, publisher, writer, artist, card_set, card_number, player_name, format, user_id';

async function loadDetail(type, title) {
  const supabase = createClient();
  // RLS on `games` already scopes this to public collectors' items plus
  // the viewer's own — same implicit-scoping pattern as the players
  // search, no explicit is_public join needed here.
  const { data: rows } = await supabase
    .from('games')
    .select(SELECT_COLS)
    .eq('item_type', type)
    .ilike('title', title);

  if (!rows || rows.length === 0) return null;

  const detail = buildCollectibleDetail(rows, type);

  const ownerIds = [...new Set(rows.map((r) => r.user_id))];
  const { data: owners } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .in('id', ownerIds);

  return { detail, owners: owners || [] };
}

export async function generateMetadata({ searchParams }) {
  const title = searchParams?.title || 'Collectible';
  return { title: `${title} — Shelf Life` };
}

export default async function CollectiblePage({ searchParams }) {
  const type = searchParams?.type || '';
  const title = searchParams?.title || '';

  if (!type || !title) {
    return (
      <main className="container">
        <p className="sub" style={{ marginTop: 20 }}>Missing search parameters.</p>
        <Link href="/players">Back to search</Link>
      </main>
    );
  }

  const result = await loadDetail(type, title);

  if (!result) {
    return (
      <main className="container">
        <p className="sub" style={{ marginTop: 20 }}>Couldn't find "{title}".</p>
        <Link href="/players">Back to search</Link>
      </main>
    );
  }

  const { detail, owners } = result;
  const encodedTitle = encodeURIComponent(detail.title);

  return (
    <main className="container" style={{ maxWidth: 720, marginTop: 20 }}>
      <Link href="/players" className="sub" style={{ display: 'inline-block', marginBottom: 16 }}>
        ← Back to search
      </Link>

      <div style={{ display: 'flex', gap: 20, marginBottom: 24 }}>
        {detail.primary.cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={detail.primary.cover}
            alt={detail.title}
            style={{ width: 140, height: 140, objectFit: 'cover', borderRadius: 10, flexShrink: 0 }}
          />
        ) : (
          <div className="cover placeholder" style={{ width: 140, height: 140, flexShrink: 0 }}>
            No Cover
          </div>
        )}
        <div>
          <h1 style={{ margin: '0 0 6px' }}>{detail.title}</h1>
          <div className="sub" style={{ marginBottom: 10 }}>{TYPE_LABELS[detail.itemType] || detail.itemType}</div>
          <div className="sub">
            {detail.count} collector{detail.count === 1 ? '' : 's'} · {detail.ownedCount} own it
            {detail.avgRating ? ` · ${detail.avgRating.toFixed(1)}★ avg rating` : ''}
          </div>
        </div>
      </div>

      {type === 'game' && (
        <div className="toolbar" style={{ marginBottom: 24 }}>
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
        </div>
      )}

      {detail.fields.length > 0 && (
        <div className="card" style={{ padding: 16, marginBottom: 24 }}>
          {detail.fields.map((f) => (
            <div key={f.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border, #2a2a2a)' }}>
              <span className="sub" style={{ margin: 0 }}>{f.label}</span>
              <span style={{ fontWeight: 500 }}>{f.value}</span>
            </div>
          ))}
        </div>
      )}

      {owners.length > 0 && (
        <>
          <div className="sub" style={{ marginBottom: 12 }}>Owned by</div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
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
