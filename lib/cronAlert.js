import { sendEmail } from '@/lib/resend';

// Best-effort failure notification for a scheduled cron job. Every cron
// route already logs real failures with console.error, but per
// CHANGELOG.md, Vercel's current plan only retains an hour of runtime
// logs — long enough to miss an overnight run's failure entirely unless
// someone happens to be looking at exactly the right time. This adds a
// second, durable channel: a plain email to Taylor whenever a cron
// actually breaks (a query fails, a fetch fails, required config is
// missing) — not on every stray unauthorized request a cron URL gets hit
// with, just genuine job failures. Reuses lib/resend.js the same way the
// account-deletion and feedback notifications already do.
//
// Deliberately silent (returns, doesn't throw) if ADMIN_EMAIL isn't set —
// callers shouldn't have to guard every call site against a Taylor who
// hasn't configured this yet, and there's nowhere else to send it.
export async function notifyCronFailure(jobName, error) {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return;
  const message = error instanceof Error ? error.message : String(error);
  try {
    await sendEmail({
      to: adminEmail,
      subject: `Shelf Life: ${jobName} cron failed`,
      html: `<p><strong>${jobName}</strong> failed during its scheduled run.</p><p>${message}</p>`,
      text: `${jobName} failed during its scheduled run.\n\n${message}`,
    });
  } catch (e) {
    // Best-effort, same rule as every other sendEmail call site — if the
    // failure notification itself can't send too (Resend/ADMIN_EMAIL
    // misconfigured, say), there's nothing more to do here without
    // risking a retry loop. Falls back to whatever's left of the runtime
    // logs.
    console.error('notifyCronFailure: failed to send alert', e);
  }
}
