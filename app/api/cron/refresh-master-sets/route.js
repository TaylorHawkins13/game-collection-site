import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { findSetIdByName, fetchSetCards, fetchDetailsForCards } from '@/lib/tcgdexSetLookup';
import { notifyCronFailure } from '@/lib/cronAlert';
import { recordCronRun } from '@/lib/cronHeartbeat';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Runs weekly (see vercel.json's crons entry) and pre-fetches real
// per-card TCGdex variant data for Pokémon sets people have actually
// logged trading cards from — see master_set_cache in
// supabase-schema.sql and lib/tcgdexSetLookup.js's module comment for
// the full reasoning. Closes ROADMAP.md's "Pokémon master sets: show
// variants you don't own yet": once a set has a fresh cache row,
// /api/pokemon-master-set shows every card's real variants, not just
// ones the requester happens to already own.
//
// Only refreshes sets someone here has actually logged a card from
// (distinct `card_set` values on trading_card rows) rather than every
// Pokémon set TCGdex has ever catalogued — most of which nobody on Shelf
// Life owns anything from, so pre-fetching them would just be wasted
// calls against a free, community-run API. `card_set` is free-typed, so
// a value that doesn't resolve to a real TCGdex set (a typo, or — very
// likely — a Magic set name, which this cache doesn't cover at all,
// see lib/scryfallSetLookup.js) is just skipped, same as a live request
// hitting `no_series` would.
//
// Capped at MAX_SETS_PER_RUN fresh/stale sets per run, and skips
// anything refreshed within STALE_AFTER_DAYS — a full 100-250+ card set
// refresh (fetchDetailsForCards, concurrency-limited) takes real time and
// real calls against TCGdex, so this deliberately spreads coverage across
// multiple weekly runs rather than trying to do everything in one go.
// A brand-new set someone just started logging might take a couple of
// weeks to get its first cache row; that's fine — the narrow, no-cache
// live path (lib/tcgdexSetLookup.js) still works the whole time, it's
// just not showing every variant yet.
const MAX_SETS_PER_RUN = 5;
const STALE_AFTER_DAYS = 30;

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  }
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    await notifyCronFailure('refresh-master-sets', e);
    return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  }

  // No clean server-side DISTINCT via supabase-js — fetches every
  // trading_card row's card_set and dedupes in JS instead. Fine at this
  // app's scale, same tradeoff lib/seriesCrowdsource.js's own comment
  // already documents for a very similar query.
  const { data: rows, error } = await admin
    .from('games')
    .select('card_set')
    .eq('item_type', 'trading_card')
    .not('card_set', 'is', null);

  if (error) {
    console.error('refresh-master-sets: failed to load card_set values', error);
    await notifyCronFailure('refresh-master-sets', error);
    await recordCronRun(admin, 'refresh-master-sets', 'error');
    return NextResponse.json({ error: 'query_failed' }, { status: 500 });
  }

  const cardSetValues = Array.from(
    new Set((rows || []).map((r) => (r.card_set || '').trim()).filter(Boolean))
  );

  const staleBefore = new Date(Date.now() - STALE_AFTER_DAYS * 24 * 60 * 60 * 1000).toISOString();
  let refreshed = 0;
  let skippedFresh = 0;
  let skippedNotFound = 0;
  let failed = 0;
  let processed = 0;

  for (const value of cardSetValues) {
    if (processed >= MAX_SETS_PER_RUN) break;

    const set = await findSetIdByName(value);
    if (!set) {
      // Not a TCGdex/Pokémon set — most commonly a Magic set name (see
      // module comment), sometimes just a typo. Doesn't count toward
      // this run's cap since no TCGdex calls were spent on it.
      skippedNotFound += 1;
      continue;
    }

    const { data: existing } = await admin
      .from('master_set_cache')
      .select('refreshed_at')
      .eq('set_id', set.id)
      .maybeSingle();
    if (existing?.refreshed_at && existing.refreshed_at > staleBefore) {
      skippedFresh += 1;
      continue;
    }

    processed += 1;
    try {
      const cards = await fetchSetCards(set.id);
      if (!cards.length) {
        failed += 1;
        continue;
      }
      const detailById = await fetchDetailsForCards(cards, { concurrency: 8 });
      // Minimal storage shape — only the `variants` flags each card
      // needs (see lib/tcgdexSetLookup.js's buildEntries/
      // variantKeysForCard), not the full TCGdex card detail, to keep
      // the cached row small.
      const entries = {};
      for (const card of cards) {
        if (!card?.id) continue;
        const detail = detailById.get(card.id);
        entries[card.id] = { variants: detail?.variants || null };
      }
      const { error: upsertError } = await admin.from('master_set_cache').upsert(
        {
          set_id: set.id,
          set_name: set.name,
          entries,
          refreshed_at: new Date().toISOString(),
        },
        { onConflict: 'set_id' }
      );
      if (upsertError) {
        console.error(`refresh-master-sets: failed to cache ${set.id}`, upsertError);
        failed += 1;
      } else {
        refreshed += 1;
      }
    } catch (e) {
      console.error(`refresh-master-sets: failed to build cache for ${set.id}`, e);
      failed += 1;
    }
  }

  await recordCronRun(admin, 'refresh-master-sets', 'success');
  return NextResponse.json({
    totalSets: cardSetValues.length,
    refreshed,
    skippedFresh,
    skippedNotFound,
    failed,
  });
}
