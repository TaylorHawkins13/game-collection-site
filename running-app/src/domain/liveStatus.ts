/** Text for the lock-screen Live Activity (iOS) / ongoing notification (Android) during a run. */
import { walkRunPhase } from './cues.ts';
import { currentPace, formatDuration, formatPace, METERS_PER_UNIT, movingMs, type TrackerState } from './gps.ts';
import type { PlannedSession, Units } from './types.ts';

export interface LiveStatus {
  title: string;
  subtitle: string;
  /** Epoch ms when the current interval ends — the OS counts down to it without the app. */
  phaseEndsAt?: number;
  /** 0..1 through the planned session, when there's no interval countdown. */
  progress?: number;
}

const PHASE: Record<string, string> = { warmup: 'Warm-up', run: 'Run', walk: 'Walk', cooldown: 'Cool-down', done: 'Done' };

export function liveStatus(t: TrackerState, session: PlannedSession | null, now: number, units: Units, hr: number | null): LiveStatus {
  const elapsed = movingMs(t, now) / 1000;
  const dist = t.treadmill ? null : `${(t.distanceM / METERS_PER_UNIT[units]).toFixed(2)} ${units}`;
  const title = t.paused ? `Paused · ${formatDuration(elapsed)}` : [formatDuration(elapsed), dist].filter(Boolean).join(' · ');
  const pace = t.treadmill ? null : currentPace(t, now);
  const bits = [pace ? formatPace(pace, units) : null, hr ? `♥ ${hr}` : null];
  const structure = session?.walkRun ?? session?.workout;
  if (structure && !t.paused) {
    const ph = walkRunPhase(structure, elapsed);
    const label = session?.workout ? (ph.phase === 'run' ? (session.runType === 'hills' ? 'Uphill' : 'Hard') : ph.phase === 'walk' ? 'Easy jog' : PHASE[ph.phase]) : PHASE[ph.phase];
    const rep = ph.repeat > 0 && ph.phase !== 'done' ? ` ${ph.repeat}/${structure.repeats}` : '';
    return {
      title,
      subtitle: [`${label}${rep}`, ...bits].filter(Boolean).join(' · '),
      phaseEndsAt: ph.phase === 'done' ? undefined : now + ph.remainingSec * 1000,
    };
  }
  const planned = (session?.durationMin ?? 0) * 60;
  return {
    title,
    subtitle: [...bits, session ? session.title : 'Easy run'].filter(Boolean).join(' · '),
    progress: planned > 0 ? Math.min(1, elapsed / planned) : undefined,
  };
}
