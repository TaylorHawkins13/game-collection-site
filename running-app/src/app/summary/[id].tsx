/** Post-session: instant XP/badge feedback, summary + map, 5-second check-in, health sync status, plan note. */
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { ActivityStats, SplitsTable } from '../../components/ActivityStats';
import { RankEmblem } from '../../components/RankEmblem';
import { RouteMap } from '../../components/RouteMap';
import { Body, Button, Card, Chip, H1, H3, ProgressBar, Row, Screen, Small } from '../../components/ui';
import { badgeById } from '../../domain/badges';
import { challengeById } from '../../domain/challenges';
import { divisionLabel, divisionProgress, rankOf } from '../../domain/ranks';
import { pbText } from '../../domain/fitness';
import type { EngineEvent, Feel, RaceDistance, Soreness } from '../../domain/types';
import { XP } from '../../domain/xp';
import { health } from '../../services/health';
import { stravaConfigured } from '../../services/strava';
import { syncActivityToStrava } from '../../services/sync';
import { useStore } from '../../state/store';
import { RANK_COLORS, space, useColors } from '../../theme';

const FEELS: { id: Feel; label: string }[] = [
  { id: 'easy', label: 'Easy' },
  { id: 'just_right', label: 'Just right' },
  { id: 'hard', label: 'Hard' },
];
const SORENESS: { id: Soreness; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'mild', label: 'Mild' },
  { id: 'noticeable', label: 'Noticeable' },
];

function EventLine({ e }: { e: EngineEvent }) {
  const c = useColors();
  switch (e.type) {
    case 'promoted':
      return (
        <Row>
          <RankEmblem division={e.division} size={36} />
          <H3>Promoted to {divisionLabel(e.division)}!</H3>
        </Row>
      );
    case 'gated':
      return (
        <Small>
          Your bar is full. {divisionLabel(e.division)} unlocks once your plan completion over the last 4 weeks reaches {Math.round(e.requiredCompletion * 100)}% (now{' '}
          {Math.round(e.currentCompletion * 100)}%). Your extra XP is saved.
        </Small>
      );
    case 'badge': {
      const b = badgeById(e.id);
      return b ? (
        <Row style={{ flexWrap: 'nowrap' }}>
          <Body style={{ fontSize: 28 }}>{b.icon}</Body>
          <View style={{ flex: 1 }}>
            <H3>New badge: {b.title}</H3>
            <Small>{b.description}</Small>
          </View>
        </Row>
      ) : null;
    }
    case 'fitness':
      return (
        <Row style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
          <Body style={{ fontSize: 22 }}>{e.direction === 'up' ? '📈' : '🧭'}</Body>
          <View style={{ flex: 1 }}>
            <H3>{e.direction === 'up' ? 'You’re getting fitter' : 'Plan adjusted'}</H3>
            <Small>{e.text}</Small>
          </View>
        </Row>
      );
    case 'possible_pb':
      return <PbPrompt distance={e.distance} timeSec={e.timeSec} />;
    case 'weekly_target':
      return <Body>✓ Weekly target hit (+{XP.weeklyTarget} XP)</Body>;
    case 'challenge':
      return <Body style={{ color: c.accent }}>★ Challenge complete: {challengeById(e.id).title} (+{XP.weeklyChallenge} XP)</Body>;
    default:
      return null;
  }
}

function PbPrompt({ distance, timeSec }: { distance: RaceDistance; timeSec: number }) {
  const save = useStore((s) => s.savePersonalBest);
  const [saved, setSaved] = useState(false);
  return (
    <View style={{ gap: space.sm }}>
      <H3>🏅 Possible new PB: {pbText({ distance, timeSec })}</H3>
      {saved ? (
        <Small>Saved. Your paces now use it.</Small>
      ) : (
        <>
          <Small>Save it and your training paces update to match.</Small>
          <Button
            kind="secondary"
            title="Save as my PB"
            onPress={() => {
              save({ distance, timeSec });
              setSaved(true);
            }}
          />
        </>
      )}
    </View>
  );
}

const NO_EVENTS: EngineEvent[] = [];

