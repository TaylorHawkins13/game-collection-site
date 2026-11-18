import { router } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';
import { currentPaces } from '../domain/fitness';
import { paceLabel, type TrainingPaces } from '../domain/pace';
import { fmtLong } from '../domain/plan';
import { routineById } from '../domain/strength';
import type { PlannedSession, Profile } from '../domain/types';
import { useStore } from '../state/store';
import { space, useColors } from '../theme';
import { Body, Button, Card, H2, Row, Small } from './ui';

export function sessionSubtitle(s: PlannedSession, profile?: Profile | null, fitnessPaces?: TrainingPaces | null): string {
  const paces = profile && profile.level !== 'new' ? fitnessPaces ?? null : null;
  const u = profile?.units ?? 'km';
  if (s.runType === 'race') {
    return s.targetPaceSecPerKm ? `Race · target ~${paceLabel(s.targetPaceSecPerKm, u)}/${u} (about ${s.durationMin} min)` : `Race · run it by feel`;
  }
  if (s.workout) {
    const target = s.targetPaceSecPerKm ? ` · reps at ~${paceLabel(s.targetPaceSecPerKm, u)}/${u}` : ' · by feel';
    return `${s.durationMin} min incl. 10 min warm-up${target}`;
  }
  if (paces && s.kind === 'run' && !s.walkRun) {
    const easy = `easy ${paceLabel(paces.easy[0], u)}–${paceLabel(paces.easy[1], u)}/${u}`;
    return s.strides ? `${fmtLong(s.durationMin)} ${easy}, ${s.strides} relaxed strides near the end` : `${fmtLong(s.durationMin)} · ${easy}`;
  }
  if (s.kind === 'strength') {
    const r = routineById(s.routineId);
    return `${s.durationMin} min · ${r?.kind === 'mobility' ? 'mobility' : 'strength'}${r ? ` · ${r.focus.join(', ')}` : ''}`;
  }
  if (s.walkRun) return `${s.durationMin} min total, including warm-up and cool-down walks`;
  if (s.strides) return `${s.durationMin} min easy, with ${s.strides} relaxed strides near the end`;
  return `${fmtLong(s.durationMin)} at a conversational pace`;
}

export function SessionCard({
  session,
  onSwap,
  onMoveTomorrow,
  compact,
}: {
  session: PlannedSession;
  onSwap?: () => void;
  onMoveTomorrow?: () => void;
  compact?: boolean;
}) {
  const c = useColors();
  const profile = useStore((st) => st.app.profile);
  const fitness = useStore((st) => st.app.fitness);
  // Derive paces from stable store values (a selector returning a new object would re-render forever).
  const paces = useMemo(() => currentPaces(useStore.getState().app), [fitness, profile]);
  const done = session.status === 'completed';
  const paused = session.status === 'paused';
  return (
    <Card style={done ? { backgroundColor: c.primarySoft, borderColor: c.primarySoft } : undefined}>
      <Small style={{ fontWeight: '700', color: c.primary }}>
        {done ? 'DONE ✓' : session.runType === 'race' ? 'RACE DAY' : session.optional ? 'OPTIONAL' : session.kind === 'run' ? 'TODAY’S RUN' : 'TODAY’S SESSION'}
      </Small>
      {compact ? <Body>{session.title}</Body> : <H2>{session.title}</H2>}
      <Small>{sessionSubtitle(session, profile, paces)}</Small>
      {session.note ? <Small style={{ fontStyle: 'italic' }}>{session.note}</Small> : null}
      {!done && !paused ? (
        <View style={{ gap: space.sm, marginTop: space.sm }}>
          <Button title={session.runType === 'race' ? 'Start race' : session.kind === 'run' ? 'Start run' : 'Start session'} big={!compact} onPress={() => router.push(`/session/${session.id}`)} />
          {onSwap || onMoveTomorrow ? (
            <Row style={{ justifyContent: 'center' }}>
              {onSwap ? <Button kind="ghost" title="Swap for mobility" onPress={onSwap} /> : null}
              {onMoveTomorrow ? <Button kind="ghost" title="Move to tomorrow" onPress={onMoveTomorrow} /> : null}
            </Row>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}
