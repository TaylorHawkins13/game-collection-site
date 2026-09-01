import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { authenticateApiRequest } from '@/lib/apiAuth';
import { checkApiRateLimit } from '@/lib/apiRateLimit';
import { EXPORT_COLUMNS } from '@/lib/csvExport';

// GET /api/v1/collection[?type=video_game][&ownership=owned] — the
// token owner's collection as JSON. ROADMAP.md deliberately scoped this
// to "probably a read-only mirror of what's already visible via the
// existing RLS rules, nothing new" — so the field list is exactly
// lib/csvExport.js's EXPORT_COLUMNS (the same shape "Export CSV" already
// hands the signed-in owner), not a new, separately-maintained column
// list that could quietly drift from what the owner can already see
// about their own items.
const SELECT_COLUMNS = ['id', ...EXPORT_COLUMNS].join(',');

export async function GET(req) {
  const auth = await authenticateApiRequest(req);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { limited } = await checkApiRateLimit(auth.tokenId);
  if (limited) {
    return NextResponse.json({ error: 'Rate limit exceeded — try again in a minute.' }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type');
  const ownership = searchParams.get('ownership');

  // Admin client, manually scoped — see app/api/v1/me/route.js's comment.
  // A token request has no session for RLS to narrow this by itself.
  let query = createAdminClient().from('games').select(SELECT_COLUMNS).eq('user_id', auth.userId);
  if (type) query = query.eq('item_type', type);
  if (ownership) query = query.eq('ownership', ownership);

  const { data, error } = await query.order('title');
  if (error) {
    return NextResponse.json({ error: 'Could not load collection.' }, { status: 500 });
  }

  return NextResponse.json({ count: data.length, items: data });
}
