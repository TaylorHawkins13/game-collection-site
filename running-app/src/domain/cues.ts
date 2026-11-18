/**
 * Audio cue schedules for guided sessions. Walk-run sessions get interval
 * prompts; newer runners get a few sparse form reminders; pace guidance only
 * fires if someone is clearly running faster than their usual easy effort.
 */
import type { ExperienceLevel, PlannedSession, WalkRunStructure } from './types.ts';

export interface Cue {
  atSec: number;
  text: string;
  kind: 'interval' | 'form' | 'info' | 'end';
}

function say(sec: number): string {
  if (sec < 60) return `${sec} seconds`;
  const m = sec / 60;
  if (Number.isInteger(m)) return m === 1 ? '1 minute' : `${m} minutes`;
  return `${Math.floor(m)} and a half minutes`;
}

export function walkRunCues(w: WalkRunStructure): Cue[] {
  const cues: Cue[] = [{ atSec: 0, kind: 'interval', text: `Warm up with an easy walk for ${say(w.warmupMin * 60)}.` }];
  let t = w.warmupMin * 60;
  const half = Math.ceil(w.repeats / 2);
  for (let i = 1; i <= w.repeats; i++) {
    const prefix = i === w.repeats ? 'Last one. ' : i === half + 1 && w.repeats >= 4 ? 'Halfway there. ' : '';
    cues.push({ atSec: t, kind: 'interval', text: `${prefix}Run for ${say(w.runSec)}. Easy and relaxed.` });
    t += w.runSec;
    cues.push({
      atSec: t,
      kind: 'interval',
      text: i === w.repeats ? `Nice work. Walk for ${say(w.walkSec)}.` : `Walk for ${say(w.walkSec)}.`,
    });
    t += w.walkSec;
  }
  cues.push({ atSec: t, kind: 'interval', text: `Cool down with an easy walk for ${say(w.cooldownMin * 60)}.` });
  t += w.cooldownMin * 60;
  cues.push({ atSec: t, kind: 'end', text: 'That’s the session done. Great job showing up today.' });
  return cues;
}

const FORM = [
  'Relax your shoulders and unclench your hands.',
  'Short, light steps. Stand tall.',
  'Breathe easy. If you can’t talk, slow down or walk — that’s allowed.',
];

export function buildCues(session: PlannedSession, level: ExperienceLevel): Cue[] {
  const newer = level === 'new' || level === 'returning';
  let cues: Cue[];
  const total = session.durationMin * 60;
  if (session.walkRun) {
    cues = walkRunCues(session.walkRun);
  } else {
    cues = [{ atSec: 0, kind: 'info', text: 'Easy effort today. You should be able to talk in full sentences.' }];
    if (session.strides) {
      const start = Math.max(total - 8 * 60, Math.round(total * 0.5));
      for (let i = 0; i < session.strides; i++) {
        const at = start + i * 80;
        cues.push({ atSec: at, kind: 'interval', text: i === 0 ? 'Stride: 20 seconds quick and smooth. Not a sprint.' : 'Stride.' });
        cues.push({ atSec: at + 20, kind: 'interval', text: 'Ease off and jog or walk.' });
      }
    }
    if (total >= 20 * 60) cues.push({ atSec: Math.round(total / 2), kind: 'info', text: 'Halfway. Nice and steady.' });
    if (total >= 15 * 60) cues.push({ atSec: total - 5 * 60, kind: 'info', text: 'Five minutes to go.' });
    cues.push({ atSec: total, kind: 'end', text: 'Planned time done. Walk it out and stretch if you like.' });
  }
  if (newer) {
    [6, 14, 22].forEach((min, i) => {
      const at = min * 60;
      if (at < total - 60 && !cues.some((c) => Math.abs(c.atSec - at) < 30)) cues.push({ atSec: at, kind: 'form', text: FORM[i] });
    });
  }
  return cues.sort((a, b) => a.atSec - b.atSec);
}

/** Cues that should fire now. Missed cues older than `graceSec` are skipped (e.g. after the app was killed). */
export function dueCues(cues: Cue[], elapsedSec: number, fired: Set<number>, graceSec = 20): number[] {
  const out: number[] = [];
  cues.forEach((c, i) => {
    if (!fired.has(i) && c.atSec <= elapsedSec && elapsedSec - c.atSec <= graceSec) out.push(i);
  });
  return out;
}

export type Phase = 'warmup' | 'run' | 'walk' | 'cooldown' | 'done';

export function walkRunPhase(w: WalkRunStructure, elapsedSec: number): { phase: Phase; remainingSec: number; repeat: number } {
  let t = w.warmupMin * 60;
  if (elapsedSec < t) return { phase: 'warmup', remainingSec: t - elapsedSec, repeat: 0 };
  for (let i = 1; i <= w.repeats; i++) {
    if (elapsedSec < t + w.runSec) return { phase: 'run', remainingSec: t + w.runSec - elapsedSec, repeat: i };
    t += w.runSec;
    if (elapsedSec < t + w.walkSec) return { phase: 'walk', remainingSec: t + w.walkSec - elapsedSec, repeat: i };
    t += w.walkSec;
  }
  const end = t + w.cooldownMin * 60;
  if (elapsedSec < end) return { phase: 'cooldown', remainingSec: end - elapsedSec, repeat: w.repeats };
  return { phase: 'done', remainingSec: 0, repeat: w.repeats };
}

/**
 * Light pace guidance: only for newer runners on continuous runs, only when
 * clearly faster (>12%) than their typical easy pace, and only after 3 minutes.
 */
export function shouldSuggestEasing(opts: {
  level: ExperienceLevel;
  elapsedSec: number;
  currentPace: number | null;
  typicalEasyPace: number | null;
  alreadySaid: boolean;
}): boolean {
  if (opts.alreadySaid || opts.elapsedSec < 180) return false;
  if (opts.level !== 'new' && opts.level !== 'returning') return false;
  if (!opts.currentPace || !opts.typicalEasyPace) return false;
  return opts.currentPace < opts.typicalEasyPace * 0.88;
}

export const EASE_OFF_CUE = 'You’re moving a bit quicker than usual. Easing off will make this feel better.';
