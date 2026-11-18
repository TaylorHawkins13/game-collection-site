/**
 * Strava: connect, upload runs, import history. Off unless the build has
 * EXPO_PUBLIC_STRAVA_CLIENT_ID and EXPO_PUBLIC_STRAVA_TOKEN_URL (the strava-token
 * edge function). Tokens are kept in the device's secure store.
 */
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import { toDateKey } from '../domain/dates';
import { trimRouteEnds } from '../domain/gps';
import { toGpx } from '../domain/gpx';
import type { Activity, ImportedRun } from '../domain/types';

const CLIENT_ID = process.env.EXPO_PUBLIC_STRAVA_CLIENT_ID;
const TOKEN_URL = process.env.EXPO_PUBLIC_STRAVA_TOKEN_URL || 'https://kjbguadmsmygiupzbhhy.supabase.co/functions/v1/strava-token';
const REDIRECT = 'steady://strava';
const KEY = 'steady.strava.tokens';
const API = 'https://www.strava.com/api/v3';

export const stravaConfigured = () => !!CLIENT_ID && !!TOKEN_URL && Platform.OS !== 'web';

interface Tokens {
  access_token: string;
  refresh_token: string;
  expires_at: number; // epoch seconds
}

async function save(t: Tokens) {
  await SecureStore.setItemAsync(KEY, JSON.stringify(t));
}
async function load(): Promise<Tokens | null> {
  const raw = await SecureStore.getItemAsync(KEY);
  return raw ? (JSON.parse(raw) as Tokens) : null;
}

async function exchange(body: Record<string, string>): Promise<Tokens & { athlete?: { firstname?: string } }> {
  const r = await fetch(TOKEN_URL!, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.access_token) throw new Error(data?.error ?? 'Strava connection failed.');
  return data;
}

/** Opens Strava's authorisation page (the Strava app if installed). Returns the athlete's first name. */
export async function connectStrava(): Promise<string> {
  if (!stravaConfigured()) throw new Error('Strava isn’t set up in this build yet.');
  const url =
    `https://www.strava.com/oauth/mobile/authorize?client_id=${encodeURIComponent(CLIENT_ID!)}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT)}&response_type=code&approval_prompt=auto&scope=${encodeURIComponent('read,activity:read_all,activity:write')}`;
  const res = await WebBrowser.openAuthSessionAsync(url, REDIRECT);
  if (res.type !== 'success') throw new Error('Strava connection was cancelled.');
  const params = new URL(res.url).searchParams;
  if (params.get('error')) throw new Error('Strava access was declined.');
  const code = params.get('code');
  const scope = params.get('scope') ?? '';
  if (!code) throw new Error('Strava didn’t return a code.');
  if (!scope.includes('activity:write')) throw new Error('Please allow Steady to upload activities, then try again.');
  const t = await exchange({ code });
  await save(t);
  return t.athlete?.firstname ?? 'Strava athlete';
}

async function accessToken(): Promise<string> {
  const t = await load();
  if (!t) throw new Error('Connect Strava first.');
  if (t.expires_at * 1000 - Date.now() > 60_000) return t.access_token;
  const fresh = await exchange({ refresh_token: t.refresh_token });
  await save(fresh);
  return fresh.access_token;
}

export async function disconnectStrava(): Promise<void> {
  try {
    const token = await accessToken();
    await fetch('https://www.strava.com/oauth/deauthorize', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
  } catch {
    // already disconnected / offline — still forget locally
  }
  await SecureStore.deleteItemAsync(KEY);
}

/** Upload a finished run. Returns the Strava upload/activity id. */
export async function uploadToStrava(a: Activity, opts: { hideRouteEnds: boolean; description?: string }): Promise<string> {
  const token = await accessToken();
  const name = a.title;
  const description = opts.description ?? 'Recorded with Steady';
  const route = a.route && a.route.length > 1 ? (opts.hideRouteEnds ? trimRouteEnds(a.route) : a.route) : [];
  if (route.length > 1) {
    const file = new File(Paths.cache, `steady-${a.id}.gpx`);
    file.write(toGpx(a, route));
    const form = new FormData();
    form.append('file', { uri: file.uri, name: `steady-${a.id}.gpx`, type: 'application/gpx+xml' } as unknown as Blob);
    form.append('data_type', 'gpx');
    form.append('name', name);
    form.append('description', description);
    form.append('external_id', `steady-${a.id}`);
    form.append('sport_type', 'Run');
    const r = await fetch(`${API}/uploads`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
    const data = await r.json().catch(() => ({}));
    try {
      file.delete();
    } catch {
      // temp file; fine to leave
    }
    if (!r.ok) throw new Error(data?.error ?? data?.message ?? 'Strava upload failed.');
    return String(data.id_str ?? data.id);
  }
  // No GPS (treadmill / strength): a manual activity.
  const body = new URLSearchParams({
    name,
    sport_type: a.kind === 'strength' ? 'WeightTraining' : 'Run',
    start_date_local: new Date(a.startedAt).toISOString(),
    elapsed_time: String(Math.round(a.durationSec)),
    description,
    ...(a.distanceM ? { distance: String(Math.round(a.distanceM)) } : {}),
    ...(a.treadmill ? { trainer: '1' } : {}),
  });
  const r = await fetch(`${API}/activities`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.message ?? 'Strava upload failed.');
  return String(data.id);
}

/** Runs from Strava since `sinceMs` (paged, up to 600). */
export async function importFromStrava(sinceMs: number): Promise<ImportedRun[]> {
  const token = await accessToken();
  const out: ImportedRun[] = [];
  for (let page = 1; page <= 3; page++) {
    const r = await fetch(`${API}/athlete/activities?after=${Math.floor(sinceMs / 1000)}&per_page=200&page=${page}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error('Couldn’t read your Strava activities.');
    const list = (await r.json()) as {
      id: number;
      name: string;
      sport_type?: string;
      type?: string;
      start_date: string;
      moving_time: number;
      distance: number;
      average_heartrate?: number;
      trainer?: boolean;
      external_id?: string | null;
    }[];
    for (const x of list) {
      const t = x.sport_type ?? x.type ?? '';
      const isRun = ['Run', 'TrailRun', 'VirtualRun'].includes(t);
      const isStrength = ['WeightTraining', 'Workout', 'Crossfit', 'Yoga', 'Pilates'].includes(t);
      if (!isRun && !isStrength) continue;
      if (x.external_id?.startsWith('steady-')) continue; // our own uploads
      const startedAt = Date.parse(x.start_date);
      out.push({
        id: `sv-${x.id}`,
        source: 'strava',
        kind: isRun ? 'run' : 'strength',
        externalId: String(x.id),
        date: toDateKey(startedAt),
        startedAt,
        durationSec: x.moving_time,
        distanceM: isRun && x.distance ? Math.round(x.distance) : undefined,
        avgHr: x.average_heartrate ? Math.round(x.average_heartrate) : undefined,
        treadmill: !!x.trainer || t === 'VirtualRun',
        title: x.name,
      });
    }
    if (list.length < 200) break;
  }
  return out;
}
