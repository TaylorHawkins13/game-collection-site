import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabaseServer';
import { sendEmail } from '@/lib/resend';
import { SITE_URL } from '@/lib/siteUrl';

const TARGET_TYPES = ['comment', 'profile'];

// Lets a signed-in user report a comment or a profile — closes a real
// gap flagged in ROADMAP.md: there was no lever at all over bad content
// beyond Taylor finding it manually. Requires sign-in, unlike
// /api/feedback which is deliberately open to anyone — reports.reporter_id
// needs a real user to key RLS and the rate-limit trigger on (see
// report-migration.sql), and requiring sign-in also raises the bar for
// abusing the report system itself.
export async function POST(request) {
  const supabase = createClient();
  const {
    data: { user: viewer },
  } = await supabase.auth.getUser();

  if (!viewer) {
    return NextResponse.json({ error: 'You need to be signed in to report something.' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const targetType = TARGET_TYPES.includes(body.targetType) ? body.targetType : null;
  const targetId = typeof body.targetId === 'string' ? body.targetId : null;
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : null;

  if (!targetType || !targetId) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const { error } = await supabase.from('reports').insert({
    reporter_id: viewer.id,
    target_type: targetType,
    target_id: targetId,
    reason: reason || null,
  });

  if (error?.message?.includes('rate_limited')) {
    return NextResponse.json(
      { error: "You're reporting too fast — wait a few minutes and try again." },
      { status: 429 }
    );
  }
  if (error) {
    console.error('Report insert failed', error);
    return NextResponse.json({ error: "Couldn't save that report, try again in a bit." }, { status: 500 });
  }

  // Best-effort, same rule as every other notification email on the
  // site — the report is already durably saved above, so a Resend
  // hiccup shouldn't turn a successful report into an error response.
  try {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail) {
      await sendEmail({
        to: adminEmail,
        subject: `Shelf Life: new ${targetType} report`,
        text: [
          `A ${targetType} was just reported.`,
          `Reporter: ${viewer.email}`,
          `Target ID: ${targetId}`,
          reason ? `Reason: ${reason}` : null,
          '',
          `Review it: ${SITE_URL}/admin/reports`,
        ]
          .filter(Boolean)
          .join('\n'),
      });
    }
  } catch (e) {
    console.error('Report notification email failed (report was still saved)', e);
  }

  return NextResponse.json({ ok: true });
}
