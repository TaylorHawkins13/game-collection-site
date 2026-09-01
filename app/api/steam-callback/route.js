import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabaseServer';
import { SITE_URL } from '@/lib/siteUrl';

const SETTINGS_URL = `${SITE_URL}/dashboard?settings=1`;

export async function GET(request) {
  const { searchParams } = new URL(request.url);

  // Login was cancelled, or something about the response is malformed —
  // either way there's nothing to save.
  if (searchParams.get('openid.mode') !== 'id_res') {
    return NextResponse.redirect(`${SETTINGS_URL}&steam=cancelled`);
  }

  // Anyone could hand-craft a request to this URL claiming to be Steam, so
  // the signed params have to be re-posted back to Steam itself to confirm
  // they're genuine before trusting the SteamID in them.
  const verifyParams = new URLSearchParams(searchParams);
  verifyParams.set('openid.mode', 'check_authentication');

  let verified = false;
  try {
    const verifyRes = await fetch('https://steamcommunity.com/openid/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: verifyParams.toString(),
    });
    const verifyText = await verifyRes.text();
    verified = verifyRes.ok && verifyText.includes('is_valid:true');
  } catch {
    verified = false;
  }

  if (!verified) {
    return NextResponse.redirect(`${SETTINGS_URL}&steam=failed`);
  }

  const claimedId = searchParams.get('openid.claimed_id') || '';
  const match = claimedId.match(/^https:\/\/steamcommunity\.com\/openid\/id\/(\d+)$/);
  if (!match) {
    return NextResponse.redirect(`${SETTINGS_URL}&steam=failed`);
  }
  const steamId = match[1];

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${SITE_URL}/login`);
  }

  const { error } = await supabase.from('profiles').update({ steam_id: steamId }).eq('id', user.id);
  if (error) {
    return NextResponse.redirect(`${SETTINGS_URL}&steam=failed`);
  }

  return NextResponse.redirect(`${SETTINGS_URL}&steam=connected`);
}
