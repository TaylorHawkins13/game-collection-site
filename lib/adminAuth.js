// Every "admin-only" page/route in this app is a private page for
// exactly one person (Taylor, the site owner) — there's no multi-admin
// concept, so this deliberately isn't a role/permissions system, just a
// server-side comparison of the signed-in viewer's auth email against
// the ADMIN_EMAIL env var. Never trust a client-supplied claim of being
// the admin; always call this with a viewer object read from a
// server-side Supabase client's auth.getUser().
export function isAdminViewer(viewer) {
  const adminEmail = process.env.ADMIN_EMAIL;
  return !!adminEmail && !!viewer?.email && viewer.email.toLowerCase() === adminEmail.toLowerCase();
}
