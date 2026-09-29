import { NextResponse } from 'next/server';

// TEMPORARY diagnostic route — not part of the feature, will be deleted
// before this branch is considered done. Proxies the raw Rebrickable
// minifigs response verbatim so the real field shape can be confirmed
// against live data instead of assumed, after fetchLegoMinifigs came back
// with an unexpectedly empty minifigs array for a set (71043 Hogwarts
// Castle) that definitely has cataloged minifigs on Rebrickable.
export async function GET(request) {
  const key = process.env.REBRICKABLE_API_KEY || '';
  if (!key) return NextResponse.json({ error: 'not_configured' });
  const { searchParams } = new URL(request.url);
  const setNum = searchParams.get('setNum') || '71043-1';
  const res = await fetch(`https://rebrickable.com/api/v3/lego/sets/${encodeURIComponent(setNum)}/minifigs/?page_size=5`, {
    headers: { Authorization: `key ${key}`, Accept: 'application/json' },
  });
  const text = await res.text();
  return NextResponse.json({ status: res.status, body: text.slice(0, 3000) });
}
