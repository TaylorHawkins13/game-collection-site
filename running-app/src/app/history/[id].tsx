import { Stack, useLocalSearchParams } from 'expo-router';
import { ActivityStats, SplitsTable } from '../../components/ActivityStats';
import { RouteMap } from '../../components/RouteMap';
import { Body, Card, H1, H3, Row, Screen, Small } from '../../components/ui';
import { formatShort, weekdayLong } from '../../domain/dates';
import { routineById } from '../../domain/strength';
import { health } from '../../services/health';
import { useStore } from '../../state/store';

const FEEL: Record<string, string> = { easy: 'Easy', just_right: 'Just right', hard: 'Hard' };
const SORE: Record<string, string> = { none: 'None', mild: 'Mild', noticeable: 'Noticeable' };

export default function ActivityDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const app = useStore((s) => s.app);
  const a = app.activities.find((x) => x.id === id);
  if (!a || !app.profile) return <Screen><Body>Not found.</Body></Screen>;
  const routine = routineById(a.routineId);
  return (
    <Screen edges={[]}>
      <Stack.Screen options={{ title: `${weekdayLong(a.date)}, ${formatShort(a.date)}` }} />
      <H1>{a.title}</H1>
      <Small>
        {a.plannedSessionId ? 'Planned session' : 'Extra session'} · +{a.xpEarned} XP{a.treadmill ? ' · treadmill' : ''}
      </Small>
      {a.kind === 'run' && !a.treadmill ? <RouteMap route={a.route} hideEnds={app.profile.hideRouteEnds} height={260} /> : null}
      <Card>
        <ActivityStats a={a} units={app.profile.units} level={app.profile.level} />
      </Card>
      <SplitsTable a={a} units={app.profile.units} />
      {routine ? (
        <Card>
          <H3>{routine.title}</H3>
          {routine.exercises.map((e) => (
            <Small key={e.name}>• {e.name} — {e.dose}</Small>
          ))}
        </Card>
      ) : null}
      <Card>
        <H3>Check-in</H3>
        {a.feel ? (
          <Row>
            <Body>Felt: {FEEL[a.feel]}</Body>
            <Body>· Soreness: {SORE[a.soreness ?? 'none']}</Body>
          </Row>
        ) : (
          <Small>No check-in logged.</Small>
        )}
        <Small>
          {a.avgHr ? `Heart rate from ${health.name}: avg ${a.avgHr}, max ${a.maxHr}` : 'No heart-rate data for this session.'}
        </Small>
      </Card>
    </Screen>
  );
}
