import { View } from 'react-native';
import { formatDuration } from '../domain/gps';
import { paceLabel } from '../domain/pace';
import { repVerdict } from '../domain/reps';
import type { Activity, Units } from '../domain/types';
import { useColors } from '../theme';
import { Divider, H3, Row, Small } from './ui';

export function RepsTable({ a, units, target }: { a: Activity; units: Units; target?: number }) {
  const c = useColors();
  if (!a.reps?.length) return null;
  return (
    <View style={{ gap: 6 }}>
      <H3>Reps{target ? ` · target ${paceLabel(target, units)}/${units}` : ''}</H3>
      {a.reps.map((r) => {
        const v = target && r.paceSecPerKm ? repVerdict(r.paceSecPerKm, target) : null;
        return (
          <View key={r.index} style={{ gap: 6 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Small muted={false}>
                Rep {r.index} · {formatDuration(r.durationSec)} · {(r.distanceM / (units === 'km' ? 1000 : 1609.344)).toFixed(2)} {units}
              </Small>
              <Small muted={false} style={{ color: v === 'on_target' ? c.primary : v ? c.accent : c.text, fontWeight: '700' }}>
                {r.paceSecPerKm ? `${paceLabel(r.paceSecPerKm, units)}/${units}` : '—'}
                {v === 'on_target' ? ' ✓' : v === 'quick' ? ' quick' : v === 'slow' ? ' slow' : ''}
              </Small>
            </Row>
            <Divider />
          </View>
        );
      })}
    </View>
  );
}
