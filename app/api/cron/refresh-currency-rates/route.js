import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { CURRENCIES } from '@/lib/currency';
import { notifyCronFailure } from '@/lib/cronAlert';
import { recordCronRun } from '@/lib/cronHeartbeat';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Runs weekly (see vercel.json's crons entry) and refreshes
// currency_rates_to_usd from a free, no-key rates API. Closes a real gap
// flagged in ROADMAP.md: the table was a one-time hand-typed snapshot
// (currency-aware-valuable-leaderboard-migration.sql) with no update
// mechanism at all, so it would only ever drift further from real
// exchange rates over time, with nothing to flag that it had. Weekly, not
// daily, on purpose — this only feeds the "Most valuable" leaderboard's
// *ranking* (see lib/currency.js's own comment: display is always a
// collector's own raw currency, never converted), so it doesn't need
// to-the-minute accuracy, just to not go stale for months at a time.
//
// frankfurter.app was picked because it needs no API key at all (ECB
// reference rates, updated daily on their end) and covers every currency
// in lib/currency.js's CURRENCIES list.
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
    await notifyCronFailure('refresh-currency-rates', e);
    return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  }

  // Every supported currency except USD itself, which stays a fixed 1 —
  // there's nothing to convert for the base currency, and the seed
  // migration already inserted it that way.
  const codes = CURRENCIES.map((c) => c.code).filter((c) => c !== 'USD');

  let data;
  try {
    const res = await fetch(`https://api.frankfurter.app/latest?from=USD&to=${codes.join(',')}`);
    if (!res.ok) throw new Error(`frankfurter responded ${res.status}`);
    data = await res.json();
  } catch (e) {
    console.error('refresh-currency-rates: fetch failed', e);
    await notifyCronFailure('refresh-currency-rates', e);
    await recordCronRun(admin, 'refresh-currency-rates', 'error');
    return NextResponse.json({ error: 'fetch_failed' }, { status: 502 });
  }

  const rates = data?.rates || {};
  let updated = 0;
  let skipped = 0;

  for (const code of codes) {
    // frankfurter's rates[code] (with `from=USD`) is "how many <code> per
    // 1 USD" — currency_rates_to_usd stores the opposite direction (how
    // many USD per 1 <code>), so this inverts it.
    const usdToCode = rates[code];
    if (!usdToCode || usdToCode <= 0) {
      skipped += 1;
      continue;
    }
    const { error } = await admin
      .from('currency_rates_to_usd')
      .upsert({ code, rate_to_usd: 1 / usdToCode, updated_at: new Date().toISOString() }, { onConflict: 'code' });
    if (error) {
      console.error(`refresh-currency-rates: failed to update ${code}`, error);
      skipped += 1;
    } else {
      updated += 1;
    }
  }

  await recordCronRun(admin, 'refresh-currency-rates', updated > 0 ? 'success' : 'error');
  return NextResponse.json({ updated, skipped, total: codes.length });
}
