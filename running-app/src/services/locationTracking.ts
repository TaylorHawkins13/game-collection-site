/**
 * GPS for runs. Uses a background location task (screen-off / app
 * backgrounded) when the user grants background access, and falls back to a
 * foreground watcher otherwise. Fixes go straight into the persisted run store,
 * so nothing depends on React being mounted. No network needed: recording works
 * fully offline.
 *
 * This module must be imported at app start (see app/_layout.tsx) so the task
 * is defined before the OS delivers background updates.
 */
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import type { RawFix } from '../domain/gps';
import { useRunStore } from '../state/runStore';

export const RUN_LOCATION_TASK = 'steady-run-location';

type Listener = () => void;
let backgroundListener: Listener | null = null;
/** The run screen registers this so audio cues keep firing while the screen is off. */
export function setBackgroundTickListener(l: Listener | null) {
  backgroundListener = l;
}

function toFix(l: Location.LocationObject): RawFix {
  return { lat: l.coords.latitude, lng: l.coords.longitude, t: l.timestamp, accuracy: l.coords.accuracy, alt: l.coords.altitude };
}

if (Platform.OS !== 'web' && !TaskManager.isTaskDefined(RUN_LOCATION_TASK)) {
  TaskManager.defineTask<{ locations: Location.LocationObject[] }>(RUN_LOCATION_TASK, async ({ data, error }) => {
    if (error || !data?.locations?.length) return;
    useRunStore.getState().ingest(data.locations.map(toFix));
    backgroundListener?.();
  });
}

let foregroundSub: Location.LocationSubscription | null = null;

export type TrackingMode = 'background' | 'foreground' | 'denied';

export async function locationPermissionStatus(): Promise<{ foreground: boolean; background: boolean }> {
  const [fg, bg] = await Promise.all([Location.getForegroundPermissionsAsync(), Location.getBackgroundPermissionsAsync()]);
  return { foreground: fg.granted, background: bg.granted };
}

export async function startTracking(): Promise<TrackingMode> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (!fg.granted) return 'denied';
  let background = false;
  try {
    background = (await Location.requestBackgroundPermissionsAsync()).granted;
  } catch {
    background = false;
  }
  if (background) {
    await Location.startLocationUpdatesAsync(RUN_LOCATION_TASK, {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: 1000,
      distanceInterval: 0,
      activityType: Location.LocationActivityType.Fitness,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'Run in progress',
        notificationBody: 'Steady is recording your run.',
        notificationColor: '#2F7D62',
        killServiceOnDestroy: false,
      },
    });
    return 'background';
  }
  foregroundSub = await Location.watchPositionAsync(
    { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 0 },
    (l) => useRunStore.getState().ingest([toFix(l)]),
  );
  return 'foreground';
}

export async function stopTracking(): Promise<void> {
  foregroundSub?.remove();
  foregroundSub = null;
  try {
    if (await Location.hasStartedLocationUpdatesAsync(RUN_LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(RUN_LOCATION_TASK);
    }
  } catch {
    // Task wasn't running; nothing to stop.
  }
}

/** After a crash/kill: is the OS still delivering to our task? Restart the foreground watcher if not. */
export async function ensureTrackingAfterRestore(): Promise<TrackingMode> {
  try {
    if (await Location.hasStartedLocationUpdatesAsync(RUN_LOCATION_TASK)) return 'background';
  } catch {
    // fall through
  }
  return startTracking();
}

export const isAndroid = Platform.OS === 'android';
