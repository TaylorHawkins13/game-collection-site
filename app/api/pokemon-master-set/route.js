import { NextResponse } from 'next/server';
import { getMasterSetEntries } from '@/lib/tcgdexSetLookup';
import { createAdminClient } from '@/lib/supabaseAdmin';

// Trading-card "master set" completion — Pokémon only, see
// lib/tcgdexSetLookup.js for the full reasoning. Mirrors
// /api/series-lookup's error-code shape (no_series_value/no_series/
// query_failed) so lib/useSeriesLookup.js can handle both the same way.

// Same backstop as app/api/card-search/route.js's maxDuration — see that
// file's comment. tcgdexSetLookup.js's own per-fetch timeout (8s) plus its
// MAX_DETAIL_FETCHES cap (25, concurrency-limited) keeps the narrow
// no-cache path's real worst case well under this; a cache hit does no
// live per-card fetching at all, so it's faster still. It's here so an
// unexpected hang fails on a timeframe someone would actually wait
// through, not Vercel's 300-second default.
export const maxDuration = 20;

// Best-effort read of master_set_cache (see supabase-schema.sql and
// app/api/cron/refresh-master-sets) — passed into getMasterSetEntries as
// a loader callback so lib/tcgdexSetLookup.js itself stays DB-agnostic.
// A missing SUPABASE_SERVICE_ROLE_KEY, a query error, or simply no row
// yet for this set (nobody's logged a card from it since the cron last
// ran, or ever) all fall through to the narrow live-fetch path exactly as
// before caching existed — this is purely an optimization/upgrade, never
// a hard dependency for "See master set" to work at all.
async function loadCachedDetail(setId) {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return null;
  }
  const { data, error } = await admin.from('master_set_cache').select('entries').eq('set_id', setId).maybeSingle();
  if (error || !data?.entries) return null;
  // Stored as a plain { [cardId]: { variants } } object (see
  // app/api/cron/refresh-master-sets) — reconstructed into the Map shape
  // buildEntries()/variantKeysForCard() expect.
  return new Map(Object.entries(data.entries));
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const value = (searchParams.get('value') || '').trim();
  if (!value) {
    return NextResponse.json({ error: 'no_series_value' }, { status: 400 });
  }
  // Which cards (already normalized client-side — see
  // lib/seriesLookup.js's variantHintsFor) the requester has actually
  // logged a variant copy of, each as "number:guessedVariant" (e.g.
  // "71:reverse"). Two jobs: (1) tells getMasterSetEntries which cards
  // are worth a real per-card TCGdex detail fetch (targeted, not every
  // card in the set — see lib/tcgdexSetLookup.js), and (2) the guessed
  // variant itself gets unioned with whatever TCGdex reports, so a print
  // you've genuinely logged still shows up even when TCGdex's own
  // variants data hasn't caught up yet (real gap for very recently
  // released sets — confirmed via debug logging against "Chaos Rising":
  // TCGdex reported reverse:false for a card a real reverse holo copy
  // had already been logged for).
  const variantHints = (searchParams.get('variantNumbers') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const [number, variant] = s.split(':');
      return { number: (number || '').trim(), variant: (variant || '').trim() };
    })
    .filter((h) => h.number && h.variant);

  let result;
  try {
    result = await getMasterSetEntries(value, variantHints, loadCachedDetail);
  } catch (e) {
    console.error('pokemon-master-set: lookup failed', e);
    return NextResponse.json({ error: 'query_failed' }, { status: 502 });
  }

  if (result.error) {
    const status = result.error === 'no_series' ? 404 : 502;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ seriesName: result.seriesName, entries: result.entries });
}
