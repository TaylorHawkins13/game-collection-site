/** Health Connect via react-native-health-connect. Reads HR, resting HR, sleep; writes exercise sessions + route. */
import {
  aggregateRecord,
  ExerciseType,
  getSdkStatus,
  initialize,
  insertRecords,
  readRecords,
  requestPermission,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';
import { restingHrBaseline } from '../../domain/recovery';
import { toDateKey } from '../../domain/dates';
import type { Activity, ImportedRun } from '../../domain/types';
import { sleepWindow, summarizeHr, type HealthService } from './types';

let ready = false;
async function ensureInit(): Promise<boolean> {
  if (ready) return true;
  try {
    if ((await getSdkStatus()) !== SdkAvailabilityStatus.SDK_AVAILABLE) return false;
    ready = await initialize();
  } catch {
    ready = false;
  }
  return ready;
}

const between = (start: Date, end: Date) => ({ operator: 'between' as const, startTime: start.toISOString(), endTime: end.toISOString() });

export const health: HealthService = {
  name: 'Health Connect',
  isAvailable: ensureInit,
  connect: async () => {
    if (!(await ensureInit())) return false;
    try {
      const granted = await requestPermission([
        { accessType: 'read', recordType: 'HeartRate' },
        { accessType: 'read', recordType: 'RestingHeartRate' },
        { accessType: 'read', recordType: 'SleepSession' },
        { accessType: 'read', recordType: 'ExerciseSession' },
        { accessType: 'read', recordType: 'Distance' },
        { accessType: 'write', recordType: 'ExerciseSession' },
        { accessType: 'write', recordType: 'Distance' },
        { accessType: 'write', recordType: 'ExerciseRoute' },
      ]);
      return granted.length > 0;
    } catch {
      return false;
    }
  },
  readRecovery: async (today) => {
    if (!(await ensureInit())) return null;
    try {
      const { start, end } = sleepWindow(today);
      const sleep = await readRecords('SleepSession', { timeRangeFilter: between(start, end) });
      const ms = sleep.records.reduce((sum, r) => sum + (Date.parse(r.endTime) - Date.parse(r.startTime)), 0);
      const rhr = await readRecords('RestingHeartRate', {
        timeRangeFilter: between(new Date(Date.now() - 10 * 86_400_000), new Date()),
        ascendingOrder: true,
      });
      const values = rhr.records.map((r) => r.beatsPerMinute);
      return {
        date: today,
        sleepHours: ms > 0 ? ms / 3_600_000 : undefined,
        restingHr: values.length ? Math.round(values[values.length - 1]) : undefined,
        restingHrBaseline: restingHrBaseline(values),
      };
    } catch {
      return null;
    }
  },
  heartRateDuring: async (startMs, endMs) => {
    if (!(await ensureInit())) return null;
    try {
      const hr = await readRecords('HeartRate', { timeRangeFilter: between(new Date(startMs), new Date(endMs)) });
      return summarizeHr(hr.records.flatMap((r) => r.samples.map((s) => s.beatsPerMinute)));
    } catch {
      return null;
    }
  },
  latestHeartRate: async (sinceMs) => {
    if (!(await ensureInit())) return null;
    try {
      const hr = await readRecords('HeartRate', { timeRangeFilter: between(new Date(sinceMs), new Date()), ascendingOrder: false, pageSize: 1 });
      const samples = hr.records.flatMap((r) => r.samples).sort((x, y) => Date.parse(y.time) - Date.parse(x.time));
      const s = samples[0];
      return s && Date.now() - Date.parse(s.time) < 60_000 ? Math.round(s.beatsPerMinute) : null;
    } catch {
      return null;
    }
  },
  importRuns: async (sinceMs) => {
    if (!(await ensureInit())) return [];
    try {
      const res = await readRecords('ExerciseSession', { timeRangeFilter: { operator: 'after', startTime: new Date(sinceMs).toISOString() } });
      const runs = res.records.filter((r) => r.exerciseType === ExerciseType.RUNNING || r.exerciseType === ExerciseType.RUNNING_TREADMILL);
      const out: ImportedRun[] = [];
      for (const r of runs.slice(0, 300)) {
        const startedAt = Date.parse(r.startTime);
        let distanceM: number | undefined;
        try {
          const agg = await aggregateRecord({ recordType: 'Distance', timeRangeFilter: between(new Date(r.startTime), new Date(r.endTime)) });
          distanceM = agg.DISTANCE?.inMeters ? Math.round(agg.DISTANCE.inMeters) : undefined;
        } catch {
          distanceM = undefined;
        }
        out.push({
          id: `hc-${r.metadata?.id ?? startedAt}`,
          source: 'health_connect',
          externalId: r.metadata?.id ?? r.startTime,
          date: toDateKey(startedAt),
          startedAt,
          durationSec: Math.round((Date.parse(r.endTime) - startedAt) / 1000),
          distanceM,
          treadmill: r.exerciseType === ExerciseType.RUNNING_TREADMILL,
          title: r.title || 'Run',
        });
      }
      return out;
    } catch {
      return [];
    }
  },
  writeWorkout: async (a: Activity) => {
    if (!(await ensureInit())) return false;
    const startTime = new Date(a.startedAt).toISOString();
    const endTime = new Date(a.endedAt).toISOString();
    try {
      await insertRecords([
        {
          recordType: 'ExerciseSession',
          startTime,
          endTime,
          exerciseType:
            a.kind === 'strength' ? ExerciseType.STRENGTH_TRAINING : a.treadmill ? ExerciseType.RUNNING_TREADMILL : ExerciseType.RUNNING,
          title: a.title,
          ...(a.route && a.route.length > 1
            ? {
                exerciseRoute: {
                  route: a.route.map((p) => ({
                    time: new Date(p.t).toISOString(),
                    latitude: p.lat,
                    longitude: p.lng,
                    ...(p.alt != null ? { altitude: { value: p.alt, unit: 'meters' as const } } : {}),
                  })),
                },
              }
            : {}),
        },
        ...(a.distanceM
          ? [{ recordType: 'Distance' as const, startTime, endTime, distance: { value: a.distanceM, unit: 'meters' as const } }]
          : []),
      ]);
      return true;
    } catch {
      return false;
    }
  },
};
