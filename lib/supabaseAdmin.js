import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Service-role client — bypasses RLS entirely, so this must never be
// imported into anything that runs in the browser (no 'use client' file
// should ever touch this). Kept in its own file rather than a helper in
// supabaseServer.js so it's easy to grep for every place this elevated
// access is actually used: every cron job under app/api/cron (none of
// them have a signed-in user to scope a normal client to, and several —
// price-drop-check, email-data-backup — need to read across every
// collector, not just one), plus a couple of admin-only routes that need
// auth.users' email addresses (the opt-in newsletter send,
// email-data-backup's per-recipient lookup) — lib/supabaseServer.js's
// normal session-scoped client can't see auth.users, by design, since RLS
// on the public schema has nothing to do with it, the auth schema just
// isn't exposed to it.
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY_NOT_CONFIGURED');
  }
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
