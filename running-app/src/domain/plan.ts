/**
 * Training plan generation.
 *
 * A plan is a list of 7-day weeks anchored on the day the user onboarded (so
 * week 1 always starts *today* and there is never a half-empty first week).
 * Run volume comes from a single progression ladder: walk-run steps first,
 * then continuous easy running. Each week moves at most one step, and only
 * when the previous week's feedback and completion earned it.
 */
import { addDays, diffDays, weekday } from './dates.ts';
import { pickChallenge } from './challenges.ts';
import { isFasterGoal, pacesFor, trainingPaces } from './pace.ts';
import { pickRoutines } from './strength.ts';
import type {
  DateKey,
  ExperienceLevel,
  GoalId,
  PlanState,
  PlanWeek,
  PlannedSession,
  Profile,
  WalkRunStructure,
  WeekDirective,
  WeeklyFrequency,
  PersonalBest,
} from './types.ts';

export interface StepTemplate {
  walkRun?: WalkRunStructure;
  minutes: number;
}

function wr(runSec: number, walkSec: number, repeats: number): StepTemplate {
  const walkRun = { warmupMin: 3, runSec, walkSec, repeats, cooldownMin: 2 };
  return { walkRun, minutes: walkRunMinutes(walkRun) };
}

export function walkRunMinutes(w: WalkRunStructure): number {
  return Math.round(w.warmupMin + (w.repeats * (w.runSec + w.walkSec)) / 60 + w.cooldownMin);
}

/** The progression ladder. Index = "step". */
export const LADDER: StepTemplate[] = [
  wr(30, 90, 6), // 0  ~17 min
  wr(60, 90, 6), // 1  ~20
  wr(60, 60, 8), // 2  ~21
  wr(90, 60, 7), // 3  ~23
  wr(120, 60, 6), // 4 ~23
  wr(180, 90, 5), // 5 ~28
  wr(240, 60, 5), // 6 ~30
  wr(360, 60, 4), // 7 ~33
  wr(480, 60, 3), // 8 ~32
  wr(600, 60, 2), // 9 ~27
  { minutes: 20 }, // 10 continuous from here
  { minutes: 25 },
  { minutes: 30 },
  { minutes: 35 },
  { minutes: 40 },
  { minutes: 45 },
  { minutes: 50 },
  { minutes: 55 },
  { minutes: 60 },
];

export const FIRST_CONTINUOUS_STEP = 10;

export function startingStep(level: ExperienceLevel, freq: WeeklyFrequency | null, pbs: PersonalBest[] = []): number {
  const f = freq ?? 0;
  // A recent half or marathon PB means the legs are used to longer running: start one step higher.
  const recentLong = pbs.some((p) => p.recency === 'recent' && (p.distance === 'half' || p.distance === 'marathon'));
  if (recentLong && (level === 'consistent' || level === 'experienced')) return level === 'consistent' ? 12 : 14;
  switch (level) {
    case 'new':
      return [0, 1, 2, 3][f];
    case 'returning':
      return [3, 4, 10, 11][f];
    case 'consistent':
      return 11;
    case 'experienced':
      return 13;
  }
}

export function defaultRunsPerWeek(level: ExperienceLevel): number {
  return level === 'experienced' ? 4 : 3;
}

export function defaultStrengthPerWeek(level: ExperienceLevel): number {
  return level === 'new' || level === 'returning' ? 1 : 2;
}

/** Highest step a goal needs; beyond this the plan maintains rather than builds. */
export function stepCap(goal: GoalId, level: ExperienceLevel): number {
  const beginner = level === 'new' || level === 'returning';
  switch (goal) {
    case 'run30':
    case '5k':
      return 12;
    case 'habit':
    case 'fitness':
    case 'stress':
      return beginner ? 12 : level === 'consistent' ? 13 : 14;
    case 'back_to_routine':
    case '5k_faster':
      return 13;
    case '10k':
    case '10k_faster':
      return 15;
    case 'half':
    case 'half_faster':
      return 17;
    case 'marathon':
      return 18;
    default:
      return 12;
  }
}

const DEFAULT_OFFSETS: Record<number, number[]> = {
  1: [0],
  2: [0, 3],
  3: [0, 2, 4],
  4: [0, 2, 3, 5],
  5: [0, 1, 3, 4, 6],
};

/** Dates in the week for each run, honouring preferred weekdays when given. */
export function runDates(weekStart: DateKey, runs: number, preferredDays: number[]): DateKey[] {
  const n = Math.max(1, Math.min(5, runs));
  if (preferredDays.length >= n) {
    const days = [...new Set(preferredDays)].slice(0, n);
    // Map each weekday to its date inside this 7-day window.
    return days.map((d) => addDays(weekStart, (d - weekday(weekStart) + 7) % 7)).sort();
  }
  return DEFAULT_OFFSETS[n].map((o) => addDays(weekStart, o));
}

