import { NextResponse } from 'next/server';

// Searches two free, no-key-required card databases so trading card
// auto-fill can cover the two biggest TCGs without needing anyone to
// sign up for anything:
//
// - Pokémon TCG API (pokemontcg.io): free, no key required for
//   reasonable use (1000 requests/day, 30/min).
// - Scryfall (scryfall.com): Magic: The Gathering, completely free,
//   no key, no signup.
//
// There's no good free universal database for sports cards or other
// TCGs (Yu-Gi-Oh, etc.) — those still need to be filled in manually.

async function fetchPokemonCards(query) {
  const res = await fetch(
    `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(query)}&pageSize=6&orderBy=-set.releaseDate`,
    { headers: { Accept: 'application/json' } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data.data || []).map((card) => ({
    kind: 'card',
    id: `pokemon-${card.id}`,
    name: card.name,
    cover: card.images?.large || card.images?.small || '',
    set: card.set?.name || '',
    number: card.set?.printedTotal ? `${card.number}/${card.set.printedTotal}` : card.number || '',
    publisher: 'Pokémon TCG',
    player_name: card.name,
    subtitle: [card.set?.name, card.number].filter(Boolean).join(' · '),
  }));
}

// Multi-word card names (e.g. "Floette ex", "Mew VMAX") sometimes came
// back empty with an exact quoted-phrase match even though the card
// exists — the API's query parser is picky about phrase matching. This
// tries an exact phrase first, then an unquoted version, then falls
// back to a prefix match on just the first word (broadest, but better
// than nothing) — stopping as soon as one attempt finds something.
async function searchPokemon(q) {
  const clean = q.replace(/"/g, '').trim();
  if (!clean) return [];
  const firstWord = clean.split(/\s+/)[0];
  const attempts = clean.includes(' ')
    ? [`name:"${clean}"`, `name:${clean}`, `name:${firstWord}*`]
    : [`name:${clean}*`];

  for (const query of attempts) {
    const cards = await fetchPokemonCards(query);
    if (cards.length) return cards;
  }
  return [];
}

async function searchScryfall(q) {
  const res = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(q)}&order=released&dir=desc`, {
    headers: { Accept: 'application/json', 'User-Agent': 'ShelfLifeApp/1.0 (collection tracker)' },
  });
  if (res.status === 404) return []; // Scryfall's "no matches" response
  if (!res.ok) return [];
  const data = await res.json();
  return (data.data || []).slice(0, 5).map((card) => {
    const images = card.image_uris || card.card_faces?.[0]?.image_uris || {};
    return {
      kind: 'card',
      id: `scryfall-${card.id}`,
      name: card.name,
      cover: images.large || images.normal || '',
      set: card.set_name || '',
      number: card.collector_number || '',
      publisher: 'Magic: The Gathering',
      player_name: '',
      subtitle: [card.set_name, card.collector_number].filter(Boolean).join(' · '),
    };
  });
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();
  if (!q) {
    return NextResponse.json({ results: [] });
  }

  const [pokemon, scryfall] = await Promise.all([
    searchPokemon(q).catch(() => []),
    searchScryfall(q).catch(() => []),
  ]);

  return NextResponse.json({ results: [...pokemon, ...scryfall] });
}
