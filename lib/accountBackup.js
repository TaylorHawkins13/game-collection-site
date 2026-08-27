import Papa from 'papaparse';
import { gamesToCsvRows } from './csvExport';

// Builds the same two backups a signed-in user can already pull manually
// (Settings > Data > "Export CSV" and "Download my data"), but from a
// service-role client scoped by an explicit userId instead of a
// cookie-based session — the shape the opt-in email backup cron
// (app/api/cron/email-data-backup) needs, since a cron run has no signed-in
// user to rely on RLS for. Deliberately reuses the exact same column
// mapping (lib/csvExport.js's gamesToCsvRows/EXPORT_COLUMNS) and JSON
// shape (mirroring app/api/account/export/route.js's query) so the two
// manual downloads and the automated email never quietly drift apart.
//
// `accountEmail` is passed in rather than looked up again here — the
// caller already needs an admin.auth.admin.getUserById() lookup of its
// own to know where to actually send the email (profiles has no email
// column, see lib/supabaseAdmin.js), so this avoids doing that lookup
// twice.
//
// Every query here is explicitly scoped by `userId` — this runs against
// the service-role client (see lib/supabaseAdmin.js), which bypasses RLS
// entirely, so getting that scoping right is the whole safety story.
export async function buildAccountBackup(supabase, userId, accountEmail) {
  const [
    { data: games },
    { data: profile },
    { data: commentsWritten },
    { data: commentsReceived },
    { data: following },
    { data: followers },
    { data: activity },
    { data: trophies },
  ] = await Promise.all([
    supabase.from('games').select('*').eq('user_id', userId),
    supabase.from('profiles').select('*').eq('id', userId).single(),
    supabase
      .from('comments')
      .select('id, profile_id, body, created_at')
      .eq('author_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('comments')
      .select('id, body, created_at, author:profiles!comments_author_id_fkey(username, display_name)')
      .eq('profile_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('follows')
      .select('created_at, following:profiles!follows_following_id_fkey(username, display_name)')
      .eq('follower_id', userId),
    supabase
      .from('follows')
      .select('created_at, follower:profiles!follows_follower_id_fkey(username, display_name)')
      .eq('following_id', userId),
    supabase
      .from('activity_events')
      .select('event_type, game_id, trophy_key, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('user_achievements')
      .select('key, earned_at, achievement:achievement_defs(name, description, tier)')
      .eq('user_id', userId),
  ]);

  const csv = games && games.length > 0 ? Papa.unparse(gamesToCsvRows(games)) : '';

  const exportData = {
    exported_at: new Date().toISOString(),
    account_email: accountEmail || null,
    profile: profile || null,
    comments_written: commentsWritten || [],
    comments_received: commentsReceived || [],
    following: (following || []).map((f) => ({ since: f.created_at, ...f.following })),
    followers: (followers || []).map((f) => ({ since: f.created_at, ...f.follower })),
    activity: activity || [],
    trophies: trophies || [],
    note: 'Collection items are in the attached CSV, not this JSON file.',
  };

  return {
    itemCount: (games || []).length,
    csv,
    json: JSON.stringify(exportData, null, 2),
  };
}
