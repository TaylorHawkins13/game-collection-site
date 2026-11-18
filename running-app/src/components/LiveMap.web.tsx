// Browser-preview stand-in for the native live map.
import { Text, View } from 'react-native';
import type { RoutePoint } from '../domain/types';
import { useColors } from '../theme';

export function LiveMap({ points }: { points: RoutePoint[] }) {
  const c = useColors();
  return (
    <View style={{ flex: 1, backgroundColor: '#DCE3DA', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: c.textMuted }}>{points.length ? 'Live map' : 'Live map appears here once GPS locks on'}</Text>
    </View>
  );
}
