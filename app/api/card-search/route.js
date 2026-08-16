import { NextResponse } from 'next/server';

// Searches two free, no-key-required card databases so trading card
// auto-fill can cover the two biggest TCGs without needing anyone to
// sign up for anything:
//
// - TCGdex (tcgdex.dev / api.tcgdex.net): Pokémon TCG, free, open-source,
//   no key, no signup. This app originally used the old pokemontcg.io API
//   here — that project has since been folded into "Scrydex," a paid
//   product (plans start at $29/mo, no free tier), which is why Pokémon
//   auto-fill quietly stopped working. Switched to TCGdex, a separate,
//   still-free, actively maintained community project that covers the
//   same ground. Its search endpoint only returns id/name/image per card
//   (no set, card number, or rarity) — so a second, per-result detail
//   fetch runs in parallel right after the initial search to fill those
//   in, rather than making someone click through with half the fields
//   still blank.
// - Scryfall (scryfall.com): Magic: The Gathering, completely free,
//   no key, no signup, unaffected by any of the above.
//
// There's no good free universal database for sports cards or other
// TCGs (Yu-Gi-Oh, etc.) — those still need to be filled in manually.

async function fetchTcgdexBrief(query) {
  // Was itemsPerPage=8 — way too tight for a lot of real Pokémon names.
  // A name that's been reprinted across many sets/generations (which is
  // most of them — Beldum alone has more than 8 real prints) meant the
  // one card someone actually owns could get pushed off the end before
  // it ever reached the results list, even though it was a genuine match.
  // 48 is a deliberate middle ground, not "no limit": true unbounded
  // pagination would mean fetching every print of every card sharing a
  // name (Pikachu alone runs into the hundreds), which is both a slow
  // burst of parallel detail-fetches per search and a dropdown nobody
  // could usefully scroll through. 48 comfortably covers real per-card
  // reprint counts for the vast majority of Pokémon without either problem.
  const res = await fetch(
    `https://api.tcgdex.net/v2/en/cards?name=${encodeURIComponent(query)}&pagination:itemsPerPage=48`,
    { headers: { Accept: 'application/json' } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

async function fetchTcgdexDetail(id) {
  const res = await fetch(`https://api.tcgdex.net/v2/en/cards/${encodeURIComponent(id)}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) return null;
  return res.json();
}

function tcgdexImage(base) {
  // Base image URLs come back with no extension/quality — see
  // tcgdex.dev/assets. webp/high is the site's own recommendation for a
  // "this is the main image being shown" use case, which fits the search
  // results list and the cover it fills in.
  return base ? `${base}/high.webp` : '';
}

async function searchPokemon(q) {
  const clean = q.trim();
  if (!clean) return [];
  // TCGdex's default filter is already a case-insensitive "contains"
  // match (see tcgdex.dev/rest/filtering-sorting-pagination), so unlike
  // the old pokemontcg.io integration this doesn't need a multi-attempt
  // fallback chain for picky phrase matching.
  // No further slicing here — fetchTcgdexBrief's itemsPerPage is already
  // the real cap. Slicing again on top of that (this used to cut down to
  // 6) was the actual bug: it silently dropped real matches that the API
  // had already returned.
  const briefs = await fetchTcgdexBrief(clean);
  if (!briefs.length) return [];

  const details = await Promise.all(briefs.map((b) => fetchTcgdexDetail(b.id).catch(() => null)));

  return details.map((card, i) => {
    const brief = briefs[i];
    if (!card) {
      // Detail fetch failed for this one specifically — still show it
      // (name/image are already known from the search step), just with
      // set/number left blank instead of dropping the result entirely.
      return {
        kind: 'card',
        id: `tcgdex-${brief.id}`,
        name: brief.name,
        cover: tcgdexImage(brief.image),
        set: '',
        number: brief.localId || '',
        publisher: 'Pokémon TCG',
        player_name: brief.name,
        subtitle: brief.localId ? `#${brief.localId}` : '',
      };
    }
    const total = card.set?.cardCount?.official || card.set?.cardCount?.total;
    const numberStr = total ? `${card.localId}/${total}` : card.localId || '';
    return {
      kind: 'card',
      id: `tcgdex-${card.id}`,
      name: card.name,
      cover: tcgdexImage(card.image),
      set: card.set?.name || '',
      number: numberStr,
      publisher: 'Pokémon TCG',
      player_name: card.name,
      subtitle: [card.set?.name, numberStr].filter(Boolean).join(' · '),
    };
  });
}

async function searchScryfall(q) {
  const res = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(q)}&order=released&dir=desc`, {
    headers: { Accept: 'application/json', 'User-Agent': 'ShelfLifeApp/1.0 (collection tracker)' },
  });
  if (res.status === 404) return []; // Scryfall's "no matches" response
  if (!res.ok) return [];
  const data = await res.json();
  // Same fix as the Pokémon side above — 5 was too tight for a card
  // that's had many reprints across sets. Scryfall's search endpoint
  // already returns up to 175 per page; 30 is a generous cap that still
  // keeps the dropdown scrollable rather than fetching everything Scryfall has.
  return (data.data || []).slice(0, 30).map((card) => {
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