export default function Summary() {
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const app = useStore((s) => s.app);
  const events = useStore((s) => s.sessionEvents[id ?? '']) ?? NO_EVENTS;
  const submitFeedback = useStore((s) => s.submitFeedback);
  const a = app.activities.find((x) => x.id === id);
  const [feel, setFeel] = useState<Feel | null>(a?.feel ?? null);
  const [soreness, setSoreness] = useState<Soreness>(a?.soreness ?? 'none');
  const [note, setNote] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(!!a?.feel);
  const [stravaState, setStravaState] = useState<'idle' | 'uploading' | 'failed'>('idle');

  if (!a || !app.profile) {
    return (
      <Screen>
        <Body>Session not found.</Body>
        <Button title="Home" onPress={() => router.replace('/')} />
      </Screen>
    );
  }
  const xp = events.filter((e) => e.type === 'xp').reduce((sum, e) => sum + (e.type === 'xp' ? e.amount : 0), 0);
  const highlights = events.filter((e) => e.type !== 'xp' && e.type !== 'plan_note');
  const rank = app.rank;

  const submit = () => {
    if (!feel) return;
    setNote(submitFeedback(a.id, feel, soreness));
    setSubmitted(true);
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ alignItems: 'center', gap: space.sm, paddingTop: space.lg }}>
        <Small style={{ fontWeight: '700', color: c.primary }}>SESSION COMPLETE</Small>
        <H1>{a.completion < 0.9 && a.plannedSessionId ? 'Every bit counts' : 'You showed up'}</H1>
        <Body muted center>
          {a.title}
        </Body>
        <View style={{ backgroundColor: c.primarySoft, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 20 }}>
          <H3 style={{ color: c.primary }}>+{xp} XP</H3>
        </View>
      </View>

      {highlights.length ? <Card style={{ gap: space.md }}>{highlights.map((e, i) => <EventLine key={i} e={e} />)}</Card> : null}

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <H3>{divisionLabel(rank.division)}</H3>
          <RankEmblem division={rank.division} size={32} />
        </Row>
        <ProgressBar value={divisionProgress(rank)} color={RANK_COLORS[rankOf(rank.division)]} />
      </Card>

      {!submitted ? (
        <Card style={{ gap: space.md }}>
          <H3>How did it feel?</H3>
          <Row>
            {FEELS.map((f) => (
              <Chip key={f.id} label={f.label} selected={feel === f.id} onPress={() => setFeel(f.id)} />
            ))}
          </Row>
          <H3>Any soreness?</H3>
          <Row>
            {SORENESS.map((s) => (
              <Chip key={s.id} label={s.label} selected={soreness === s.id} onPress={() => setSoreness(s.id)} />
            ))}
          </Row>
          <Button title={`Save check-in (+${XP.feedback} XP)`} onPress={submit} disabled={!feel} />
          <Small>This is how your plan learns what’s right for you.</Small>
        </Card>
      ) : (
        <Card>
          <H3>Thanks for checking in</H3>
          <Body muted>{note ?? (a.feel === 'hard' ? 'Noted.' : 'Noted — your plan will keep things steady.')}</Body>
        </Card>
      )}

      <Card>
        <ActivityStats a={a} units={app.profile.units} level={app.profile.level} />
        {a.kind === 'run' && !a.treadmill ? <RouteMap route={a.route} hideEnds={app.profile.hideRouteEnds} /> : null}
        <SplitsTable a={a} units={app.profile.units} />
        <Small>
          {app.health.connected
            ? a.healthSynced
              ? `Saved to ${health.name} ✓`
              : `Saving to ${health.name}…`
            : 'Connect a health app in Profile → Plan & settings to save workouts automatically.'}
        </Small>
      </Card>

      {app.profile.strava && stravaConfigured() ? (
        <Card>
          <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
            <Small muted={false}>{a.stravaId ? 'On Strava ✓' : stravaState === 'failed' ? 'Strava upload didn’t go through.' : app.profile.strava.autoUpload ? 'Uploading to Strava…' : 'Not on Strava yet.'}</Small>
            {!a.stravaId && (stravaState === 'failed' || !app.profile.strava.autoUpload) ? (
              <Button kind="ghost" title="Upload" onPress={() => { setStravaState('uploading'); void syncActivityToStrava(a.id, true).then((r) => setStravaState(r === 'uploaded' ? 'idle' : 'failed')); }} />
            ) : null}
          </Row>
        </Card>
      ) : null}
      <Button kind="secondary" title="Share with friends" onPress={() => router.push(`/share/${a.id}`)} />
      <Button big title="Done" onPress={() => router.replace('/')} />
    </Screen>
  );
}
