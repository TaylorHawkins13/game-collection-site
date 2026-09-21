import Link from 'next/link';
import Image from 'next/image';
import { ClipboardList } from 'lucide-react';
import { createClient } from '@/lib/supabaseServer';
import PublicListCard from '@/components/PublicListCard';

export const metadata = {
  title: 'Lists',
  description:
    "Browse public collector-made lists on Shelf Life — Favorites, For sale, Currently replaying, and whatever else people have put together.",
};

// Backloggd/Grouvee-style discovery surface — see ROADMAP.md's
// competitor-pass note and CHANGELOG.md. Reads the public_lists view
// (public-lists-migration.sql), which already does the RLS-safe join/
// filter work; this page just renders it. Static-ish top-N browse, same
// "top 50, no pagination yet" scope the leaderboard views started with.

// Same fix ROADMAP.md flagged for this page: a visitor arriving here
// before anyone's made a public list yet sees only bare "nothing here"
// text, with no evidence the feature actually works. Reuses the exact
// "Example" treatment app/page.js's homepage leaderboard already
// established for this situation — representative fake cards, tagged so
// they're never mistaken for real ones, reusing the same /demo cover art
// the homepage teaser already ships. Real lists always take over the
// instant there are any; this only ever renders when the query above
// comes back empty.
const EXAMPLE_LISTS = [
  { name: 'Currently Replaying', cover: '/demo/elden-demo.png', count: 4 },
  { name: 'For Sale', cover: '/demo/tlou-demo.png', count: 3 },
  { name: 'Long Boxes Worth Digging Through', cover: '/demo/comic-demo-v3.png', count: 6 },
];

export default async function ListsPage() {
  const supabase = await createClient();
  const { data: lists } = await supabase.from('public_lists').select('*').limit(60);

  return (
    <main className="container">
      <h1 style={{ marginTop: 20 }}>Lists</h1>
      <p className="sub" style={{ marginBottom: 24 }}>
        Public lists collectors have put together — Favorites, For sale, Currently replaying, and more. Make your
        own from your{' '}
        <Link href="/dashboard" style={{ color: 'inherit' }}>
          collection
        </Link>
        's "More actions" menu, on a public profile.
      </p>

      {!lists || lists.length === 0 ? (
        <>
          <div className="empty-state">
            <span className="empty-state-icon-badge"><ClipboardList aria-hidden="true" /></span>
            <div>No public lists yet — be the first to make one.</div>
          </div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', marginTop: 24 }}>
            {EXAMPLE_LISTS.map((l) => (
              <div className="card" key={l.name}>
                <div className="card-cover-wrap">
                  <Image className="cover" src={l.cover} alt="" fill sizes="220px" style={{ objectFit: 'cover' }} />
                </div>
                <div style={{ padding: '10px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        fontWeight: 600,
                        fontSize: 'var(--fs-md)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {l.name}
                    </span>
                    <span className="category-pill" style={{ flexShrink: 0 }}>Example</span>
                  </div>
                  <div className="sub" style={{ margin: '2px 0 0' }}>
                    {l.count} item{l.count === 1 ? '' : 's'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
          {lists.map((l) => (
            <PublicListCard key={l.id} list={l} />
          ))}
        </div>
      )}
    </main>
  );
}
