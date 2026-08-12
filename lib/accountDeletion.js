// How long an account sits in "scheduled for deletion" after someone
// requests it before the actual, irreversible cleanup runs (see
// app/api/cron/process-account-deletions). Shared constant so the
// request route, the cron job, and the UI copy/countdown all agree on
// the same window.
export const GRACE_PERIOD_HOURS = 48;

// Takes an already-constructed service-role admin client (see
// lib/supabaseAdmin.js) rather than creating one itself, so this file
// has no server-only imports of its own — safe to import GRACE_PERIOD_HOURS
// above from client components too. Deletes everything under
// `<bucket>/<prefix>/` in Supabase Storage, then deletes the auth.users
// row itself, which cascades through every table that references
// profiles(id) on delete cascade per supabase-schema.sql. Called from
// app/api/cron/process-account-deletions once an account's grace period
// has actually expired — this used to run immediately, straight from
// app/api/account/delete, back when deletion had no grace period.
export async function performAccountDeletion(admin, uid) {
  await removeAllUnderPrefix(admin, 'avatars', uid);
  await removeAllUnderPrefix(admin, 'item-photos', uid);
  return admin.auth.admin.deleteUser(uid);
}

// Recursively lists and removes everything under `<bucket>/<prefix>/`.
// Storage's list() only returns one level at a time, and item-photos
// nests a game-id folder under the user-id folder
// (item-photos/<uid>/<game_id>/<uuid>.<ext>), so this has to walk down
// a level before it finds actual files to remove — avatars are flat
// (avatars/<uid>/avatar.<ext>) and resolve in a single pass. Best-effort
// throughout: a Storage failure here shouldn't block the account
// deletion itself, which is the part that actually matters.
async function removeAllUnderPrefix(admin, bucket, prefix) {
  try {
    const { data: entries } = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
    if (!entries || entries.length === 0) return;

    // A real file has an `id` (and metadata); a "folder" is really just
    // a grouping Storage infers from the path and has neither.
    const files = entries.filter((e) => e.id);
    const folders = entries.filter((e) => !e.id);

    if (files.length > 0) {
      await admin.storage.from(bucket).remove(files.map((f) => `${prefix}/${f.name}`));
    }
    for (const folder of folders) {
      await removeAllUnderPrefix(admin, bucket, `${prefix}/${folder.name}`);
    }
  } catch (err) {
    console.error(`Storage cleanup failed for ${bucket}/${prefix}`, err);
  }
}
