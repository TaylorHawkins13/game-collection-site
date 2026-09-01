import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabaseServer';
import { fetchOwnedItems } from '@/lib/mosaicData';
import MosaicClient from './MosaicClient';

// The live, interactive shelf mosaic — a browsable version of the same
// data behind the shareable PNG at /u/[username]/mosaic-image. Fetches
// the full owned-items list exactly once here (server-side, RLS-scoped);
// all mode switching (All / Showcase / By Type / By Year / Most Valuable)
// then happens client-side against that same array with no refetch —
// see lib/mosaicData.js's shapeMosaic().
export async function generateMetadata({ params }) {
  const { username } = await params;
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name, is_public')
    .eq('username', username)
    .single();

  if (!profile || !profile.is_public) return { title: 'Shelf mosaic' };

  const name = profile.display_name || profile.username;
  const title = `${name}'s shelf mosaic`;
  const description = `Every item on ${name}'s shelf, arranged like a real shelf — built with Shelf Life.`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [`/u/${profile.username}/mosaic-image?mode=all`],
    },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function MosaicPage({ params }) {
  const { username } = await params;
  const supabase = await createClient();

  const {
    data: { user: viewer },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name, currency, is_public')
    .eq('username', username)
    .single();

  if (!profile) notFound();

  const isOwner = viewer?.id === profile.id;
  const canView = profile.is_public || isOwner;

  if (!canView) {
    return (
      <main className="container">
        <div className="empty-state">
          <div>This collector's shelf is private.</div>
        </div>
      </main>
    );
  }

  const items = await fetchOwnedItems(supabase, profile.id);

  return (
    <main className="container">
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginTop: 20 }}>
        <div>
          <h2 style={{ margin: 0 }}>{profile.display_name || profile.username}&rsquo;s shelf mosaic</h2>
          <div className="profile-username">
            <Link href={`/u/${profile.username}`} style={{ color: 'inherit' }}>
              &larr; back to @{profile.username}
            </Link>
          </div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="empty-state">
          <div>No owned items yet — add something to your shelf first.</div>
        </div>
      ) : (
        <MosaicClient
          username={profile.username}
          displayName={profile.display_name}
          currency={profile.currency}
          items={items}
        />
      )}
    </main>
  );
}
