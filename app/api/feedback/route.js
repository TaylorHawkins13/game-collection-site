import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabaseServer';
import { sendEmail } from '@/lib/resend';
import { checkFeedbackRateLimit } from '@/lib/feedbackRateLimit';

const TYPES = ['bug', 'issue', 'suggestion'];

// Public "contact us" endpoint — anyone can submit, logged in or not
// (the feedback table's insert policy allows it with no auth check).
// Every submission is saved to the database first, since that's the
// durable record; the email notification is best-effort on top of that
// so a Resend hiccup never loses a report.
export async function POST(request) {
  // Checked before anything else — an IP-based cap (see
  // lib/feedbackRateLimit.js), since most submitters here aren't signed
  // in, unlike comments/articles which can key their limit on user_id.
  const { limited } = await checkFeedbackRateLimit(request);
  if (limited) {
    return NextResponse.json(
      { error: "You're submitting too fast — wait a few minutes and try again." },
      { status: 429 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const type = TYPES.includes(body.type) ? body.type : 'suggestion';
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().slice(0, 320) : null;
  const pageUrl = typeof body.pageUrl === 'string' ? body.pageUrl.slice(0, 500) : null;

  if (!message) {
    return NextResponse.json({ error: 'Message is required.' }, { status: 400 });
  }
  if (message.length > 2000) {
    return NextResponse.json({ error: 'Message is too long (2000 characters max).' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user: viewer },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from('feedback').insert({
    user_id: viewer?.id || null,
    email: email || viewer?.email || null,
    type,
    message,
    page_url: pageUrl,
  });

  if (error) {
    console.error('Feedback insert failed', error);
    return NextResponse.json({ error: "Couldn't save your feedback, try again in a bit." }, { status: 500 });
  }

  // Fire-and-forget: the submission is already durably saved above, so a
  // failed notification email shouldn't turn into an error response for
  // whoever just submitted the form.
  try {
    const typeLabel = { bug: 'Bug report', issue: 'Issue', suggestion: 'Feature suggestion' }[type];
    const senderEmail = email || viewer?.email || null;
    await sendEmail({
      to: process.env.FEEDBACK_NOTIFY_EMAIL || 'shelflife.site@outlook.com',
      // So hitting "Reply" in your inbox goes straight back to whoever
      // submitted this, not to the site's own from-address. Omitted
      // entirely for anonymous submissions with no email left.
      ...(senderEmail ? { replyTo: senderEmail } : {}),
      subject: `Shelf Life feedback: ${typeLabel}`,
      text: [
        `Type: ${typeLabel}`,
        `From: ${senderEmail || 'anonymous'}`,
        pageUrl ? `Page: ${pageUrl}` : null,
        '',
        message,
      ]
        .filter(Boolean)
        .join('\n'),
    });
  } catch (e) {
    console.error('Feedback notification email failed (submission was still saved)', e);
  }

  return NextResponse.json({ ok: true });
}
