import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabaseServer';

// "Download my data" — the natural companion to self-service account
// deletion (a "here's a copy before it's all gone" step) and closes a
// real gap flagged in ROADMAP.md: the existing "Export CSV" only ever
// covered collection items, nothing else the site stores about someone.
// Deliberately doesn't repeat collection items here — that's what Export
// CSV is for — this is everything else: profile, comments written and
// received, follows, activity feed entries, and trophies.
//
// Every table queried here is already scoped to the caller's own
// user_id/author_id by existing RLS policies (see supabase-schema.sql),
// so this runs entirely through the normal cookie-based client — no
// admin/service-role client needed, unlike most of the site's other
// admin-ish routes.
export async function GET() {
  const supabase = createClient();
  const {
    data: { user: viewer },
  } = await supabase.auth.getUser();

  if (!viewer) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  const [
    { data: profile },
    { data: commentsWritten },
    { data: commentsReceived },
    { data: following },
    { data: followers },
    { data: activity },
    { data: trophies },
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', viewer.id).single(),
    supabase
      .from('comments')
      .select('id, profile_id, body, created_at')
      .eq('author_id', viewer.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('comments')
      .select('id, body, created_at, author:profiles!comments_author_id_fkey(username, display_name)')
      .eq('profile_id', viewer.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('follows')
      .select('created_at, following:profiles!follows_following_id_fkey(username, display_name)')
      .eq('follower_id', viewer.id),
    supabase
      .from('follows')
      .select('created_at, follower:profiles!follows_follower_id_fkey(username, display_name)')
      .eq('following_id', viewer.id),
    supabase
      .from('activity_events')
      .select('event_type, game_id, trophy_key, created_at')
      .eq('user_id', viewer.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('user_achievements')
      .select('key, earned_at, achievement:achievement_defs(name, description, tier)')
      .eq('user_id', viewer.id),
  ]);

  const exportData = {
    exported_at: new Date().toISOString(),
    account_email: viewer.email,
    profile: profile || null,
    comments_written: commentsWritten || [],
    comments_received: commentsReceived || [],
    following: (following || []).map((f) => ({ since: f.created_at, ...f.following })),
    followers: (followers || []).map((f) => ({ since: f.created_at, ...f.follower })),
    activity: activity || [],
    trophies: trophies || [],
    note: 'Collection items aren\'t included here — use "Export CSV" in Settings for those.',
  };

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="shelf-life-data-export.json"`,
    },
  });
}
