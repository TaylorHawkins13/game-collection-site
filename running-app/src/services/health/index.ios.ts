/** Apple Health via react-native-health. Reads HR, resting HR, sleep; writes workouts. */
import Constants from 'expo-constants';
import AppleHealthKit, { type HealthKitPermissions, type HealthValue } from 'react-native-health';
import { restingHrBaseline } from '../../domain/recovery';
import { toDateKey } from '../../domain/dates';
import type { Activity, ImportedRun } from '../../domain/types';
import { unavailableHealth as unavailable } from './unavailable';
import { sleepWindow, summarizeHr, type HealthService } from './types';

const P = AppleHealthKit.Constants.Permissions;
const permissions: HealthKitPermissions = {
  permissions: {
    read: [P.HeartRate, P.RestingHeartRate, P.SleepAnalysis, P.Workout, P.StepCount, P.DistanceWalkingRunning],
    write: [P.Workout],
  },
};

function call<T>(fn: (cb: (err: string, res: T) => void) => void): Promise<T | null> {
  return new Promise((resolve) => {
    try {
      fn((err, res) => resolve(err ? null : res));
    } catch {
      resolve(null);
    }
  });
}

const ASLEEP = new Set(['ASLEEP', 'CORE', 'DEEP', 'REM']);

const appleHealth: HealthService = {
  name: 'Apple Health',
  isAvailable: async () => (await call<boolean>((cb) => AppleHealthKit.isAvailable(cb as never))) ?? false,
  connect: async () => (await call<HealthValue>((cb) => AppleHealthKit.initHealthKit(permissions, cb))) !== null,
  readRecovery: async (today) => {
    const { start, end } = sleepWindow(today);
    const sleep = await call<HealthValue[]>((cb) =>
      AppleHealthKit.getSleepSamples({ startDate: start.toISOString(), endDate: end.toISOString() }, cb),
    );
    let sleepHours: number | undefined;
    if (sleep?.length) {
      const ms = sleep
        .filter((s) => ASLEEP.has(String(s.value)))
        .reduce((sum, s) => sum + (Date.parse(s.endDate) - Date.parse(s.startDate)), 0);
      if (ms > 0) sleepHours = ms / 3_600_000;
    }
    const tenDaysAgo = new Date(Date.now() - 10 * 86_400_000).toISOString();
    const rhr = await call<HealthValue[]>((cb) =>
      AppleHealthKit.getRestingHeartRateSamples({ startDate: tenDaysAgo, ascending: true }, cb),
    );
    const values = (rhr ?? []).map((v) => v.value);
    return {
      date: today,
      sleepHours,
      restingHr: values.length ? Math.round(values[values.length - 1]) : undefined,
      restingHrBaseline: restingHrBaseline(values),
    };
  },
  heartRateDuring: async (startMs, endMs) => {
    const hr = await call<HealthValue[]>((cb) =>
      AppleHealthKit.getHeartRateSamples(
        { startDate: new Date(startMs).toISOString(), endDate: new Date(endMs).toISOString(), ascending: true },
        cb,
      ),
    );
    return summarizeHr((hr ?? []).map((v) => v.value));
  },
  latestHeartRate: async (sinceMs) => {
    const hr = await call<HealthValue[]>((cb) =>
      AppleHealthKit.getHeartRateSamples({ startDate: new Date(sinceMs).toISOString(), endDate: new Date().toISOString(), ascending: false, limit: 1 }, cb),
    );
    const v = hr?.[0];
    // Only trust it if it's fresh (last 60 s).
    return v && Date.now() - Date.parse(v.endDate) < 60_000 ? Math.round(v.value) : null;
  },
  importRuns: async (sinceMs) => {
    type W = { id?: string; activityName?: string; distance?: number; start: string; end: string; sourceId?: string; sourceName?: string };
    const ws = await call<W[]>((cb) =>
      AppleHealthKit.getSamples({ startDate: new Date(sinceMs).toISOString(), endDate: new Date().toISOString(), type: 'Workout' as never }, cb as never),
    );
    return (ws ?? [])
      .filter((w) => w.activityName === 'Running')
      .map((w): ImportedRun => {
        const startedAt = Date.parse(w.start);
        return {
          id: `ah-${w.id ?? startedAt}`,
          source: 'apple_health',
          externalId: w.id ?? `${w.start}`,
          date: toDateKey(startedAt),
          startedAt,
          durationSec: Math.round((Date.parse(w.end) - startedAt) / 1000),
          distanceM: w.distance ? Math.round(w.distance * 1609.344) : undefined,
          title: w.sourceName ? `Run (${w.sourceName})` : 'Run',
        };
      });
  },
  writeWorkout: async (a: Activity) => {
    const options = {
      type: a.kind === 'run' ? AppleHealthKit.Constants.Activities.Running : AppleHealthKit.Constants.Activities.FunctionalStrengthTraining,
      startDate: new Date(a.startedAt).toISOString(),
      endDate: new Date(a.endedAt).toISOString(),
      ...(a.distanceM ? { distance: a.distanceM, distanceUnit: 'meter' } : {}),
    };
    // Energy is deliberately omitted: we don't estimate calories.
    const res = await call<HealthValue>((cb) => AppleHealthKit.saveWorkout(options as never, cb));
    return res !== null;
  },
};

/** Builds made with STEADY_NO_HEALTH=1 have no HealthKit entitlement, so behave as if Health doesn't exist. */
export const health: HealthService = Constants.expoConfig?.extra?.healthEnabled === false ? unavailable : appleHealth;
