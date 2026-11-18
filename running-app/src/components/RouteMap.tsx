import { useMemo } from 'react';
import { Text, View } from 'react-native';
import MapView, { Polyline } from 'react-native-maps';
import { trimRouteEnds } from '../domain/gps';
import type { RoutePoint } from '../domain/types';
import { radius, useColors } from '../theme';

export function RouteMap({ route, hideEnds, height = 220, thumbnail }: { route?: RoutePoint[]; hideEnds: boolean; height?: number; thumbnail?: boolean }) {
  const c = useColors();
  const shown = useMemo(() => (route ? (hideEnds ? trimRouteEnds(route) : route) : []), [route, hideEnds]);
  const region = useMemo(() => {
    if (shown.length < 2) return null;
    const lats = shown.map((p) => p.lat);
    const lngs = shown.map((p) => p.lng);
    const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max(0.004, (maxLat - minLat) * 1.4),
      longitudeDelta: Math.max(0.004, (maxLng - minLng) * 1.4),
    };
  }, [shown]);

  if (!region) {
    if (thumbnail) return null;
    return (
      <View style={{ height: 80, borderRadius: radius.md, backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center', padding: 12 }}>
        <Text style={{ color: c.textMuted, textAlign: 'center' }}>
          {route && route.length > 1 && hideEnds ? 'Route hidden for privacy (too short to show safely).' : 'No route for this session.'}
        </Text>
      </View>
    );
  }
  return (
    <View style={{ height, borderRadius: thumbnail ? 0 : radius.md, overflow: 'hidden' }} pointerEvents={thumbnail ? 'none' : 'auto'}>
      <MapView
        liteMode={thumbnail}
        style={{ flex: 1 }}
        initialRegion={region}
        scrollEnabled={false}
        zoomEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
        toolbarEnabled={false}
        accessibilityLabel="Map of your route"
      >
        <Polyline coordinates={shown.map((p) => ({ latitude: p.lat, longitude: p.lng }))} strokeColor={c.mapLine} strokeWidth={4} />
      </MapView>
    </View>
  );
}
