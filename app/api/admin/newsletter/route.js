import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabaseServer';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { isAdminViewer } from '@/lib/adminAuth';
import { sendEmail } from '@/lib/resend';

// Never trust the fact that a request merely reached this route — the
// admin gate is re-checked here from a server-side session read, exactly
// like the page at app/admin/newsletter/page.js does, since a route
// handler is a separate request with no shared React state to lean on.
export async function POST(request) {
  const supabase = createClient();
  const {
    data: { user: viewer },
  } = await supabase.auth.getUser();

  if (!viewer || !isAdminViewer(viewer)) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
  const text = typeof body.body === 'string' ? body.body.trim() : '';
  // Deliberately every-user override — for a one-off "here's what's new
  // and when the app's landing" announcement, not a general escape hatch.
  // The normal, default path stays opted-in-only; this only fires when
  // the admin form's checkbox was explicitly ticked.
  const sendToAll = body.sendToAll === true;
  if (!subject || !text) {
    return NextResponse.json({ error: 'Subject and body are required.' }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not set — add it in Vercel env vars.' }, { status: 500 });
  }

  let recipientQuery = admin.from('profiles').select('id');
  if (!sendToAll) {
    recipientQuery = recipientQuery.eq('newsletter_opt_in', true);
  }
  const { data: recipients, error: profilesError } = await recipientQuery;

  if (profilesError) {
    console.error('Newsletter: profiles fetch failed', profilesError);
    return NextResponse.json({ error: "Couldn't load the recipient list." }, { status: 500 });
  }
  if (!recipients || recipients.length === 0) {
    return NextResponse.json({ error: sendToAll ? 'No accounts to send to.' : 'No one is opted in.' }, { status: 400 });
  }

  // profiles has no email column (auth emails live in auth.users only,
  // see lib/supabaseAdmin.js) — one admin lookup per opted-in id. Fine at
  // this site's scale; would need auth.admin.listUsers() pagination
  // instead if the opted-in list ever gets into the thousands.
  const emails = [];
  for (const p of recipients) {
    try {
      const { data, error } = await admin.auth.admin.getUserById(p.id);
      if (!error && data?.user?.email) emails.push(data.user.email);
    } catch (e) {
      console.error('Newsletter: getUserById failed', p.id, e);
    }
  }

  if (emails.length === 0) {
    return NextResponse.json({ error: "Couldn't resolve any recipient email addresses." }, { status: 500 });
  }

  try {
    await sendEmail({
      to: process.env.RESEND_FROM_EMAIL,
      bcc: emails,
      subject,
      text,
    });
  } catch (e) {
    console.error('Newsletter send failed', e);
    return NextResponse.json({ error: "Send failed — check RESEND_API_KEY/RESEND_FROM_EMAIL are set." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, count: emails.length });
}