function strengthDates(weekStart: DateKey, runDays: DateKey[], count: number): DateKey[] {
  const all = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const free = all.filter((d) => !runDays.includes(d));
  // Prefer the day after a run (fresh legs aren't needed for mobility).
  const preferred = free.filter((d) => runDays.includes(addDays(d, -1)));
  const ordered = [...preferred, ...free.filter((d) => !preferred.includes(d))];
  const picks: DateKey[] = [];
  for (const d of ordered) {
    if (picks.length >= count) break;
    if (picks.some((p) => Math.abs(diffDays(p, d)) === 1)) continue;
    picks.push(d);
  }
  for (const d of ordered) if (picks.length < count && !picks.includes(d)) picks.push(d);
  return picks.sort();
}

function round5(n: number): number {
  return Math.max(10, Math.round(n / 5) * 5);
}

function formatSec(sec: number): string {
  if (sec < 60) return `${sec} sec`;
  const m = sec / 60;
  const whole = Math.floor(m);
  const half = m - whole >= 0.5;
  return `${half ? (whole === 0 ? '½' : `${whole}½`) : whole} min`;
}

export function walkRunTitle(w: WalkRunStructure): string {
  return `Walk-run: ${w.repeats} × ${formatSec(w.runSec)} run / ${formatSec(w.walkSec)} walk`;
}

/** Duration multipliers for continuous-run weeks; the last run is the longer one. */
const PATTERNS: Record<number, number[]> = {
  1: [1],
  2: [1, 1.2],
  3: [1, 1, 1.3],
  4: [0.85, 1, 0.85, 1.4],
  5: [0.8, 1, 0.8, 0.9, 1.4],
};

export interface BuildRunOptions {
  step: number;
  multiplier: number;
  long: boolean;
  strides: boolean;
  quality?: 'tempo' | 'intervals';
  /** Target pace for the hard reps, sec/km. */
  targetPace?: number;
}

function qualityRun(id: string, date: DateKey, minutes: number, kind: 'tempo' | 'intervals', step: number, targetPace?: number): PlannedSession {
  const workout =
    kind === 'tempo'
      ? { warmupMin: 10, runSec: 480, walkSec: 120, repeats: Math.max(2, Math.min(4, Math.floor((minutes - 15) / 10))), cooldownMin: 5 }
      : { warmupMin: 10, runSec: 180, walkSec: 120, repeats: Math.max(3, Math.min(6, Math.floor((minutes - 15) / 5))), cooldownMin: 5 };
  const total = walkRunMinutes(workout);
  const work = workout.runSec / 60;
  return {
    id,
    date,
    kind: 'run',
    runType: kind,
    step,
    title: kind === 'tempo' ? `Tempo: ${workout.repeats} × ${work} min comfortably hard` : `Intervals: ${workout.repeats} × ${work} min at 5K effort`,
    durationMin: total,
    workout,
    targetPaceSecPerKm: targetPace,
    optional: false,
    status: 'planned',
  };
}

export function buildRun(id: string, date: DateKey, o: BuildRunOptions): PlannedSession {
  const t = LADDER[Math.max(0, Math.min(LADDER.length - 1, o.step))];
  if (t.walkRun) {
    return {
      id,
      date,
      kind: 'run',
      runType: 'walk_run',
      step: o.step,
      title: walkRunTitle(t.walkRun),
      durationMin: t.minutes,
      walkRun: t.walkRun,
      optional: false,
      status: 'planned',
    };
  }
  const minutes = round5(t.minutes * o.multiplier);
  if (o.quality) return qualityRun(id, date, minutes, o.quality, o.step, o.targetPace);
  if (o.strides) {
    return {
      id,
      date,
      kind: 'run',
      runType: 'strides',
      step: o.step,
      title: `Easy run + 6 strides · ${minutes} min`,
      durationMin: minutes,
      strides: 6,
      optional: false,
      status: 'planned',
    };
  }
  return {
    id,
    date,
    kind: 'run',
    runType: o.long ? 'long' : 'easy',
    step: o.step,
    title: o.long ? `Longer easy run · ${minutes} min` : `Easy run · ${minutes} min`,
    durationMin: minutes,
    optional: false,
    status: 'planned',
  };
}

const SUMMARIES: Record<WeekDirective, string> = {
  progress: 'A small step up this week — nothing dramatic.',
  hold: 'Same as last week. Let it settle in.',
  ease: 'A lighter week so your body can catch up.',
  recovery: 'Recovery week: a little less, on purpose. This is how you get stronger.',
};

