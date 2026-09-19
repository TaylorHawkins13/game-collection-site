// Pings an external dead-man's-switch service (healthchecks.io, Cronitor,
// or anything using the same ping-URL convention) after each cron run, so
// something catches a job that stops firing *entirely* — a vercel.json
// misconfiguration, a broken build, a Vercel Cron outage — none of which
// ever reach recordCronRun() in lib/cronHeartbeat.js, since nothing runs
// to record anything in that scenario. See ROADMAP.md's "External cron
// watchdog" entry for the full background (the CRON_SECRET-never-set
// incident, Sep 2026, is exactly the failure mode this closes).
//
// CRON_WATCHDOG_URLS is a single JSON-object env var mapping each job's
// name (matching lib/cronHeartbeat.js's CRON_JOBS entries exactly) to its
// ping URL, e.g.:
//   {"price-drop-check": "https://hc-ping.com/<uuid-1>",
//    "process-account-deletions": "https://hc-ping.com/<uuid-2>", ...}
// One var instead of eight so adding, removing, or re-pointing a job's
// watchdog is a single edit in Vercel rather than eight. Deliberately
// silent (no-op) if the env var isn't set yet, or has no entry for this
// particular job — same "don't make every call site guard against an
// unconfigured Taylor" rule lib/cronAlert.js already follows, so this is
// safe to leave wired in permanently even before the watchdog service
// itself is set up.
//
// healthchecks.io convention: GETting the bare ping URL signals success;
// appending "/fail" signals a known failure immediately, without waiting
// out the job's configured grace period. Cronitor's telemetry ping URLs
// follow the same state-suffix shape, so this works unmodified for
// either provider — whichever one Taylor actually signs up with.
export async function pingWatchdog(jobName, status) {
  let urls;
  try {
    urls = JSON.parse(process.env.CRON_WATCHDOG_URLS || '{}');
  } catch (e) {
    console.error('pingWatchdog: CRON_WATCHDOG_URLS is not valid JSON', e);
    return;
  }

  const baseUrl = urls[jobName];
  if (!baseUrl) return;

  const pingUrl = status === 'success' ? baseUrl : `${baseUrl}/fail`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    await fetch(pingUrl, { method: 'GET', signal: controller.signal });
    clearTimeout(timeout);
  } catch (e) {
    // Best-effort, same rule as recordCronRun and notifyCronFailure — a
    // watchdog ping failing shouldn't affect the cron's own real work,
    // which has already finished running by the time this is called.
    console.error(`pingWatchdog: failed to ping watchdog for ${jobName}`, e);
  }
}
