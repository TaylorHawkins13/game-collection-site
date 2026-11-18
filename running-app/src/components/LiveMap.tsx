import { useEffect, useRef } from 'react';
import MapView, { Polyline } from 'react-native-maps';
import type { RoutePoint } from '../domain/types';
import { useColors } from '../theme';

/** Full-width live map for the run screen: follows you and draws the route so far. */
export function LiveMap({ points }: { points: RoutePoint[] }) {
  const c = useColors();
  const ref = useRef<MapView>(null);
  const last = points[points.length - 1];
  useEffect(() => {
    if (last) ref.current?.animateCamera({ center: { latitude: last.lat, longitude: last.lng } }, { duration: 500 });
  }, [last?.t]);
  return (
    <MapView
      ref={ref}
      style={{ flex: 1 }}
      showsUserLocation
      followsUserLocation
      showsMyLocationButton={false}
      initialRegion={last ? { latitude: last.lat, longitude: last.lng, latitudeDelta: 0.008, longitudeDelta: 0.008 } : undefined}
      accessibilityLabel="Live map of your run"
    >
      {points.length > 1 ? (
        <Polyline coordinates={points.map((p) => ({ latitude: p.lat, longitude: p.lng }))} strokeColor={c.mapLine} strokeWidth={5} />
      ) : null}
    </MapView>
  );
}
