import { Text, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { useColors } from '../theme';

export interface Bar {
  label: string;
  value: number;
  /** Optional faint target marker (e.g. planned minutes). */
  target?: number;
}

/** Minimal bar chart; no axes on purpose — this is about trend, not numbers to chase. */
export function BarChart({ bars, height = 120, format }: { bars: Bar[]; height?: number; format?: (v: number) => string }) {
  const c = useColors();
  const max = Math.max(1, ...bars.map((b) => Math.max(b.value, b.target ?? 0)));
  const w = 100 / Math.max(6, bars.length); // keep bars slim when there are only a few weeks
  return (
    <View accessible accessibilityLabel={bars.map((b) => `${b.label}: ${format ? format(b.value) : b.value}`).join(', ')}>
      <Svg width="100%" height={height} viewBox={`0 0 100 ${height}`} preserveAspectRatio="none">
        {bars.map((b, i) => {
          const th = b.target ? (b.target / max) * (height - 4) : 0;
          return (
            <Rect key={`t${i}`} x={i * w + w * 0.15} y={height - th} width={w * 0.7} height={th} fill={c.surfaceAlt} rx={1.5} />
          );
        })}
        {bars.map((b, i) => {
          const h = (b.value / max) * (height - 4);
          return <Rect key={i} x={i * w + w * 0.15} y={height - h} width={w * 0.7} height={h} fill={c.primary} rx={1.5} />;
        })}
      </Svg>
      <View style={{ flexDirection: 'row' }}>
        {bars.map((b, i) => (
          <Text key={i} style={{ flex: 1, textAlign: 'center', fontSize: 10, color: c.textMuted }}>
            {b.label}
          </Text>
        ))}
      </View>
    </View>
  );
}
