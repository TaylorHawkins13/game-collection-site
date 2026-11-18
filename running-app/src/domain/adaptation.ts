/**
 * Plan adaptation from post-session feedback and weekly outcomes.
 *
 *  - Noticeable soreness → the next run in the following 2 days becomes a
 *    mobility session, and the rest of the week is eased.
 *  - Repeated "Hard" (2 of the last 3 check-ins) → rest of week eased, next week eases.
 *  - Consistent Easy/Just right with no soreness + good completion → next week
 *    may progress one step.
 *  - Missed sessions never trigger anything punitive; a low-completion week
 *    simply holds (or eases, after a long gap).
 */
import { addDays, weekdayLong } from './dates.ts';
import { buildRun, isRecoveryWeek } from './plan.ts';
import { mobilityFallback } from './strength.ts';
import type { Activity, PlanWeek, PlannedSession, Profile, WeekDirective } from './types.ts';

const EASED = 'Eased after your feedback.';

export function easeSession(s: PlannedSession): PlannedSession {
  if (s.kind !== 'run' || s.status !== 'planned' || s.note?.includes(EASED)) return s;
  if (s.runType === 'walk_run' && typeof s.step === 'number') {
    const eased = buildRun(s.id, s.date, { step: Math.max(0, s.step - 1), multiplier: 1, long: false, strides: false });
    return { ...eased, note: EASED, movedFrom: s.movedFrom };
  }
  const minutes = Math.max(10, Math.round((s.durationMin * 0.8) / 5) * 5);
  return {
    ...s,
    runType: s.runType === 'strides' || s.runType === 'tempo' || s.runType === 'intervals' ? 'easy' : s.runType,
    strides: undefined,
    workout: undefined,
    targetPaceSecPerKm: undefined,
    durationMin: minutes,
    title: s.runType === 'long' ? `Longer easy run · ${minutes} min` : `Easy run · ${minutes} min`,
    note: EASED,
  };
}

export interface FeedbackAdaptation {
  week: PlanWeek;
  note: string | null;
  swapped: boolean;
}

export function adaptAfterFeedback(week: PlanWeek, activity: Activity, recent: Activity[], profile: Profile): FeedbackAdaptation {
  const after = (s: PlannedSession) => s.date > activity.date && s.status === 'planned';
  let sessions = week.sessions;
  let note: string | null = null;
  let swapped = false;

  if (activity.soreness === 'noticeable') {
    const target = sessions.find((s) => after(s) && s.kind === 'run' && s.date <= addDays(activity.date, 2));
    const routine = mobilityFallback(profile.issues);
    sessions = sessions.map((s) => {
      if (target && s.id === target.id) {
        swapped = true;
        return {
          ...s,
          id: `${s.id}-m`,
          kind: 'strength' as const,
          runType: undefined,
          walkRun: undefined,
          workout: undefined,
          targetPaceSecPerKm: undefined,
          strides: undefined,
          step: undefined,
          title: routine.title,
          durationMin: routine.durationMin,
          routineId: routine.id,
          replacedFrom: 'run' as const,
          note: 'Swapped in after you reported soreness. Gentle movement helps recovery.',
        };
      }
      return after(s) ? easeSession(s) : s;
    });
    note = target
      ? `Thanks for telling us. ${weekdayLong(target.date)}'s run is now a ${routine.durationMin}-min mobility session, and the rest of the week is a bit easier. If pain is sharp or lasts, check with a professional.`
      : 'Thanks for telling us. The rest of this week is a bit easier. If pain is sharp or lasts, check with a professional.';
  } else {
    const lastThree = [activity, ...recent.filter((a) => a.id !== activity.id && a.feel)].slice(0, 3);
    const hard = lastThree.filter((a) => a.feel === 'hard').length;
    if (activity.feel === 'hard' && hard >= 2) {
      sessions = sessions.map((s) => (after(s) ? easeSession(s) : s));
      note = 'A couple of sessions have felt hard, so the rest of this week is a little lighter. That’s the plan working, not you failing.';
    } else if (activity.feel === 'hard') {
      note = 'Felt hard? Next time, slow down or take an extra walk break. Easy should feel easy.';
    } else if (activity.soreness === 'mild') {
      note = 'Mild soreness is normal while your body adapts. If it’s still there next session, keep it extra easy.';
    }
  }
  return { week: { ...week, sessions }, note, swapped };
}

export interface WeekOutcome {
  completion: number; // core sessions completed / due (excluding paused)
  completedCount: number;
  pausedDays: number;
  feelings: Activity[];
  daysSinceLastActivity: number | null;
}

export function directiveFor(outcome: WeekOutcome, nextIndex: number, step: number): { directive: WeekDirective; reason: string } {
  const hard = outcome.feelings.filter((a) => a.feel === 'hard').length;
  const noticeable = outcome.feelings.some((a) => a.soreness === 'noticeable');
  const mild = outcome.feelings.filter((a) => a.soreness === 'mild').length;
  const allGood = outcome.feelings.every((a) => (a.feel === 'easy' || a.feel === 'just_right') && a.soreness !== 'noticeable');

  let d: WeekDirective;
  let reason: string;
  if (noticeable || hard >= 2) {
    d = 'ease';
    reason = 'Last week had some tough moments, so this week is lighter.';
  } else if (outcome.pausedDays >= 3) {
    d = 'ease';
    reason = 'Welcome back! Starting gently after your break.';
  } else if (outcome.completedCount === 0) {
    d = (outcome.daysSinceLastActivity ?? 0) >= 10 ? 'ease' : 'hold';
    reason = 'Life happens. This week picks up right where you are — no catching up needed.';
  } else if (outcome.completion < 0.75) {
    d = 'hold';
    reason = 'Same as last week. Repeating a week is a perfectly good plan.';
  } else if (hard === 1 || mild >= 2 || !allGood) {
    d = 'hold';
    reason = 'Holding steady for a week so things feel comfortable before the next step.';
  } else {
    d = 'progress';
    reason = 'Last week went well, so this one takes a small step up.';
  }
  if (d !== 'ease' && isRecoveryWeek(nextIndex, step)) {
    return { directive: 'recovery', reason: 'Recovery week: slightly less, on purpose. This is when fitness sinks in.' };
  }
  return { directive: d, reason };
}
