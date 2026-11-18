/**
 * Friends backend (Supabase). Switched on only when EXPO_PUBLIC_SUPABASE_URL and
 * EXPO_PUBLIC_SUPABASE_ANON_KEY are set at build time — otherwise every screen
 * shows a "not switched on yet" state and the rest of the app is unaffected.
 * Schema + access rules: supabase/steady-social.sql.
 */
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { friendCode, normaliseCode, type SharedRunPayload } from '../domain/social';

// Steady's Supabase project. The publishable key is meant to ship inside apps (row-level
// security protects the data); .env / EAS env vars can override both.
const DEFAULT_URL = 'https://kjbguadmsmygiupzbhhy.supabase.co';
const DEFAULT_KEY = 'sb_publishable_G3-n50tOfKr5QSEiDP29Sg_G6QBsLQ9';
const URL = process.env.EXPO_PUBLIC_SUPABASE_URL || DEFAULT_URL;
const KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_KEY;

let client: SupabaseClient | null = null;
// The browser preview runs in a sandbox with no outside network, so Friends stays off there.
const ENABLED = !!URL && !!KEY && Platform.OS !== 'web';
export function supabase(): SupabaseClient | null {
  if (!ENABLED) return null;
  if (!client) {
    client = createClient(URL, KEY, {
      auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
    });
  }
  return client;
}

export const socialConfigured = () => ENABLED;

export interface MyProfile {
  id: string;
  display_name: string;
  friend_code: string;
}

export interface FriendRow {
  friendshipId: string;
  id: string;
  display_name: string;
  status: 'pending' | 'accepted';
  incoming: boolean;
}

export type Cheer = '👏' | '🔥' | '💪';

export interface FeedItem extends SharedRunPayload {
  id: string;
  user_id: string;
  created_at: string;
  author: string;
  mine: boolean;
  cheers: Record<Cheer, number>;
  myCheer: Cheer | null;
}

function need(): SupabaseClient {
  const c = supabase();
  if (!c) throw new Error('Friends isn’t switched on in this build yet.');
  return c;
}

function friendly(e: { message?: string } | null, fallback: string): Error {
  return new Error(e?.message ? `${fallback} (${e.message})` : fallback);
}

export async function currentUserId(): Promise<string | null> {
  const c = supabase();
  if (!c) return null;
  const { data } = await c.auth.getSession();
  return data.session?.user.id ?? null;
}

/** Email a 6-digit sign-in code (no passwords, no links to tap). */
export async function sendCode(email: string): Promise<void> {
  const { error } = await need().auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
  if (error) throw friendly(error, 'Couldn’t send the code');
}

export async function verifyCode(email: string, token: string): Promise<void> {
  const { error } = await need().auth.verifyOtp({ email: email.trim(), token: token.trim(), type: 'email' });
  if (error) throw friendly(error, 'That code didn’t work');
}

export async function signOut(): Promise<void> {
  await need().auth.signOut();
}

export async function myProfile(): Promise<MyProfile | null> {
  const uid = await currentUserId();
  if (!uid) return null;
  const { data } = await need().from('profiles').select('id, display_name, friend_code').eq('id', uid).maybeSingle();
  return (data as MyProfile | null) ?? null;
}

export async function createProfile(displayName: string): Promise<MyProfile> {
  const uid = await currentUserId();
  if (!uid) throw new Error('Please sign in first.');
  for (let attempt = 0; attempt < 5; attempt++) {
    const row = { id: uid, display_name: displayName.trim().slice(0, 40), friend_code: friendCode() };
    const { data, error } = await need().from('profiles').insert(row).select('id, display_name, friend_code').single();
    if (!error) return data as MyProfile;
    if (!/friend_code/.test(error.message)) throw friendly(error, 'Couldn’t create your profile');
  }
  throw new Error('Couldn’t create a friend code. Please try again.');
}

export async function addFriendByCode(code: string): Promise<string> {
  const c = need();
  const uid = await currentUserId();
  const { data, error } = await c.rpc('find_by_friend_code', { code: normaliseCode(code) });
  if (error) throw friendly(error, 'Couldn’t look up that code');
  const found = (data as { id: string; display_name: string }[])[0];
  if (!found) throw new Error('No one has that friend code. Check it with your friend.');
  const ins = await c.from('friendships').insert({ requester: uid, addressee: found.id });
  if (ins.error) {
    if (/duplicate|unique/i.test(ins.error.message)) throw new Error(`You and ${found.display_name} are already connected (or a request is waiting).`);
    throw friendly(ins.error, 'Couldn’t send the request');
  }
  return found.display_name;
}

