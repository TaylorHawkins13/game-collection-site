// Every scheduled job Shelf Life runs, for the "Cron jobs" section on
// /admin/stats. A single source of truth so a newly added cron shows up
// there automatically instead of needing a second place remembered.
export const CRON_JOBS = [
  { name: 'price-drop-check', label: 'Price-drop check', schedule: 'Daily' },
  { name: 'process-account-deletions', label: 'Account deletions', schedule: 'Daily' },
  { name: 'refresh-currency-rates', label: 'Currency rates refresh', schedule: 'Weekly (Mon)' },
  { name: 'weekly-stats-digest', label: 'Weekly stats digest', schedule: 'Weekly (Sun)' },
];

// Records a job's last run (and, on success, last success) — see
// cron-heartbeat-migration.sql. Deliberately just a visibility layer:
// this can tell you a job ran and what happened, but can't catch a job
// that stops running entirely, since nothing calls this if the job never
// fires at all. That gap needs an external dead-man's-switch service
// watching from outside Vercel (see ROADMAP.md's "External cron
// watchdog" entry). Best-effort — a heartbeat failure shouldn't affect
// the cron's own real work, which has already finished by the time this
// is called.
export async function recordCronRun(admin, jobName, status) {
  try {
    const now = new Date().toISOString();
    await admin.from('cron_runs').upsert(
      {
        job_name: jobName,
        last_run_at: now,
        last_status: status,
        updated_at: now,
        // Only included on a successful run — upsert only overwrites the
        // columns actually present in the payload, so an error run
        // leaves whatever last_success_at was already there untouched
        // rather than clobbering it.
        ...(status === 'success' ? { last_success_at: now } : {}),
      },
      { onConflict: 'job_name' }
    );
  } catch (e) {
    console.error(`recordCronRun: failed to record heartbeat for ${jobName}`, e);
  }
}
