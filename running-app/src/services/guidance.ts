/**
 * Audio guidance loop. Runs from a 1s foreground interval AND from the
 * background location task, so cues keep working with the screen off.
 * All state lives in the persisted run store, so double-calls are harmless.
 */
import { buildCues, dueCues, EASE_OFF_CUE, shouldSuggestEasing, type Cue } from '../domain/cues';
import { findSession } from '../domain/engine';
import { averagePace, currentPace, METERS_PER_UNIT, movingMs } from '../domain/gps';
import { pacesFor } from '../domain/pace';
import type { AppState, Units } from '../domain/types';
import { useRunStore } from '../state/runStore';
import { useStore } from '../state/store';
import { speak } from './audio';

let cachedFor: string | null = null;
let cachedCues: Cue[] = [];

function cuesFor(app: AppState, plannedSessionId: string | undefined): Cue[] {
  const key = `${plannedSessionId ?? 'free'}:${app.profile?.level}`;
  if (cachedFor === key) return cachedCues;
  const found = plannedSessionId ? findSession(app, plannedSessionId) : null;
  const units = app.profile?.units ?? 'km';
  const target = found?.session.targetPaceSecPerKm;
  const spoken = target ? spokenPace(units === 'km' ? target : target * METERS_PER_UNIT.mi / 1000, units) : undefined;
  cachedCues = found && app.profile ? buildCues(found.session, app.profile.level, spoken) : [];
  cachedFor = key;
  return cachedCues;
}

/** Median pace of recent comfortable runs, for the light "ease off" nudge. */
export function typicalEasyPace(app: AppState, units: Units): number | null {
  const paces = app.activities
    .filter((a) => a.kind === 'run' && !a.treadmill && (a.feel === 'easy' || a.feel === 'just_right') && (a.distanceM ?? 0) > 800)
    .slice(0, 5)
    .map((a) => averagePace(a.distanceM!, a.durationSec, units))
    .filter((p): p is number => p !== null)
    .sort((a, b) => a - b);
  if (paces.length < 2) return null;
  return paces[Math.floor(paces.length / 2)];
}

function spokenPace(secPerUnit: number, units: Units): string {
  const s = Math.round(secPerUnit);
  return `${Math.floor(s / 60)} minutes ${s % 60} seconds per ${units === 'km' ? 'kilometer' : 'mile'}`;
}

export function guidanceTick() {
  const run = useRunStore.getState();
  const a = run.active;
  if (!a || a.tracker.paused) return;
  const app = useStore.getState().app;
  const profile = app.profile;
  if (!profile?.audioCues) return;
  const now = Date.now();
  const elapsed = movingMs(a.tracker, now) / 1000;

  const cues = cuesFor(app, a.plannedSessionId);
  const due = dueCues(cues, elapsed, new Set(a.firedCues));
  if (due.length) {
    // If several are due at once (e.g. after a gap), only say the latest.
    due.forEach((i) => run.markCue(i));
    speak(cues[due[due.length - 1]].text);
    return;
  }

  if (profile.splitAnnouncements && a.tracker.splits.length > a.announcedSplits) {
    const split = a.tracker.splits[a.tracker.splits.length - 1];
    run.setAnnouncedSplits(a.tracker.splits.length);
    const unitWord = profile.units === 'km' ? 'kilometer' : 'mile';
    speak(`${split.index} ${unitWord}${split.index > 1 ? 's' : ''}. Last split ${spokenPace(split.durationSec * (METERS_PER_UNIT[profile.units] / split.distanceM), profile.units)}.`);
    return;
  }

  const found = a.plannedSessionId ? findSession(app, a.plannedSessionId) : null;
  const easyRun = !found || found.session.runType === 'easy' || found.session.runType === 'long';
  if (easyRun) {
    const paces = pacesFor(profile.pbs ?? [], profile.level);
    const pbEasyFast = paces ? (profile.units === 'km' ? paces.easy[0] : (paces.easy[0] * METERS_PER_UNIT.mi) / 1000) : null;
    if (
      shouldSuggestEasing({
        pbEasyFast,
        level: profile.level,
        elapsedSec: elapsed,
        currentPace: currentPace(a.tracker, now, 60),
        typicalEasyPace: typicalEasyPace(app, profile.units),
        alreadySaid: a.easeOffSaid,
      })
    ) {
      run.setEaseOffSaid();
      speak(EASE_OFF_CUE);
    }
  }
}
