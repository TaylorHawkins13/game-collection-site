import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { buildPriceQuery } from '@/lib/marketPrice';
import { marketplaceForCurrency } from '@/lib/ebayMarketplace';
import { SITE_URL } from '@/lib/siteUrl';

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

  const marketplace = marketplaceForCurrency(item.profiles?.currency || 'USD');
  const url = `${SITE_URL}/api/ebay-price?q=${encodeURIComponent(query)}&title=${encodeURIComponent(item.title)}&marketplace=${marketplace}`;

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
  } catch {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  }

  const { data: items, error } = await supabase
    .from('games')
    .select(
      'id, user_id, title, item_type, copy_type, completeness, card_set, format, issue_number, card_number, price_alert_threshold, price_alert_active, profiles!inner(currency)'
    )
    .eq('ownership', 'wishlist')
    .not('price_alert_threshold', 'is', null);

  if (error) {
    console.error('price-drop-check: failed to load wishlist items', error);
    return NextResponse.json({ error: 'query_failed' }, { status: 500 });
  }

  let notified = 0;
  let checked = 0;
  for (const item of items || []) {
    const result = await checkOne(supabase, item);
    if (result.notified) notified += 1;
    if (result.checked || result.notified) checked += 1;
  }

  return NextResponse.json({ total: (items || []).length, checked, notified });
}
