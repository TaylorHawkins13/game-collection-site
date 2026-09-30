import { cache } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabaseServer';
import { getCardArtistWorks } from '@/lib/cardArtistLookup';
import { ownedCardKeysBySetAndNumber } from '@/lib/seriesLookup';
import CardCreatorPageClient from './CardCreatorPageClient';

// Same cache() reasoning as app/creator/comics/[id]/page.js's
// getWorksCached — generateMetadata and the page body below share one
// real Scryfall/TCGdex lookup instead of two.
//
// `name` does NOT arrive pre-decoded — confirmed live via a temporary
// debug render on this exact page: a real illustrator name with a space
// (Rebecca Guay) showed up in `params.name` as the literal, still-encoded
// "Rebecca%20Guay", not a real space, so the Scryfall/TCGdex query always
// searched for an artist that doesn't exist. Decoded explicitly here
// rather than trusted — this project's `[name]`-based route in
// app/creator/books/[name]/page.js carried the identical wrong assumption
// and the identical silent bug, fixed the same way in the same round.
// `game` is a fixed 'mtg'/'pokemon' literal with no encodable characters,
// so it doesn't need this.
const getWorksCached = cache((game, name) => getCardArtistWorks(decodeURIComponent(name), game));

const GAME_LABEL = { mtg: 'Magic: The Gathering', pokemon: 'Pokémon TCG' };

export async function generateMetadata({ params }) {
  const { game, name } = await params;
  const result = await getWorksCached(game, name);
  if (result.error || !result.entries) {
    return { title: 'Illustrator not found', robots: { index: false } };
  }
  const count = result.entries.length;
  const gameLabel = GAME_LABEL[game] || '';
  const description = count
    ? `Browse ${result.name}'s ${gameLabel} cards on Shelf Life — ${count} card${count === 1 ? '' : 's'} on file, greyed out except what you already own.`
    : `Browse ${result.name}'s ${gameLabel} cards on Shelf Life.`;
  return {
    title: `${result.name} — ${gameLabel} Cards`,
    description,
    openGraph: { title: `${result.name}'s ${gameLabel} cards on Shelf Life`, description },
  };
}

export default async function CardCreatorPage({ params }) {
  const { game, name } = await params;
  const supabase = await createClient();

  const [result, { data: { user } }] = await Promise.all([
    getWorksCached(game, name),
    supabase.auth.getUser(),
  ]);

  let ownedKeys = [];
  let currency;
  if (user) {
    const [{ data: ownCards }, { data: profile }] = await Promise.all([
      supabase.from('games').select('card_set, card_number, ownership').eq('user_id', user.id).eq('item_type', 'trading_card'),
      supabase.from('profiles').select('currency').eq('id', user.id).maybeSingle(),
    ]);
    ownedKeys = [...ownedCardKeysBySetAndNumber((ownCards || []).map((g) => ({ ...g, item_type: 'trading_card' })))];
    currency = profile?.currency;
  }

  return (
    <main className="container">
      <p className="sub" style={{ marginTop: 20 }}>
        <Link href="/creator/cards">← Browse another illustrator</Link>
      </p>

      {result.error || !GAME_LABEL[game] ? (
        <div className="empty-state">
          <div>
            {result.error === 'query_failed'
              ? "Couldn't reach Scryfall or TCGdex right now — try again in a moment."
              : "Couldn't find that illustrator, or they have nothing on file."}
          </div>
          <p className="sub">
            <Link href="/creator/cards">Try a different search</Link>.
          </p>
        </div>
      ) : (
        <CardCreatorPageClient
          name={result.name}
          gameLabel={GAME_LABEL[game]}
          entries={result.entries}
          ownedKeys={ownedKeys}
          truncated={result.truncated}
          signedIn={!!user}
          currency={currency}
        />
      )}
    </main>
  );
}
