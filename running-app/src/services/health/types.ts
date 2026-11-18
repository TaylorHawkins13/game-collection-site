import type { Activity, DateKey, ImportedRun, RecoverySnapshot } from '../../domain/types';

export interface HealthService {
  /** 'Apple Health', 'Health Connect', or null if unsupported on this device. */
  name: string | null;
  isAvailable(): Promise<boolean>;
  connect(): Promise<boolean>;
  readRecovery(today: DateKey): Promise<RecoverySnapshot | null>;
  heartRateDuring(startMs: number, endMs: number): Promise<{ avg: number; max: number } | null>;
  writeWorkout(activity: Activity): Promise<boolean>;
  /** Most recent heart-rate sample since `sinceMs` (e.g. from a watch recording alongside). */
  latestHeartRate(sinceMs: number): Promise<number | null>;
  /** Running workouts since `sinceMs`, for importing history. */
  importRuns(sinceMs: number): Promise<ImportedRun[]>;
}

export function summarizeHr(values: number[]): { avg: number; max: number } | null {
  const v = values.filter((x) => x > 30 && x < 240);
  if (!v.length) return null;
  return { avg: Math.round(v.reduce((a, b) => a + b, 0) / v.length), max: Math.round(Math.max(...v)) };
}

/** Last night's window: 6pm yesterday → noon today (local). */
export function sleepWindow(today: DateKey): { start: Date; end: Date } {
  const [y, m, d] = today.split('-').map(Number);
  return { start: new Date(y, m - 1, d - 1, 18), end: new Date(y, m - 1, d, 12) };
}