export async function listFriends(): Promise<FriendRow[]> {
  const c = need();
  const uid = await currentUserId();
  const { data, error } = await c.from('friendships').select('id, requester, addressee, status');
  if (error) throw friendly(error, 'Couldn’t load friends');
  const rows = (data ?? []) as { id: string; requester: string; addressee: string; status: 'pending' | 'accepted' }[];
  const otherIds = rows.map((r) => (r.requester === uid ? r.addressee : r.requester));
  const names = new Map<string, string>();
  if (otherIds.length) {
    const p = await c.from('profiles').select('id, display_name').in('id', otherIds);
    for (const x of (p.data ?? []) as { id: string; display_name: string }[]) names.set(x.id, x.display_name);
  }
  return rows.map((r) => {
    const other = r.requester === uid ? r.addressee : r.requester;
    return { friendshipId: r.id, id: other, display_name: names.get(other) ?? 'Runner', status: r.status, incoming: r.addressee === uid };
  });
}

export async function acceptFriend(friendshipId: string): Promise<void> {
  const { error } = await need().from('friendships').update({ status: 'accepted' }).eq('id', friendshipId);
  if (error) throw friendly(error, 'Couldn’t accept');
}

export async function removeFriend(friendshipId: string): Promise<void> {
  const { error } = await need().from('friendships').delete().eq('id', friendshipId);
  if (error) throw friendly(error, 'Couldn’t remove');
}

export async function postRun(payload: SharedRunPayload): Promise<void> {
  const uid = await currentUserId();
  if (!uid) throw new Error('Sign in to Friends first.');
  const { error } = await need().from('shared_runs').insert({ ...payload, user_id: uid });
  if (error) throw friendly(error, 'Couldn’t post');
}

export async function deletePost(id: string): Promise<void> {
  const { error } = await need().from('shared_runs').delete().eq('id', id);
  if (error) throw friendly(error, 'Couldn’t delete');
}

export async function feed(limit = 30): Promise<FeedItem[]> {
  const c = need();
  const uid = await currentUserId();
  const runs = await c.from('shared_runs').select('*').order('created_at', { ascending: false }).limit(limit);
  if (runs.error) throw friendly(runs.error, 'Couldn’t load the feed');
  const rows = (runs.data ?? []) as (SharedRunPayload & { id: string; user_id: string; created_at: string })[];
  if (!rows.length) return [];
  const [profiles, cheers] = await Promise.all([
    c.from('profiles').select('id, display_name').in('id', [...new Set(rows.map((r) => r.user_id))]),
    c.from('cheers').select('run_id, user_id, emoji').in('run_id', rows.map((r) => r.id)),
  ]);
  const names = new Map(((profiles.data ?? []) as { id: string; display_name: string }[]).map((p) => [p.id, p.display_name]));
  const cs = (cheers.data ?? []) as { run_id: string; user_id: string; emoji: Cheer }[];
  return rows.map((r) => {
    const mine = cs.filter((x) => x.run_id === r.id);
    const counts: Record<Cheer, number> = { '👏': 0, '🔥': 0, '💪': 0 };
    for (const x of mine) counts[x.emoji] += 1;
    return { ...r, author: r.user_id === uid ? 'You' : names.get(r.user_id) ?? 'Friend', mine: r.user_id === uid, cheers: counts, myCheer: mine.find((x) => x.user_id === uid)?.emoji ?? null };
  });
}

/** Set, change or (same emoji again) remove your cheer. */
export async function toggleCheer(runId: string, emoji: Cheer, current: Cheer | null): Promise<void> {
  const c = need();
  const uid = await currentUserId();
  if (current === emoji) {
    const { error } = await c.from('cheers').delete().eq('run_id', runId).eq('user_id', uid!);
    if (error) throw friendly(error, 'Couldn’t remove cheer');
    return;
  }
  const { error } = await c.from('cheers').upsert({ run_id: runId, user_id: uid, emoji });
  if (error) throw friendly(error, 'Couldn’t cheer');
}