/** `fiveKSec` is the current fitness estimate; without it, paces come straight from the PBs. */
export function generateWeek(profile: Profile, index: number, start: DateKey, step: number, directive: WeekDirective, fiveKSec?: number | null): PlanWeek {
  const runs = Math.max(1, Math.min(5, profile.runsPerWeek));
  const dates = runDates(start, runs, profile.preferredDays);
  const pattern = PATTERNS[runs];
  const recoveryFactor = directive === 'recovery' ? 0.8 : 1;
  const longGoal = profile.goal === 'half' || profile.goal === 'half_faster' || profile.goal === 'marathon';
  // Week 1 is always easy; quality work starts in week 2.
  const workoutWeek =
    index > 0 &&
    (isFasterGoal(profile.goal) || (longGoal && profile.level === 'experienced')) &&
    (profile.level === 'experienced' || profile.level === 'consistent') &&
    step >= FIRST_CONTINUOUS_STEP &&
    directive !== 'ease' &&
    directive !== 'recovery' &&
    runs >= 3;
  const workoutKind: 'tempo' | 'intervals' = index % 2 === 1 ? 'tempo' : 'intervals';
  const paces = fiveKSec ? trainingPaces(fiveKSec) : pacesFor(profile.pbs ?? [], profile.level);
  const longBoost = longGoal && step >= 14 ? 0.1 : 0;
  const quality =
    !workoutWeek &&
    profile.includeQuality &&
    (profile.level === 'experienced' || profile.level === 'consistent') &&
    step >= FIRST_CONTINUOUS_STEP &&
    directive !== 'ease' &&
    directive !== 'recovery' &&
    runs >= 3;

  const sessions: PlannedSession[] = dates.map((date, i) =>
    buildRun(`w${index}-r${i}`, date, {
      step,
      multiplier: (pattern[i] + (i === runs - 1 && pattern[i] > 1.1 ? longBoost : 0)) * recoveryFactor,
      long: runs >= 2 && i === runs - 1 && pattern[i] > 1.1,
      strides: quality && i === 1,
      quality: workoutWeek && i === 1 ? workoutKind : undefined,
      targetPace: workoutWeek && i === 1 && paces ? (workoutKind === 'tempo' ? paces.tempo : paces.interval) : undefined,
    }),
  );

  const strengthCount = Math.max(0, Math.min(2, profile.strengthPerWeek));
  const routines = pickRoutines(profile.level, profile.issues, strengthCount, index);
  strengthDates(start, dates, routines.length).forEach((date, i) => {
    const r = routines[i];
    sessions.push({
      id: `w${index}-s${i}`,
      date,
      kind: 'strength',
      title: r.title,
      durationMin: r.durationMin,
      routineId: r.id,
      optional: true,
      status: 'planned',
    });
  });

  sessions.sort((a, b) => (a.date === b.date ? a.kind.localeCompare(b.kind) : a.date < b.date ? -1 : 1));

  const runWord = sessions[0]?.walkRun ? 'walk-run sessions' : 'easy runs';
  const summary =
    index === 0
      ? `Week 1 is intentionally easy: ${runs} ${runWord}${strengthCount ? ' and some optional strength' : ''}. Showing up is the whole goal.`
      : SUMMARIES[directive];

  return {
    index,
    start,
    end: addDays(start, 6),
    directive,
    sessions,
    challengeId: pickChallenge(index, profile.strengthPerWeek > 0),
    summary,
  };
}

export function createPlan(profile: Profile, today: DateKey): PlanState {
  const step = Math.min(stepCap(profile.goal, profile.level), startingStep(profile.level, profile.frequency, profile.pbs));
  return {
    startDate: today,
    step,
    weeksSinceProgress: 0,
    weeks: [generateWeek(profile, 0, today, step, 'hold')],
  };
}

/** Apply a directive to the step, respecting the goal cap and issue caution. */
export function nextStep(
  step: number,
  directive: WeekDirective,
  opts: { cap: number; cautious: boolean; weeksSinceProgress: number },
): { step: number; progressed: boolean } {
  switch (directive) {
    case 'progress': {
      if (step >= opts.cap) return { step: opts.cap, progressed: false };
      if (opts.cautious && opts.weeksSinceProgress < 1) return { step, progressed: false };
      return { step: step + 1, progressed: true };
    }
    case 'ease':
      return { step: Math.max(0, step - 1), progressed: false };
    default:
      return { step, progressed: false };
  }
}

/** Every 4th week of continuous running is a planned recovery week. */
export function isRecoveryWeek(index: number, step: number): boolean {
  return step >= FIRST_CONTINUOUS_STEP + 1 && index % 4 === 3;
}

export function currentWeek(plan: PlanState, today: DateKey): PlanWeek | undefined {
  return plan.weeks.find((w) => w.start <= today && today <= w.end);
}

export function allSessions(plan: PlanState | null): PlannedSession[] {
  return plan ? plan.weeks.flatMap((w) => w.sessions) : [];
}
