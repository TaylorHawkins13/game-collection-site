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
import { applyRaceDays, phaseLabel, raceWeekPlan } from './races.ts';
import { pickRoutines, routineById } from './strength.ts';
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
  Race,
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
  quality?: 'tempo' | 'intervals' | 'hills';
  /** Target pace for the hard reps, sec/km. */
  targetPace?: number;
  shortenReps?: boolean;
  qualityLabel?: string;
}

export function qualityRun(
  id: string,
  date: DateKey,
  minutes: number,
  kind: 'tempo' | 'intervals' | 'hills',
  step: number,
  targetPace?: number,
  opts: { shortenReps?: boolean; label?: string } = {},
): PlannedSession {
  const workout =
    kind === 'tempo'
      ? { warmupMin: 10, runSec: 480, walkSec: 120, repeats: Math.max(2, Math.min(4, Math.floor((minutes - 15) / 10))), cooldownMin: 5 }
      : kind === 'hills'
        ? { warmupMin: 10, runSec: 60, walkSec: 90, repeats: Math.max(5, Math.min(8, Math.floor((minutes - 15) / 2.5))), cooldownMin: 5 }
        : { warmupMin: 10, runSec: 180, walkSec: 120, repeats: Math.max(3, Math.min(6, Math.floor((minutes - 15) / 5))), cooldownMin: 5 };
  if (opts.shortenReps) workout.repeats = Math.max(2, workout.repeats - 1);
  const total = walkRunMinutes(workout);
  const work = workout.runSec / 60;
  const label = opts.label ? `${opts.label}: ` : '';
  return {
    id,
    date,
    kind: 'run',
    runType: kind,
    step,
    title:
      kind === 'tempo'
        ? `${label || 'Tempo: '}${workout.repeats} × ${work} min ${opts.label ? 'at race pace' : 'comfortably hard'}`
        : kind === 'hills'
          ? `Hills: ${workout.repeats} × 60 sec uphill, jog down`
          : `${label || 'Intervals: '}${workout.repeats} × ${work} min at ${opts.label ? 'race pace' : '5K effort'}`,
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
  if (o.quality) return qualityRun(id, date, minutes, o.quality, o.step, o.targetPace, { shortenReps: o.shortenReps, label: o.qualityLabel });
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
export function generateWeek(
  profile: Profile,
  index: number,
  start: DateKey,
  step: number,
  directive: WeekDirective,
  fiveKSec?: number | null,
  races?: Race[],
): PlanWeek {
  const end = addDays(start, 6);
  const rw = raceWeekPlan(races, start, profile.level, fiveKSec ?? null);
  const phaseNote = rw.race && rw.phase !== 'base' ? `${phaseLabel(rw.phase)} · ${rw.race.name} in ${Math.max(0, Math.ceil(diffDays(start, rw.race.date) / 7))} week${Math.ceil(diffDays(start, rw.race.date) / 7) === 1 ? '' : 's'}` : undefined;
  if (profile.planMode === 'custom') {
    const custom = customSessions(profile, index, start, fiveKSec ?? null);
    return {
      index,
      start,
      end,
      directive: 'hold',
      sessions: applyRaceDays(custom, races, start, end, fiveKSec ?? null),
      challengeId: pickChallenge(index, custom.some((x) => x.kind === 'strength')),
      summary: 'Your own plan. Steady keeps score and slots your races in.',
      phaseNote,
    };
  }
  const runs = Math.max(1, Math.min(5, profile.runsPerWeek));
  const dates = runDates(start, runs, profile.preferredDays);
  const pattern = PATTERNS[runs];
  const recoveryFactor = (directive === 'recovery' ? 0.8 : 1) * rw.volumeFactor;
  const longGoal = profile.goal === 'half' || profile.goal === 'half_faster' || profile.goal === 'marathon';
  // Week 1 is always easy; quality work starts in week 2.
  const raceWorkout =
    !!rw.workout && index > 0 && step >= FIRST_CONTINUOUS_STEP && directive !== 'ease' && directive !== 'recovery' && runs >= 3;
  const workoutWeek =
    !raceWorkout &&
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
    !raceWorkout &&
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
      quality: i === 1 ? (raceWorkout ? rw.workout!.kind : workoutWeek ? workoutKind : undefined) : undefined,
      targetPace:
        i !== 1 ? undefined : raceWorkout ? rw.workout!.targetPace : workoutWeek && paces ? (workoutKind === 'tempo' ? paces.tempo : paces.interval) : undefined,
      shortenReps: rw.shortenReps,
      qualityLabel: raceWorkout && rw.workout!.kind !== 'hills' ? rw.workout!.label : undefined,
    }),
  );
  // Race build: grow the long run toward what the race needs (never more than +60% over the normal long run).
  const longIdx = sessions.findIndex((x) => x.runType === 'long');
  if (rw.longRunMin && longIdx >= 0) {
    const cur = sessions[longIdx].durationMin;
    const minutes = Math.max(cur, Math.min(rw.longRunMin, Math.round((cur * 1.6) / 5) * 5));
    sessions[longIdx] = { ...sessions[longIdx], durationMin: minutes, title: `Long run · ${minutes} min`, note: rw.race ? `Building endurance for ${rw.race.name}.` : undefined };
  }

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

  const shaped = applyRaceDays(sessions, races, start, end, fiveKSec ?? null);

  const runWord = sessions[0]?.walkRun ? 'walk-run sessions' : 'easy runs';
  const summary =
    index === 0
      ? `Week 1 is intentionally easy: ${runs} ${runWord}${strengthCount ? ' and some optional strength' : ''}. Showing up is the whole goal.`
      : SUMMARIES[directive];

  return {
    index,
    start,
    end,
    directive,
    sessions: shaped,
    challengeId: pickChallenge(index, profile.strengthPerWeek > 0),
    summary,
    phaseNote,
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

/** Build a week from the user's own template. */
export function customSessions(profile: Profile, index: number, start: DateKey, fiveKSec: number | null): PlannedSession[] {
  const paces = fiveKSec ? trainingPaces(fiveKSec) : pacesFor(profile.pbs ?? [], profile.level);
  return (profile.customWeek ?? [])
    .map((slot, i): PlannedSession => {
      const date = addDays(start, (slot.weekday - weekday(start) + 7) % 7);
      const id = `w${index}-c${i}`;
      if (slot.kind === 'strength') {
        const r = routineById(slot.routineId) ?? routineById('str-foundation')!;
        return { id, date, kind: 'strength', title: r.title, durationMin: slot.durationMin || r.durationMin, routineId: r.id, optional: !!slot.optional, status: 'planned' };
      }
      const t = slot.runType ?? 'easy';
      if (t === 'tempo' || t === 'intervals' || t === 'hills') {
        const q = qualityRun(id, date, slot.durationMin, t, FIRST_CONTINUOUS_STEP, paces ? (t === 'tempo' ? paces.tempo : t === 'intervals' ? paces.interval : undefined) : undefined);
        return { ...q, optional: !!slot.optional };
      }
      if (t === 'walk_run') {
        let best = 0;
        LADDER.forEach((s, k) => {
          if (s.walkRun && Math.abs(s.minutes - slot.durationMin) < Math.abs(LADDER[best].minutes - slot.durationMin)) best = k;
        });
        return { ...buildRun(id, date, { step: best, multiplier: 1, long: false, strides: false }), optional: !!slot.optional };
      }
      const minutes = Math.max(10, slot.durationMin);
      return {
        id,
        date,
        kind: 'run',
        runType: t,
        title: t === 'long' ? `Long run · ${minutes} min` : t === 'strides' ? `Easy run + 6 strides · ${minutes} min` : `Easy run · ${minutes} min`,
        durationMin: minutes,
        strides: t === 'strides' ? 6 : undefined,
        optional: !!slot.optional,
        status: 'planned',
      };
    })
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** Turn a generated week into a starting template for "my own plan". */
export function templateFromWeek(week: PlanWeek): import('./types.ts').CustomSlot[] {
  return week.sessions
    .filter((s) => s.runType !== 'race')
    .map((s) => ({
      weekday: weekday(s.date),
      kind: s.kind,
      runType: s.kind === 'run' ? (s.runType === 'walk' ? 'easy' : (s.runType as 'easy')) : undefined,
      routineId: s.routineId,
      durationMin: s.durationMin,
      optional: s.optional,
    }));
}
