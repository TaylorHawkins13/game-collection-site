import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { buildPriceQuery } from '@/lib/marketPrice';
import { marketplaceForCurrency } from '@/lib/ebayMarketplace';
import { SITE_URL } from '@/lib/siteUrl';
import { notifyCronFailure } from '@/lib/cronAlert';
import { recordCronRun } from '@/lib/cronHeartbeat';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Runs once a day (see vercel.json's crons entry) and checks every
// wishlist item across every user that has a price_alert_threshold set,
// notifying whoever owns it the moment it first dips at or below that
// threshold. Needs the service-role client — a cron job has no signed-in
// user, so this is the second (of two, deliberately narrow) places in the
// codebase that bypasses RLS; see lib/supabaseAdmin.js.
//
// price_alert_active is a simple two-state flag: it flips true the first
// time the price dips below threshold (and a notification goes out), and
// flips back false once the price rises back above it — so a title that
// stays cheap for a week doesn't re-notify every single day, but a real
// second dip (price recovers, then drops again) does.
async function checkOne(supabase, item) {
  const query = buildPriceQuery(item);
  if (!query) return { skipped: true };

  // The eBay check below always runs in the profile's *current* currency
  // (marketplaceForCurrency, right below) and compares the raw number it
  // gets back directly against item.price_alert_threshold — with no
  // conversion. That was already silently assuming the threshold was set
  // in that same currency; price_alert_threshold_currency (see
  // pricecurrency-migration.sql/ROADMAP.md) now makes it possible to
  // actually check that assumption instead of just hoping it holds. A
  // mismatch means someone set this alert while their currency was
  // something else and has since switched Settings > Currency — comparing
  // the two raw numbers across currencies would be comparing apples to
  // oranges (a "25" GBP threshold isn't the same amount as a "25" USD
  // one), so this skips the comparison entirely rather than risk a wrong
  // notification. Real currency conversion is the bigger, separate
  // ROADMAP.md item ("Live currency conversion") this doesn't attempt to
  // solve — skipping is the safe stopgap until that exists.
  if (item.price_alert_threshold_currency && item.price_alert_threshold_currency !== item.profiles?.currency) {
    return { skipped: true, currencyMismatch: true };
  }

  const marketplace = marketplaceForCurrency(item.profiles?.currency || 'USD');
  const url = `${SITE_URL}/api/ebay-price?q=${encodeURIComponent(query)}&title=${encodeURIComponent(item.title)}&marketplace=${marketplace}&itemType=${encodeURIComponent(item.item_type || '')}`;

  let data;
  try {
    const res = await fetch(url);
    data = await res.json();
  } catch {
    return { error: true };
  }
  if (data.error || !data.count) return { noData: true };

  await supabase
    .from('games')
    .update({
      market_price: data.avg,
      market_price_checked_at: new Date().toISOString(),
      market_price_currency: data.currency || 'USD',
    })
    .eq('id', item.id);

  const isBelow = data.avg <= Number(item.price_alert_threshold);

  if (isBelow && !item.price_alert_active) {
    await supabase.from('games').update({ price_alert_active: true }).eq('id', item.id);
    await supabase.from('notifications').insert({
      user_id: item.user_id,
      actor_id: null,
      type: 'price_drop',
      game_id: item.id,
    });
    return { notified: true };
  }

  if (!isBelow && item.price_alert_active) {
    await supabase.from('games').update({ price_alert_active: false }).eq('id', item.id);
  }

  return { checked: true };
}

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  }
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let supabase;
  try {
    supabase = createAdminClient();
  } catch (e) {
    await notifyCronFailure('price-drop-check', e);
    return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  }

  const { data: items, error } = await supabase
    .from('games')
    .select(
      'id, user_id, title, item_type, copy_type, completeness, card_set, format, issue_number, card_number, price_alert_threshold, price_alert_threshold_currency, price_alert_active, profiles!inner(currency)'
    )
    .eq('ownership', 'wishlist')
    .not('price_alert_threshold', 'is', null);

  if (error) {
    console.error('price-drop-check: failed to load wishlist items', error);
    await notifyCronFailure('price-drop-check', error);
    await recordCronRun(supabase, 'price-drop-check', 'error');
    return NextResponse.json({ error: 'query_failed' }, { status: 500 });
  }

  let notified = 0;
  let checked = 0;
  let currencyMismatches = 0;
  for (const item of items || []) {
    const result = await checkOne(supabase, item);
    if (result.notified) notified += 1;
    if (result.checked || result.notified) checked += 1;
    if (result.currencyMismatch) currencyMismatches += 1;
  }

  await recordCronRun(supabase, 'price-drop-check', 'success');
  return NextResponse.json({ total: (items || []).length, checked, notified, currencyMismatches });
}
