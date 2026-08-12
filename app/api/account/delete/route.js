import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabaseServer';
import { createAdminClient } from '@/lib/supabaseAdmin';

// Deletes the caller's own account — and only their own. The user id
// comes from their own verified session (supabase.auth.getUser()),
// never from anything in the request body, so there's no way to point
// this at someone else's account.
//
// Two steps:
// 1. Best-effort wipe of their Storage files. Avatars and item/condition
//    photos aren't covered by the database's cascading deletes below —
//    Storage objects aren't real foreign-key rows, they just live in a
//    bucket at a path that happens to start with the user's id — so
//    they'd otherwise sit there orphaned forever even after the account
//    itself is gone.
// 2. Delete the auth.users row itself via the admin API. Per
//    supabase-schema.sql, profiles.id references auth.users(id) on
//    delete cascade, and every other table (games, comments, follows,
//    achievements, activity, notifications, passkeys, custom lists,
//    everything) references profiles(id) on delete cascade in turn —
//    so this one call is what actually removes the account and
//    everything in it.
//
// This exists specifically to satisfy Apple's App Store Guideline
// 5.1.1(v), which requires apps that support account creation to also
// offer *actual* in-app account deletion, not just deactivation.
// Irreversible on purpose — no grace period, no soft-delete.
//
// Built and compiles clean, but — like everything else in this sandbox
// that needs a live Supabase project — could not be exercised against
// real data here (no live credentials, and this is far too destructive
// to fake-test against production data anyway). Test this for real
// against a disposable test account before trusting it: sign up a
// throwaway account, add an item or two, upload an avatar, then delete
// it and confirm in the Supabase dashboard that the profile row,
// its games, and its Storage files are actually gone.
export async function POST() {
  const supabase = createClient();
  const {
    data: { user: viewer },
  } = await supabase.auth.getUser();
  if (!viewer) {
    return NextResponse.json({ error: 'You need to be signed in to do that.' }, { status: 401 });
  }

  const admin = createAdminClient();
  const uid = viewer.id;

  await removeAllUnderPrefix(admin, 'avatars', uid);
  await removeAllUnderPrefix(admin, 'item-photos', uid);

  const { error } = await admin.auth.admin.deleteUser(uid);
  if (error) {
    console.error('Account deletion failed', error);
    return NextResponse.json(
      { error: "Couldn't delete your account — try again, or contact support if it keeps failing." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
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
