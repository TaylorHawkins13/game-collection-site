import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Service-role client — bypasses RLS entirely, so this must never be
// imported into anything that runs in the browser (no 'use client' file
// should ever touch this). Kept in its own file rather than a helper in
// supabaseServer.js so it's easy to grep for every place this elevated
// access is actually used. Two deliberately narrow uses so far:
// - Reading auth.users' email addresses for the opt-in newsletter send
//   (lib/supabaseServer.js's normal session-scoped client can't see
//   auth.users, by design — RLS on the public schema has nothing to do
//   with it, the auth schema just isn't exposed to it).
// - The price-drop-check cron job (app/api/cron/price-drop-check), which
//   has no signed-in user to scope a normal client to and needs to read
//   wishlist items across every collector, not just one.
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY_NOT_CONFIGURED');
  }
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
