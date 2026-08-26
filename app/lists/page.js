import Link from 'next/link';
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
export default async function ListsPage() {
  const supabase = createClient();
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
        <div className="empty-state">
          <div>No public lists yet — be the first to make one.</div>
        </div>
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
