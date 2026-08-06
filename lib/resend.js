// Thin wrapper around Resend's REST API — deliberately not the `resend`
// npm package, since a single `fetch` call to their HTTP API is all this
// app needs (two call sites: a feedback-submission notification, and the
// manual new-feature newsletter send), and it keeps the dependency list
// small. Server-only: RESEND_API_KEY is never sent to the browser.
//
// Every call site treats a failed send as non-fatal — a bug report or
// feedback submission should never be lost just because the notification
// email didn't go out, so callers should catch/ignore errors from this
// and fall back to "it's still saved in the database."
export async function sendEmail({ to, bcc, replyTo, subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    throw new Error('RESEND_NOT_CONFIGURED');
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: Array.isArray(to) ? to : [to],
      // Recipients of a broadcast-style send (the newsletter) shouldn't
      // see each other's addresses — bcc handles that, with `to` left
      // pointed at the sender's own address as the visible placeholder.
      ...(bcc && bcc.length ? { bcc } : {}),
      // Lets whoever reads the notification just hit "Reply" and land in
      // the original sender's inbox, instead of replying to the site's
      // own from-address (the feedback notification sets this to
      // whoever submitted the form).
      ...(replyTo ? { reply_to: replyTo } : {}),
      subject,
      html,
      text,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error('Resend send failed', res.status, body);
    throw new Error('RESEND_SEND_FAILED');
  }

  return res.json();
}
