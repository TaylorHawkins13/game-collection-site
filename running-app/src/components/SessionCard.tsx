import { router } from 'expo-router';
import { View } from 'react-native';
import { routineById } from '../domain/strength';
import type { PlannedSession } from '../domain/types';
import { space, useColors } from '../theme';
import { Body, Button, Card, H2, Row, Small } from './ui';

export function sessionSubtitle(s: PlannedSession): string {
  if (s.kind === 'strength') {
    const r = routineById(s.routineId);
    return `${s.durationMin} min · ${r?.kind === 'mobility' ? 'mobility' : 'strength'}${r ? ` · ${r.focus.join(', ')}` : ''}`;
  }
  if (s.walkRun) return `${s.durationMin} min total, including warm-up and cool-down walks`;
  if (s.strides) return `${s.durationMin} min easy, with ${s.strides} relaxed strides near the end`;
  return `${s.durationMin} min at a conversational pace`;
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
  const done = session.status === 'completed';
  const paused = session.status === 'paused';
  return (
    <Card style={done ? { backgroundColor: c.primarySoft, borderColor: c.primarySoft } : undefined}>
      <Small style={{ fontWeight: '700', color: c.primary }}>
        {done ? 'DONE ✓' : session.optional ? 'OPTIONAL' : session.kind === 'run' ? 'TODAY’S RUN' : 'TODAY’S SESSION'}
      </Small>
      {compact ? <Body>{session.title}</Body> : <H2>{session.title}</H2>}
      <Small>{sessionSubtitle(session)}</Small>
      {session.note ? <Small style={{ fontStyle: 'italic' }}>{session.note}</Small> : null}
      {!done && !paused ? (
        <View style={{ gap: space.sm, marginTop: space.sm }}>
          <Button title={session.kind === 'run' ? 'Start run' : 'Start session'} big={!compact} onPress={() => router.push(`/session/${session.id}`)} />
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
