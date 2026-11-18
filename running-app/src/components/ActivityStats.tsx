import { View } from 'react-native';
import { averagePace, formatDistance, formatDuration, formatPace, METERS_PER_UNIT } from '../domain/gps';
import type { Activity, ExperienceLevel, Units } from '../domain/types';
import { space } from '../theme';
import { Divider, H3, Row, Small, Stat } from './ui';

export function ActivityStats({ a, units, level }: { a: Activity; units: Units; level: ExperienceLevel }) {
  const pace = a.distanceM ? averagePace(a.distanceM, a.durationSec, units) : null;
  // Pace is de-emphasised for newer runners: it's there, but small.
  const beginner = level === 'new' || level === 'returning';
  return (
    <View style={{ gap: space.md }}>
      <Row style={{ flexWrap: 'nowrap' }}>
        <Stat label="time" value={formatDuration(a.durationSec)} />
        {a.kind === 'run' ? <Stat label="distance" value={formatDistance(a.distanceM, units)} /> : null}
        {a.avgHr ? <Stat label="avg HR" value={`${a.avgHr}`} /> : null}
      </Row>
      {a.kind === 'run' && pace ? (
        beginner ? (
          <Small>Average pace {formatPace(pace, units)} — any pace that feels easy is the right pace.</Small>
        ) : (
          <Row>
            <Stat label="avg pace" value={formatPace(pace, units)} />
            {a.maxHr ? <Stat label="max HR" value={`${a.maxHr}`} /> : null}
          </Row>
        )
      ) : null}
    </View>
  );
}

export function SplitsTable({ a, units }: { a: Activity; units: Units }) {
  if (!a.splits?.length) return null;
  return (
    <View style={{ gap: 6 }}>
      <H3>Splits</H3>
      {a.splits.map((s) => (
        <View key={s.index} style={{ gap: 6 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Small muted={false}>
              {s.distanceM < METERS_PER_UNIT[units] - 1 ? `${(s.distanceM / METERS_PER_UNIT[units]).toFixed(2)} ${units}` : `${units} ${s.index}`}
            </Small>
            <Small muted={false}>{formatPace((s.durationSec / s.distanceM) * METERS_PER_UNIT[units], units)}</Small>
          </Row>
          <Divider />
        </View>
      ))}
    </View>
  );
}
