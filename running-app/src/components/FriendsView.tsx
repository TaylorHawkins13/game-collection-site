/** Friends: opt-in. Add friends by code, see the runs they choose to post, give a cheer. No public profiles, no leaderboards. */
import { Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Polyline } from 'react-native-svg';
import { Body, Button, Card, H2, H3, Row, SectionTitle, Small, Stat, StatRow } from './ui';
import { formatShort, weekdayShort } from '../domain/dates';
import { formatDistance, formatDuration, formatPace } from '../domain/gps';
import * as Social from '../services/social';
import { useStore } from '../state/store';
import { font, radius, space, useColors } from '../theme';

const CHEERS: Social.Cheer[] = ['👏', '🔥', '💪'];

export function FriendsView({ inTab = false }: { inTab?: boolean }) {
  const c = useColors();
  const units = useStore((s) => s.app.profile?.units ?? 'km');
  const level = useStore((s) => s.app.profile?.level ?? 'new');
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [me, setMe] = useState<Social.MyProfile | null>(null);
  const [friends, setFriends] = useState<Social.FriendRow[]>([]);
  const [items, setItems] = useState<Social.FeedItem[]>([]);
  const [msg, setMsg] = useState<{ text: string; ok?: boolean } | null>(null);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [name, setName] = useState('');
  const [friendCode, setFriendCode] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!Social.socialConfigured()) return setLoading(false);
    setLoading(true);
    try {
      const uid = await Social.currentUserId();
      setSignedIn(!!uid);
      if (uid) {
        const p = await Social.myProfile();
        setMe(p);
        if (p) {
          const [f, fe] = await Promise.all([Social.listFriends(), Social.feed()]);
          setFriends(f);
          setItems(fe);
        }
      }
    } catch (e) {
      setMsg({ text: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (fn: () => Promise<unknown>, okText?: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      if (okText) setMsg({ text: okText, ok: true });
      await load();
    } catch (e) {
      setMsg({ text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const input = { ...font.h3, color: c.text, backgroundColor: c.surfaceAlt, borderRadius: radius.pill, paddingVertical: 10, paddingHorizontal: space.lg };
  const message = msg ? <Small style={{ color: msg.ok ? c.primary : c.danger }}>{msg.text}</Small> : null;

  const body = () => {
    if (!Social.socialConfigured()) {
      return (
        <Card>
          <H3>Friends isn’t switched on yet</H3>
          <Body muted>
            This build of Steady isn’t connected to a Friends server. You can still share any run through Messages, WhatsApp and so on from the run summary — no account needed.
          </Body>
        </Card>
      );
    }
    if (loading && !me && !signedIn) return <Small>Loading…</Small>;
    if (!signedIn) {
      return (
        <Card>
          <H3>Sign in to use Friends</H3>
          <Small>Optional. We email you a 6-digit code — no password. Everything else in Steady works without this.</Small>
          {!codeSent ? (
            <>
              <TextInput value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor={c.textMuted} autoCapitalize="none" keyboardType="email-address" style={input} accessibilityLabel="Email" />
              <Button title="Email me a code" disabled={busy || !/\S+@\S+\.\S+/.test(email)} onPress={() => void run(async () => { await Social.sendCode(email); setCodeSent(true); }, 'Code sent — check your email.')} />
            </>
          ) : (
            <>
              <TextInput value={code} onChangeText={setCode} placeholder="6-digit code" placeholderTextColor={c.textMuted} keyboardType="number-pad" style={input} accessibilityLabel="Sign-in code" />
              <Button title="Sign in" disabled={busy || code.trim().length < 6} onPress={() => void run(() => Social.verifyCode(email, code))} />
              <Button kind="ghost" title="Use a different email" onPress={() => { setCodeSent(false); setCode(''); }} />
            </>
          )}
          {message}
        </Card>
      );
    }
    if (!me) {
      return (
        <Card>
          <H3>What should friends call you?</H3>
          <TextInput value={name} onChangeText={setName} placeholder="First name or nickname" placeholderTextColor={c.textMuted} style={input} maxLength={40} accessibilityLabel="Display name" />
          <Button title="Continue" disabled={busy || !name.trim()} onPress={() => void run(() => Social.createProfile(name))} />
          {message}
        </Card>
      );
    }
    const incoming = friends.filter((f) => f.status === 'pending' && f.incoming);
    const outgoing = friends.filter((f) => f.status === 'pending' && !f.incoming);
    const accepted = friends.filter((f) => f.status === 'accepted');
    return (
      <>
        <Card>
          <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
            <View style={{ flex: 1 }}>
              <Small>Your friend code</Small>
              <Text selectable style={{ fontSize: 28, fontWeight: '800', letterSpacing: 4, color: c.text }}>
                {me.friend_code}
              </Text>
            </View>
            <Button kind="ghost" title="Copy" onPress={() => void navigator.clipboard?.writeText(me.friend_code).then(() => setMsg({ text: 'Copied.', ok: true }), () => undefined)} />
          </Row>
          <Small>Give this to friends so they can add you. Only people you accept can see your posts.</Small>
          <Row style={{ flexWrap: 'nowrap' }}>
            <TextInput value={friendCode} onChangeText={setFriendCode} placeholder="Friend’s code" placeholderTextColor={c.textMuted} autoCapitalize="characters" maxLength={8} style={[input, { flex: 1 }]} accessibilityLabel="Friend's code" />
            <Button title="Add" disabled={busy || friendCode.trim().length < 6} onPress={() => void run(async () => { const n = await Social.addFriendByCode(friendCode); setFriendCode(''); setMsg({ text: `Request sent to ${n}.`, ok: true }); })} />
          </Row>
          {message}
        </Card>

        {incoming.length ? (
          <>
            <SectionTitle>Requests</SectionTitle>
            {incoming.map((f) => (
              <Card key={f.friendshipId}>
                <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                  <H3>{f.display_name}</H3>
                  <Row>
                    <Button title="Accept" onPress={() => void run(() => Social.acceptFriend(f.friendshipId), `You and ${f.display_name} are now friends.`)} />
                    <Button kind="ghost" title="Decline" onPress={() => void run(() => Social.removeFriend(f.friendshipId))} />
                  </Row>
                </Row>
              </Card>
            ))}
          </>
        ) : null}

        <SectionTitle>Friends ({accepted.length})</SectionTitle>
        <Card>
          {accepted.length === 0 && outgoing.length === 0 ? <Small>No friends yet. Share your code to get started.</Small> : null}
          {accepted.map((f) => (
            <Row key={f.friendshipId} style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
              <Body>{f.display_name}</Body>
              <Button kind="ghost" title="Remove" onPress={() => void run(() => Social.removeFriend(f.friendshipId))} />
            </Row>
          ))}
          {outgoing.map((f) => (
            <Row key={f.friendshipId} style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
              <Small>{f.display_name} · request sent</Small>
              <Button kind="ghost" title="Cancel" onPress={() => void run(() => Social.removeFriend(f.friendshipId))} />
            </Row>
          ))}
        </Card>

        <SectionTitle>Recent runs</SectionTitle>
        {items.length === 0 ? <Small>Nothing yet. Post a run from its summary with “Share with friends”.</Small> : null}
        {items.map((it) => (
          <Card key={it.id}>
            <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
              <View style={{ flex: 1 }}>
                <H3>{it.author}</H3>
                <Small>
                  {weekdayShort(it.activity_date)} {formatShort(it.activity_date)} · {it.headline}
                </Small>
              </View>
              {it.rank_label ? <Small muted={false}>{it.rank_label}</Small> : null}
            </Row>
            <Body>{it.title}</Body>
            <StatRow>
              <Stat label="Time" value={formatDuration(it.duration_sec)} />
              {it.distance_m ? <Stat label="Distance" value={formatDistance(it.distance_m, units)} /> : null}
              {it.pace_sec_per_km && level !== 'new' ? <Stat label="Pace" value={formatPace(units === 'km' ? it.pace_sec_per_km : it.pace_sec_per_km * 1.609344, units)} /> : null}
            </StatRow>
            {it.route_shape ? (
              <View style={{ height: 90, backgroundColor: c.surfaceAlt, borderRadius: radius.md, overflow: 'hidden' }}>
                <Svg width="100%" height="100%" viewBox="0 0 100 60" preserveAspectRatio="xMidYMid meet">
                  <Polyline points={it.route_shape} fill="none" stroke={c.primary} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
                </Svg>
              </View>
            ) : null}
            {it.streak && it.streak >= 2 ? <Small>🔥 {it.streak}-day plan streak{it.week_total ? ` · ${it.week_done}/${it.week_total} this week` : ''}</Small> : null}
            <Row>
              {CHEERS.map((e) => {
                const mineSel = it.myCheer === e;
                return (
                  <Pressable
                    key={e}
                    disabled={it.mine || busy}
                    onPress={() => void run(() => Social.toggleCheer(it.id, e, it.myCheer))}
                    accessibilityRole="button"
                    accessibilityLabel={`${e} ${it.cheers[e]}`}
                    style={{ flexDirection: 'row', gap: 4, alignItems: 'center', borderRadius: radius.pill, borderWidth: 1.5, borderColor: mineSel ? c.primary : c.border, backgroundColor: mineSel ? c.primarySoft : c.surface, paddingVertical: 6, paddingHorizontal: 12, opacity: it.mine ? 0.7 : 1 }}
                  >
                    <Text style={{ fontSize: 16 }}>{e}</Text>
                    {it.cheers[e] ? <Text style={{ color: c.text, fontWeight: '600' }}>{it.cheers[e]}</Text> : null}
                  </Pressable>
                );
              })}
              {it.mine ? <Button kind="ghost" title="Delete" onPress={() => void run(() => Social.deletePost(it.id))} /> : null}
            </Row>
          </Card>
        ))}
        <Button kind="ghost" title="Sign out of Friends" onPress={() => void run(async () => { await Social.signOut(); setMe(null); setSignedIn(false); })} />
      </>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={inTab ? ['top'] : ['bottom']}>
      {inTab ? null : <Stack.Screen options={{ title: 'Friends' }} />}
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.xxl * 2, gap: space.sm }}
        refreshControl={<RefreshControl refreshing={loading && !!me} onRefresh={() => void load()} />}
      >
        {inTab ? <Text style={[font.title, { color: c.text }]} accessibilityRole="header">Feed</Text> : <H2>Friends</H2>}
        <Small>Runs your friends chose to share. Only friends you accept see yours. No public profiles, no leaderboards — just cheering each other on.</Small>
        {body()}
      </ScrollView>
    </SafeAreaView>
  );
}

