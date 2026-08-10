import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabaseServer';
import { sendEmail } from '@/lib/resend';

const TYPES = ['review', 'article'];

// Signed-in-only submission endpoint — the article_submissions insert
// policy requires user_id = auth.uid(), so an anonymous request would be
// rejected by RLS anyway; checking here first just gives a clean 401
// instead of a raw database error.
export async function POST(request) {
  const supabase = createClient();
  const {
    data: { user: viewer },
  } = await supabase.auth.getUser();
  if (!viewer) {
    return NextResponse.json({ error: 'You need to be signed in to submit something.' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const type = TYPES.includes(body.type) ? body.type : 'article';
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 200) : '';
  const dek = typeof body.dek === 'string' ? body.dek.trim().slice(0, 200) : '';
  const articleBody = typeof body.body === 'string' ? body.body.trim().slice(0, 8000) : '';
  const rating =
    type === 'review' && Number.isInteger(body.rating) && body.rating >= 1 && body.rating <= 5 ? body.rating : null;

  if (!title || !dek || !articleBody) {
    return NextResponse.json({ error: 'Title, summary, and body are all required.' }, { status: 400 });
  }
  if (articleBody.length < 200) {
    return NextResponse.json({ error: 'Body is too short (200 characters min).' }, { status: 400 });
  }

  const { error } = await supabase.from('article_submissions').insert({
    user_id: viewer.id,
    type,
    title,
    dek,
    body: articleBody,
    rating,
  });

  if (error) {
    if (error.message?.includes('rate_limited')) {
      return NextResponse.json(
        { error: "You're submitting too fast — wait a few minutes and try again." },
        { status: 429 }
      );
    }
    console.error('Article submission insert failed', error);
    return NextResponse.json({ error: "Couldn't save your submission, try again in a bit." }, { status: 500 });
  }

  // Best-effort — same pattern as the feedback notification: the
  // submission is already durably saved above, so a failed email here
  // shouldn't turn into an error response for the person submitting.
  try {
    await sendEmail({
      to: process.env.ADMIN_EMAIL || process.env.FEEDBACK_NOTIFY_EMAIL || 'shelflife.site@outlook.com',
      subject: `New article submission: ${title}`,
      text: [
        `Type: ${type}`,
        `From: ${viewer.email}`,
        '',
        `"${title}"`,
        dek,
        '',
        'Review it at /admin/articles.',
      ].join('\n'),
    });
  } catch (e) {
    console.error('Article submission notification email failed (submission was still saved)', e);
  }

  return NextResponse.json({ ok: true });
}
