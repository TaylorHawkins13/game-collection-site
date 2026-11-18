/** Activity history: filters, simple charts (volume + completion trend), chronological list. */
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { BarChart } from '../../components/BarChart';
import { Body, Card, Chip, H1, H3, Row, Screen, SectionTitle, Small } from '../../components/ui';
import { formatShort, weekdayShort } from '../../domain/dates';
import { formatDistance, formatDuration, METERS_PER_UNIT } from '../../domain/gps';
import { countsTowardCompletion } from '../../domain/metrics';
import { seasonFor } from '../../domain/season';
import { today as getToday, useStore } from '../../state/store';
import { space, useColors } from '../../theme';

type KindFilter = 'all' | 'run' | 'strength';
type RangeFilter = 'season' | 'all';

export default function ActivityTab() {
  const c = useColors();
  const app = useStore((s) => s.app);
  const [kind, setKind] = useState<KindFilter>('all');
  const [range, setRange] = useState<RangeFilter>('season');
  const [volume, setVolume] = useState<'time' | 'distance'>('time');
  const today = getToday();
  const season = seasonFor(today);
  const units = app.profile?.units ?? 'km';
  const beginner = app.profile?.level === 'new' || app.profile?.level === 'returning';

  const list = useMemo(
    () =>
      app.activities
        .filter((a) => kind === 'all' || a.kind === kind)
        .filter((a) => range === 'all' || (a.date >= season.start && a.date <= season.end))
        .sort((a, b) => b.startedAt - a.startedAt),
    [app.activities, kind, range, season.start],
  );

  const weeks = (app.plan?.weeks ?? []).filter((w) => w.start <= today).slice(-8);
  const volumeBars = weeks.map((w) => {
    const acts = app.activities.filter((a) => a.date >= w.start && a.date <= w.end && (kind === 'all' || a.kind === kind));
    const value =
      volume === 'time' ? acts.reduce((s, a) => s + a.durationSec, 0) / 60 : acts.reduce((s, a) => s + (a.distanceM ?? 0), 0) / METERS_PER_UNIT[units];
    const target = volume === 'time' ? w.sessions.filter((s) => s.status !== 'dropped' && (kind === 'all' || s.kind === kind)).reduce((s, x) => s + x.durationMin, 0) : undefined;
    return { label: `W${w.index + 1}`, value, target };
  });
  const completionBars = weeks.map((w) => {
    const core = w.sessions.filter(countsTowardCompletion);
    const due = core.filter((s) => s.date < today || s.status === 'completed');
    return { label: `W${w.index + 1}`, value: due.length ? (due.filter((s) => s.status === 'completed').length / due.length) * 100 : 0, target: 100 };
  });

  return (
    <Screen>
      <H1>Activity</H1>
      <Row>
        {(['all', 'run', 'strength'] as KindFilter[]).map((k) => (
          <Chip key={k} label={k === 'all' ? 'All' : k === 'run' ? 'Runs' : 'Strength'} selected={kind === k} onPress={() => setKind(k)} />
        ))}
        <View style={{ width: space.sm }} />
        {(['season', 'all'] as RangeFilter[]).map((r) => (
          <Chip key={r} label={r === 'season' ? 'This season' : 'All time'} selected={range === r} onPress={() => setRange(r)} />
        ))}
      </Row>

      {weeks.length > 0 ? (
        <>
          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <H3>Weekly {volume === 'time' ? 'minutes' : units}</H3>
              {kind !== 'strength' && !beginner ? (
                <Row>
                  <Chip label="Time" selected={volume === 'time'} onPress={() => setVolume('time')} />
                  <Chip label="Distance" selected={volume === 'distance'} onPress={() => setVolume('distance')} />
                </Row>
              ) : null}
            </Row>
            <BarChart bars={volumeBars} format={(v) => (volume === 'time' ? `${Math.round(v)} min` : `${v.toFixed(1)} ${units}`)} />
            {volume === 'time' ? <Small>Shaded: planned minutes. Matching the plan beats exceeding it.</Small> : null}
          </Card>
          <Card>
            <H3>Plan completion by week</H3>
            <BarChart bars={completionBars} height={90} format={(v) => `${Math.round(v)}%`} />
          </Card>
        </>
      ) : null}

      <SectionTitle>Sessions</SectionTitle>
      {list.length === 0 ? <Body muted>Nothing here yet. Your first session will show up here.</Body> : null}
      {list.map((a) => (
        <Card key={a.id} onPress={() => router.push(`/history/${a.id}`)}>
          <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Small>
                {weekdayShort(a.date)} {formatShort(a.date)}
                {a.plannedSessionId ? '' : ' · extra'}
              </Small>
              <H3>{a.title}</H3>
              <Small>
                {formatDuration(a.durationSec)}
                {a.distanceM ? ` · ${formatDistance(a.distanceM, units)}` : ''}
                {a.feel ? ` · felt ${a.feel === 'just_right' ? 'just right' : a.feel}` : ''}
              </Small>
            </View>
            <Small style={{ color: c.primary, fontWeight: '700' }}>+{a.xpEarned} XP</Small>
          </Row>
        </Card>
      ))}
    </Screen>
  );
}
