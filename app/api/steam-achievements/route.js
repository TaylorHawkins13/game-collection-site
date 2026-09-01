import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabaseServer';

// Returns the logged-in user's achievement completion % for one
// Steam-imported game (by appid), so it can be synced into that game's
// trophy_completion field automatically instead of typed in by hand.
// Same privacy constraint as GetOwnedGames: the account's "Game details"
// privacy setting has to be Public, or this comes back empty.
export async function GET(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const appid = searchParams.get('appid');
  if (!appid) {
    return NextResponse.json({ error: 'missing_appid' }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('steam_id')
    .eq('id', user.id)
    .single();
  if (!profile?.steam_id) {
    return NextResponse.json({ error: 'not_connected' }, { status: 400 });
  }

  const apiKey = process.env.STEAM_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'not_configured' }, { status: 500 });
  }

  const params = new URLSearchParams({
    key: apiKey,
    steamid: profile.steam_id,
    appid,
    format: 'json',
  });

  let data;
  try {
    const res = await fetch(`https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v1/?${params.toString()}`);
    if (!res.ok) {
      // Steam returns a non-200 (usually 400) for games with no
      // achievements at all, or a private profile — not a real failure,
      // just "nothing to sync for this one."
      return NextResponse.json({ error: 'no_achievements' });
    }
    data = await res.json();
  } catch {
    return NextResponse.json({ error: 'fetch_failed' }, { status: 502 });
  }

  const stats = data.playerstats;
  const achievements = stats?.achievements;
  if (!stats?.success || !achievements || achievements.length === 0) {
    return NextResponse.json({ error: 'no_achievements' });
  }

  const achieved = achievements.filter((a) => a.achieved === 1).length;
  const percent = Math.round((achieved / achievements.length) * 100);

  return NextResponse.json({
    percent,
    achieved,
    total: achievements.length,
    platinum: percent === 100,
  });
}
