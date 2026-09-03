import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabaseServer';
import { resolvePlatformIds } from '@/lib/igdbPlatformCatalogue';
import CatalogueClient from './CatalogueClient';

export const metadata = {
  title: 'Full Release Catalogue — Shelf Life',
};

// Server-gated the same way app/dashboard/insights/page.js is — fetches
// only what CatalogueClient's ownership matching actually needs (title +
// platforms + ownership), not the whole `games` row, since a big
// collection has no reason to ship every other column down for this one
// comparison.
export default async function CataloguePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const [{ data: games }, { data: profile }] = await Promise.all([
    supabase.from('games').select('title, platforms, ownership').eq('user_id', user.id).eq('item_type', 'game'),
    supabase.from('profiles').select('currency').eq('id', user.id).single(),
  ]);

  const ownedGames = games || [];

  // Resolved once per page load, up front, across every distinct
  // platform string the user has ever typed — not per platform browsed —
  // so lib/platformCatalogueMatch.js can compare real IGDB platform ids
  // instead of free-typed names (see that file for why: closes the
  // "PS2" vs "PlayStation 2" gap the first version of this feature had).
  // resolvePlatformIds is defensive on its own (a missing IGDB config or
  // a transient failure just resolves a name to `null`), so this can
  // never throw and take the page down with it.
  const distinctPlatforms = [...new Set(ownedGames.flatMap((g) => g.platforms || []))];
  const ownedPlatformIds = await resolvePlatformIds(distinctPlatforms);

  return (
    <CatalogueClient
      ownedGames={ownedGames}
      ownedPlatformIds={ownedPlatformIds}
      currency={profile?.currency || 'USD'}
    />
  );
}
