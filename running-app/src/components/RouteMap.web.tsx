// Web preview fallback (react-native-maps is native-only). Used only for browser previews/tests.
import { Text, View } from 'react-native';
import type { RoutePoint } from '../domain/types';
import { radius, useColors } from '../theme';

export function RouteMap({ route, thumbnail }: { route?: RoutePoint[]; hideEnds: boolean; height?: number; thumbnail?: boolean }) {
  const c = useColors();
  if (thumbnail && !route?.length) return null;
  return (
    <View style={{ height: 80, borderRadius: radius.md, backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: c.textMuted }}>{route?.length ? `Route recorded (${route.length} points) — map shows on device.` : 'No route for this session.'}</Text>
    </View>
  );
}
