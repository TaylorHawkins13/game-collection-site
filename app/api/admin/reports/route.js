import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabaseServer';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { isAdminViewer } from '@/lib/adminAuth';

export async function POST(request) {
  const supabase = await createClient();
  const {
    data: { user: viewer },
  } = await supabase.auth.getUser();

  if (!viewer || !isAdminViewer(viewer)) {
    // 404 rather than 401/403 — same reasoning as the page itself: don't
    // confirm to a non-admin caller that this endpoint exists at all.
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const { id, action } = body;
  if (!id || !['reviewed', 'actioned'].includes(action)) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('reports')
    .update({ status: action, reviewed_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'open'); // no-op if it's already been decided

  if (error) {
    console.error('Report decision failed', error);
    return NextResponse.json({ error: "Couldn't update that report." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
