import { View } from 'react-native';
import { averagePace, formatDistance, formatDuration, formatPace, METERS_PER_UNIT } from '../domain/gps';
import type { Activity, ExperienceLevel, Units } from '../domain/types';
import { space } from '../theme';
import { Divider, H3, Row, Small, Stat, StatRow } from './ui';

export function ActivityStats({ a, units, level }: { a: Activity; units: Units; level: ExperienceLevel }) {
  const pace = a.distanceM ? averagePace(a.distanceM, a.durationSec, units) : null;
  // Pace is de-emphasised for newer runners: it's there, but small.
  const beginner = level === 'new' || level === 'returning';
  return (
    <View style={{ gap: space.md }}>
      <StatRow>
        {a.kind === 'run' ? <Stat label="Distance" value={formatDistance(a.distanceM, units)} /> : null}
        {a.kind === 'run' && pace && !beginner ? <Stat label="Pace" value={formatPace(pace, units)} /> : null}
        <Stat label="Time" value={formatDuration(a.durationSec)} />
        {a.avgHr ? <Stat label="Avg HR" value={`${a.avgHr} bpm`} /> : null}
      </StatRow>
      {a.kind === 'run' && pace && beginner ? (
        <Small>Average pace {formatPace(pace, units)}. Any pace that feels easy is the right pace.</Small>
      ) : null}
    </View>
  );
}

export function SplitsTable({ a, units }: { a: Activity; units: Units }) {
  if (!a.splits?.length) return null;
  return (
    <View style={{ gap: 6 }}>
      <H3>Splits</H3>
      <Row style={{ justifyContent: 'space-between' }}>
        <Small>{units === 'km' ? 'Km' : 'Mile'}</Small>
        <Small>Pace</Small>
      </Row>
      <Divider />
      {a.splits.map((s) => (
        <View key={s.index} style={{ gap: 6 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Small muted={false}>{s.distanceM < METERS_PER_UNIT[units] - 1 ? (s.distanceM / METERS_PER_UNIT[units]).toFixed(2) : String(s.index)}</Small>
            <Small muted={false}>{formatPace((s.durationSec / s.distanceM) * METERS_PER_UNIT[units], units)}</Small>
          </Row>
          <Divider />
        </View>
      ))}
    </View>
  );
}
