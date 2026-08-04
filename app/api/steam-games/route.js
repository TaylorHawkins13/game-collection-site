import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabaseServer';

// Returns the logged-in user's Steam library (via their saved SteamID64),
// for SteamImportModal to show as an import picklist. Requires the
// Steam profile's "Game details" privacy setting to be Public — Steam's
// API has no per-user auth token for this endpoint, so a private game
// list comes back empty (Steam doesn't distinguish "no games" from
// "hidden" in the response), which the client treats as the same case.
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
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
    include_appinfo: '1',
    include_played_free_games: '1',
    format: 'json',
  });

  let data;
  try {
    const res = await fetch(`https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?${params.toString()}`);
    if (!res.ok) {
      return NextResponse.json({ error: 'fetch_failed' }, { status: 502 });
    }
    data = await res.json();
  } catch {
    return NextResponse.json({ error: 'fetch_failed' }, { status: 502 });
  }

  const games = data.response?.games || [];
  const items = games.map((g) => ({
    appid: g.appid,
    name: g.name,
    playtime_forever: g.playtime_forever || 0,
    cover: `https://cdn.cloudflare.steamstatic.com/steam/apps/${g.appid}/library_600x900.jpg`,
  }));

  return NextResponse.json({ games: items });
}
