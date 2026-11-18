/**
 * The app's state machine. Every user action and the daily tick go through a
 * pure function here: (state, input, today) → { state, events }. The store
 * persists the state; the UI renders the events (XP toasts, badges, notes).
 */
import { adaptAfterFeedback, directiveFor } from './adaptation.ts';
import { BADGES, newlyEarned } from './badges.ts';
import { currentFiveK, describeMove, direction, evaluateAfterRun, evaluateBreak, fitnessFromPbs, hadSlipSince, possiblePb, type FitnessMove } from './fitness.ts';
import { fiveKEquivalent, trainingPaces } from './pace.ts';
import { fitnessFromHistory, historySummary, levelHint, mergeImports } from './history.ts';
import { matchImportedRun } from './matching.ts';
import { challengeProgress } from './challenges.ts';
import { addDays, diffDays, maxKey, minKey, rangeKeys } from './dates.ts';
import { completionRate, consistency, countsTowardCompletion, daysSinceLastActivity, isPaused, runBaseline } from './metrics.ts';
import { allSessions, createPlan, currentWeek, defaultRunsPerWeek, defaultStrengthPerWeek, generateWeek, nextStep, startingStep, stepCap } from './plan.ts';
import { addXp, applyDecay, newRankState, rankOf, reevaluate, softResetDivision } from './ranks.ts';
import { inFinalTwoWeeks, nextSeason, seasonById, seasonFor } from './season.ts';
import { mobilityFallback } from './strength.ts';
import { runXp, sessionXp, XP, type XpPart } from './xp.ts';
import { averageRepPace } from './reps.ts';
import type {
  Activity,
  AppState,
  DateKey,
  EngineEvent,
  ExperienceLevel,
  Feel,
  GoalId,
  IssueId,
  Notice,
  Pause,
  ImportedRun,
  PersonalBest,
  Race,
  RaceDistance,
  PlanWeek,
  PlannedSession,
  Profile,
  RecoverySnapshot,
  Soreness,
  WeeklyFrequency,
  XpReason,
} from './types.ts';

export interface Result {
  state: AppState;
  events: EngineEvent[];
}

let counter = 0;
export function uid(prefix = 'id'): string {
  counter = (counter + 1) % 1_000_000;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function createInitialState(today: DateKey): AppState {
  return {
    version: 1,
    profile: null,
    plan: null,
    activities: [],
    rank: newRankState(seasonFor(today).id, 0),
    peakDivisionEver: 0,
    seasonFinishes: [],
    badges: {},
    xpLog: [],
    restClaims: [],
    pauses: [],
    health: { connected: false },
    notices: [],
    weeklyTargetPaid: [],
    challengePaid: [],
    lastTick: today,
  };
}

export interface OnboardingAnswers {
  level: ExperienceLevel;
  frequency: WeeklyFrequency | null;
  goal: GoalId;
  issues: IssueId[];
  includeQuality: boolean;
  pbs?: PersonalBest[];
  goalTimeSec?: number;
  /** When week 1 begins (today if omitted). */
  startDate?: DateKey;
}

export function defaultProfile(a: OnboardingAnswers, today: DateKey): Profile {
  return {
    level: a.level,
    frequency: a.level === 'new' || a.level === 'returning' ? a.frequency ?? 0 : null,
    goal: a.goal,
    issues: a.issues,
    pbs: a.pbs ?? [],
    goalTimeSec: a.goalTimeSec,
    includeQuality: a.includeQuality,
    runsPerWeek: defaultRunsPerWeek(a.level),
    strengthPerWeek: defaultStrengthPerWeek(a.level),
    preferredDays: [],
    units: 'km',
    hideRouteEnds: true,
    audioCues: true,
    splitAnnouncements: a.level === 'consistent' || a.level === 'experienced',
    morningReminder: { enabled: true, hour: 8, minute: 0 },
    afternoonNudge: { enabled: false, hour: 16, minute: 30 },
    createdAt: today,
  };
}

export function onboard(state: AppState, answers: OnboardingAnswers, today: DateKey, profileOverrides: Partial<Profile> = {}): AppState {
  const profile = { ...defaultProfile(answers, today), ...profileOverrides };
  const start = answers.startDate && answers.startDate > today ? answers.startDate : today;
  const s: AppState = { ...state, profile, plan: createPlan(profile, start), lastTick: today };
  return { ...s, fitness: fitnessFromPbs(s, today) };
}

// ───────────────────────────── helpers ─────────────────────────────

function mapSessions(state: AppState, fn: (s: PlannedSession, w: PlanWeek) => PlannedSession): AppState {
  if (!state.plan) return state;
  return {
    ...state,
    plan: { ...state.plan, weeks: state.plan.weeks.map((w) => ({ ...w, sessions: w.sessions.map((s) => fn(s, w)) })) },
  };
}

function replaceWeek(state: AppState, week: PlanWeek): AppState {
  if (!state.plan) return state;
  return { ...state, plan: { ...state.plan, weeks: state.plan.weeks.map((w) => (w.index === week.index ? week : w)) } };
}

export function findSession(state: AppState, id: string): { session: PlannedSession; week: PlanWeek } | null {
  for (const week of state.plan?.weeks ?? []) {
    const session = week.sessions.find((s) => s.id === id);
    if (session) return { session, week };
  }
  return null;
}

function weekContaining(state: AppState, date: DateKey): PlanWeek | undefined {
  return state.plan?.weeks.find((w) => w.start <= date && date <= w.end);
}

function addNotice(state: AppState, kind: Notice['kind'], text: string, date: DateKey): AppState {
  const notice: Notice = { id: uid('n'), date, kind, text };
  return { ...state, notices: [notice, ...state.notices].slice(0, 30) };
}

/** Apply a fitness change: update the estimate, retarget upcoming workouts, explain it. */
function applyFitnessMove(state: AppState, move: FitnessMove, today: DateKey, events: EngineEvent[]): AppState {
  const prev = state.fitness;
  const fitness = { fiveKSec: move.fiveKSec, updatedAt: today, log: [...(prev?.log ?? []), { date: today, fiveKSec: move.fiveKSec, reason: move.reason }].slice(-50) };
  const paces = trainingPaces(move.fiveKSec);
  let s: AppState = { ...state, fitness };
  s = mapSessions(s, (x) =>
    x.workout && x.status === 'planned' && x.date >= today
      ? { ...x, targetPaceSecPerKm: x.runType === 'tempo' ? paces.tempo : paces.interval }
      : x,
  );
  const text = describeMove(move, state.profile?.units ?? 'km');
  const dir = direction(move.reason);
  events.push({ type: 'fitness', direction: dir === 'down' ? 'down' : 'up', reason: move.reason, text });
  return addNotice(s, 'plan', text, today);
}

function grantXp(state: AppState, amount: number, reason: XpReason, today: DateKey, events: EngineEvent[], refId?: string): AppState {
  if (amount <= 0) return state;
  events.push({ type: 'xp', amount, reason });
  const r = addXp(state.rank, amount, consistency(state, today));
  events.push(...r.events);
  return {
    ...state,
    rank: r.state,
    peakDivisionEver: Math.max(state.peakDivisionEver, r.state.division),
    xpLog: [{ date: today, amount, reason, refId }, ...state.xpLog].slice(0, 2000),
  };
}

function awardBadges(state: AppState, today: DateKey, events: EngineEvent[]): AppState {
  const ids = newlyEarned(state, today);
  if (!ids.length) return state;
  const badges = { ...state.badges };
  for (const id of ids) {
    badges[id] = today;
    events.push({ type: 'badge', id });
  }
  return { ...state, badges };
}

/** Weekly target + challenge bonuses for the week containing `date`. */
function weeklyBonuses(state: AppState, date: DateKey, today: DateKey, events: EngineEvent[]): AppState {
  const week = weekContaining(state, date);
  if (!week) return state;
  let s = state;
  const core = week.sessions.filter(countsTowardCompletion);
  if (core.length > 0 && core.every((x) => x.status === 'completed') && !s.weeklyTargetPaid.includes(week.start)) {
    s = { ...s, weeklyTargetPaid: [...s.weeklyTargetPaid, week.start] };
    events.push({ type: 'weekly_target' });
    s = grantXp(s, XP.weeklyTarget, 'weekly_target', today, events, week.start);
  }
  if (!s.challengePaid.includes(week.start) && challengeProgress(week, s.activities, s.restClaims).done) {
    s = { ...s, challengePaid: [...s.challengePaid, week.start] };
    events.push({ type: 'challenge', id: week.challengeId });
    s = grantXp(s, XP.weeklyChallenge, 'weekly_challenge', today, events, week.start);
  }
  return s;
}

function finish(state: AppState, today: DateKey, events: EngineEvent[]): Result {
  // Completion may have improved enough to open a promotion gate.
  const r = reevaluate(state.rank, consistency(state, today));
  events.push(...r.events);
  let s: AppState = { ...state, rank: r.state, peakDivisionEver: Math.max(state.peakDivisionEver, r.state.division) };
  s = awardBadges(s, today, events);
  return { state: s, events };
}

// ───────────────────────────── daily tick ─────────────────────────────

function markPast(state: AppState, today: DateKey): AppState {
  return mapSessions(state, (s) => {
    if (s.status !== 'planned') return s;
    if (isPaused(state, s.date)) return { ...s, status: 'paused' };
    if (s.date < today) return { ...s, status: 'missed' };
    return s;
  });
}

function seasonRollover(state: AppState, today: DateKey, events: EngineEvent[]): AppState {
  const season = seasonFor(today);
  if (state.rank.seasonId === season.id) return state;
  const old = seasonById(state.rank.seasonId);
  const sessions = state.activities.filter((a) => a.date >= old.start && a.date <= old.end).length;
  const completion = completionRate(state, old.start, old.end, addDays(old.end, 1)).rate;
  const last28 = addDays(old.end, -27);
  const activeWeeksLast4 = (state.plan?.weeks ?? []).filter(
    (w) => w.end >= last28 && w.start <= old.end && w.sessions.some((x) => x.status === 'completed'),
  ).length;
  const hadPlan = !!state.plan && state.plan.startDate <= old.end;
  const finishRec = hadPlan
    ? {
        seasonId: old.id,
        label: `${rankOf(state.rank.division)} – ${old.label}`,
        division: state.rank.division,
        sessions,
        completion,
      }
    : null;
  const consecutive = nextSeason(old).id === season.id;
  const newDivision = consecutive ? softResetDivision(state.rank.division, { completion, sessions, activeWeeksLast4 }) : 0;
  events.push({ type: 'season_reset', finish: finishRec, newDivision });
  let s: AppState = {
    ...state,
    rank: newRankState(season.id, newDivision),
    seasonFinishes: finishRec ? [...state.seasonFinishes, finishRec] : state.seasonFinishes,
  };
  s = addNotice(s, 'rank', `A new season has started: ${season.name}. Every season is a fresh climb.`, today);
  return s;
}

function rollWeeks(state: AppState, today: DateKey, events: EngineEvent[]): AppState {
  let s = state;
  let guard = 0;
  while (s.plan && s.profile && guard++ < 200) {
    const plan = s.plan;
    const last = plan.weeks[plan.weeks.length - 1];
    if (today <= last.end) break;
    const profile = s.profile;
    const nextStart = addDays(last.end, 1);

    // Outcome of the finished week.
    const core = last.sessions.filter(countsTowardCompletion);
    const done = core.filter((x) => x.status === 'completed').length;
    const pausedDays = rangeKeys(last.start, last.end).filter((d) => isPaused(s, d)).length;
    const feelings = s.activities.filter((a) => a.date >= last.start && a.date <= last.end && a.feel);
    const gap = daysSinceLastActivity(s, nextStart);
    const brk = evaluateBreak(s, nextStart);
    if (brk) s = applyFitnessMove(s, brk, nextStart <= today ? nextStart : today, events);
    let { directive, reason } = directiveFor(
      { completion: core.length ? done / core.length : 1, completedCount: done, pausedDays, feelings, daysSinceLastActivity: gap },
      last.index + 1,
      plan.step,
    );
    // Fitness slipped this week (workouts or easy runs felt hard): don't step up.
    if (directive === 'progress' && hadSlipSince(s, last.start)) {
      directive = 'hold';
      reason = 'Holding steady this week while your body catches up. You’ll step up again soon.';
    }
    const { step, progressed } = nextStep(plan.step, directive, {
      cap: stepCap(profile.goal, profile.level),
      cautious: profile.issues.length > 0,
      weeksSinceProgress: plan.weeksSinceProgress,
    });
    const custom = profile.planMode === 'custom';
    const week = generateWeek(profile, last.index + 1, nextStart, custom ? plan.step : step, directive, currentFiveK(s), s.races);
    if (custom) week.summary = 'Your own plan this week.';
    else week.summary = reason;
    s = {
      ...s,
      plan: { ...plan, step: custom ? plan.step : step, weeksSinceProgress: progressed && !custom ? 0 : plan.weeksSinceProgress + 1, weeks: [...plan.weeks, week] },
    };

    // Gentle rank decay, evaluated once per finished week (Gold+ only).
    if (seasonFor(last.end).id === s.rank.seasonId) {
      const windowStart = addDays(last.end, -13);
      const c14 = completionRate(s, windowStart, last.end, nextStart);
      const pausedInWindow = rangeKeys(windowStart, last.end).some((d) => isPaused(s, d));
      const d = applyDecay(s.rank, c14.due ? c14.rate : 1, { finalTwoWeeks: inFinalTwoWeeks(last.end), paused: pausedInWindow });
      if (d.xpLost > 0) {
        s = { ...s, rank: d.state };
        events.push({ type: 'decay', xpLost: d.xpLost, division: d.state.division, demoted: d.demoted });
        s = addNotice(
          s,
          'rank',
          d.demoted
            ? 'Your rank slipped one division after a quiet couple of weeks. A few planned sessions will win it back.'
            : `Quiet couple of weeks, so your rank bar dipped slightly (−${d.xpLost} XP). Completing planned sessions stops this.`,
          today,
        );
      }
    }
    if (nextStart <= today && addDays(nextStart, 6) >= today) {
      events.push({ type: 'plan_note', text: reason });
      s = addNotice(s, 'plan', reason, today);
    }
    s = markPast(s, today);
  }
  return s;
}

export function tick(state: AppState, today: DateKey): Result {
  const events: EngineEvent[] = [];
  let s = markPast(state, today);
  s = seasonRollover(s, today, events);
  s = rollWeeks(s, today, events);
  s = { ...s, lastTick: today };
  return finish(s, today, events);
}

// ───────────────────────────── sessions ─────────────────────────────

export interface SessionInput {
  id?: string;
  plannedSessionId?: string;
  kind: 'run' | 'strength';
  title: string;
  startedAt: number;
  endedAt: number;
  durationSec: number;
  distanceM?: number;
  treadmill?: boolean;
  splits?: Activity['splits'];
  reps?: Activity['reps'];
  route?: Activity['route'];
  avgHr?: number;
  maxHr?: number;
  hrSource?: 'strap' | 'health';
  routineId?: string;
}

export function completeSession(state: AppState, input: SessionInput, today: DateKey): Result & { activity: Activity } {
  const events: EngineEvent[] = [];
  const found = input.plannedSessionId ? findSession(state, input.plannedSessionId) : null;
  const planned = found && found.session.status !== 'completed' ? found.session : null;
  const activityId = input.id ?? uid('act');

  let completion = 1;
  if (planned && planned.kind === 'run' && planned.durationMin > 0) {
    completion = Math.min(1, input.durationSec / (planned.durationMin * 60));
  }
  const extrasToday = state.activities.filter((a) => a.date === today && !a.plannedSessionId).length;
  const kind = planned?.kind ?? input.kind;
  let xp: number;
  let xpParts: XpPart[] | undefined;
  if (!planned && extrasToday >= XP.extraPerDay) {
    xp = 0;
    xpParts = [{ label: `Daily limit of ${XP.extraPerDay} extra sessions reached`, amount: 0 }];
  } else if (kind === 'run') {
    const paces = currentFiveK(state) ? trainingPaces(currentFiveK(state)!) : null;
    const r = runXp({
      durationSec: input.durationSec,
      distanceM: input.distanceM,
      planned: !!planned,
      runType: planned?.runType,
      level: state.profile?.level ?? 'new',
      baseline: runBaseline(state, today),
      easyFastPace: paces?.easy[0] ?? null,
      target: planned
        ? {
            durationSec: planned.durationMin * 60,
            paceRange: (planned.runType === 'easy' || planned.runType === 'long') && paces ? [paces.easy[0], paces.easy[1]] : undefined,
            paceTarget: planned.runType === 'race' ? planned.targetPaceSecPerKm : undefined,
            repPaceTarget: planned.workout ? planned.targetPaceSecPerKm : undefined,
            repPace: planned.workout && input.reps ? averageRepPace(input.reps) : undefined,
          }
        : undefined,
      treadmill: input.treadmill,
    });
    xp = r.total;
    xpParts = r.parts;
  } else {
    xp = sessionXp('strength', !!planned, completion);
  }

  const activity: Activity = {
    id: activityId,
    date: today,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    kind: planned?.kind ?? input.kind,
    plannedSessionId: planned?.id,
    title: input.title,
    durationSec: Math.round(input.durationSec),
    distanceM: input.distanceM,
    treadmill: input.treadmill,
    splits: input.splits,
    reps: input.reps,
    route: input.route,
    avgHr: input.avgHr,
    maxHr: input.maxHr,
    hrSource: input.hrSource,
    xpEarned: xp,
    xpParts,
    completion,
    routineId: input.routineId ?? planned?.routineId,
  };

  let s: AppState = { ...state, activities: [activity, ...state.activities] };
  if (planned) {
    s = mapSessions(s, (x) =>
      x.id === planned.id
        ? { ...x, status: 'completed', activityId, date: today, movedFrom: x.date !== today ? x.movedFrom ?? x.date : x.movedFrom }
        : x,
    );
  }
  const reason: XpReason = !planned ? 'extra_session' : planned.kind === 'run' ? 'run' : 'strength';
  s = grantXp(s, xp, reason, today, events, activityId);
  s = weeklyBonuses(s, today, today, events);
  if (planned?.raceId) {
    s = { ...s, races: (s.races ?? []).map((r) => (r.id === planned.raceId ? { ...r, result: { activityId, timeSec: Math.round(input.durationSec) } } : r)) };
  }
  const pb = possiblePb(s, activity);
  if (pb) events.push({ type: 'possible_pb', ...pb });
  const r = finish(s, today, events);
  return { ...r, activity: r.state.activities.find((a) => a.id === activityId)! };
}

export function submitFeedback(state: AppState, activityId: string, feel: Feel, soreness: Soreness, today: DateKey): Result & { note: string | null } {
  const events: EngineEvent[] = [];
  const activity = state.activities.find((a) => a.id === activityId);
  if (!activity) return { state, events, note: null };
  const firstTime = !activity.feel;
  const updated: Activity = {
    ...activity,
    feel,
    soreness,
    xpEarned: activity.xpEarned + (firstTime ? XP.feedback : 0),
    xpParts: firstTime && activity.xpParts ? [...activity.xpParts, { label: 'Check-in', amount: XP.feedback }] : activity.xpParts,
  };
  let s: AppState = { ...state, activities: state.activities.map((a) => (a.id === activityId ? updated : a)) };
  if (firstTime) s = grantXp(s, XP.feedback, 'feedback', today, events, activityId);

  let note: string | null = null;
  const week = weekContaining(s, activity.date);
  if (week && s.profile) {
    const recent = s.activities.filter((a) => a.feel).sort((a, b) => b.startedAt - a.startedAt);
    const adapted = adaptAfterFeedback(week, updated, recent, s.profile);
    s = replaceWeek(s, adapted.week);
    note = adapted.note;
    if (note) {
      events.push({ type: 'plan_note', text: note });
      s = addNotice(s, 'plan', note, today);
    }
  }
  if (firstTime) {
    const move = evaluateAfterRun(s, activityId, today);
    if (move) s = applyFitnessMove(s, move, today, events);
  }
  s = weeklyBonuses(s, activity.date, today, events);
  return { ...finish(s, today, events), note };
}

// ───────────────────────────── rest & plan edits ─────────────────────────────

export function todaySessions(state: AppState, today: DateKey): PlannedSession[] {
  return (weekContaining(state, today)?.sessions ?? []).filter((s) => s.date === today && s.status !== 'dropped');
}

export function isRestDay(state: AppState, today: DateKey): boolean {
  return !todaySessions(state, today).some((s) => !s.optional && s.status !== 'paused');
}

export function claimRestDay(state: AppState, today: DateKey): Result {
  const events: EngineEvent[] = [];
  if (!state.plan || !isRestDay(state, today) || state.restClaims.includes(today) || isPaused(state, today)) {
    return { state, events };
  }
  let s: AppState = { ...state, restClaims: [...state.restClaims, today] };
  s = grantXp(s, XP.restDay, 'rest_day', today, events, today);
  s = weeklyBonuses(s, today, today, events);
  return finish(s, today, events);
}

/** Missed core sessions in the current week that the user hasn't dealt with yet. */
export function missedThisWeek(state: AppState, today: DateKey): PlannedSession[] {
  const week = state.plan ? currentWeek(state.plan, today) : undefined;
  return (week?.sessions ?? []).filter((s) => s.status === 'missed' && !s.optional);
}

/** Days from today to the end of this week with no core session on them. */
export function freeDaysThisWeek(state: AppState, today: DateKey): DateKey[] {
  const week = state.plan ? currentWeek(state.plan, today) : undefined;
  if (!week) return [];
  return rangeKeys(today, week.end).filter(
    (d) => !week.sessions.some((s) => s.date === d && !s.optional && s.status !== 'dropped' && s.status !== 'skipped'),
  );
}

export function moveSession(state: AppState, sessionId: string, to: DateKey, today: DateKey): AppState {
  if (to < today) return state;
  return mapSessions(state, (s, w) =>
    s.id === sessionId && s.status !== 'completed' && to <= w.end
      ? { ...s, date: to, status: 'planned', movedFrom: s.movedFrom ?? s.date, note: 'Rescheduled. Flexible is good.' }
      : s,
  );
}

/** "Shorten my week": the session no longer counts toward this week's target. */
export function dropSession(state: AppState, sessionId: string): AppState {
  return mapSessions(state, (s) =>
    s.id === sessionId && s.status !== 'completed' ? { ...s, status: 'dropped', note: 'Removed to shorten the week. No problem.' } : s,
  );
}

export function skipSession(state: AppState, sessionId: string): AppState {
  return mapSessions(state, (s) => (s.id === sessionId && s.status !== 'completed' ? { ...s, status: 'skipped' } : s));
}

/** Not feeling it? Swap a run for a short mobility session that still counts. */
export function swapForMobility(state: AppState, sessionId: string): AppState {
  const routine = mobilityFallback(state.profile?.issues ?? []);
  return mapSessions(state, (s) =>
    s.id === sessionId && s.kind === 'run' && s.status !== 'completed'
      ? {
          ...s,
          kind: 'strength',
          runType: undefined,
          walkRun: undefined,
          workout: undefined,
          targetPaceSecPerKm: undefined,
          strides: undefined,
          step: undefined,
          title: routine.title,
          durationMin: routine.durationMin,
          routineId: routine.id,
          replacedFrom: 'run',
          status: 'planned',
          note: 'Swapped for mobility. It still counts toward your week.',
        }
      : s,
  );
}

export function pausePlan(state: AppState, from: DateKey, days: number, reason: Pause['reason']): AppState {
  const pause: Pause = { start: from, end: addDays(from, Math.max(1, days) - 1), reason };
  let s: AppState = { ...state, pauses: [...state.pauses, pause] };
  s = mapSessions(s, (x) => (x.status === 'planned' && x.date >= pause.start && x.date <= pause.end ? { ...x, status: 'paused' } : x));
  return addNotice(s, 'plan', 'Plan paused. Rank decay and missed sessions are on hold. Look after yourself.', from);
}

export function activePause(state: AppState, today: DateKey): Pause | undefined {
  return state.pauses.find((p) => p.start <= today && today <= p.end);
}

export function endPause(state: AppState, today: DateKey): AppState {
  const p = activePause(state, today);
  if (!p) return state;
  const yesterday = addDays(today, -1);
  const pauses = state.pauses
    .map((x) => (x === p ? { ...x, end: yesterday } : x))
    .filter((x) => x.end >= x.start);
  let s: AppState = { ...state, pauses };
  s = mapSessions(s, (x) => (x.status === 'paused' && x.date >= today ? { ...x, status: 'planned' } : x));
  return addNotice(s, 'welcome', 'Welcome back. Start with whatever feels comfortable — the plan will follow your lead.', today);
}

export function setHealthConnected(state: AppState, connected: boolean, today: DateKey): Result {
  const events: EngineEvent[] = [];
  const s: AppState = { ...state, health: { ...state.health, connected, lastSync: Date.now() } };
  return finish(s, today, events);
}

export function setRecovery(state: AppState, recovery: RecoverySnapshot): AppState {
  return { ...state, health: { ...state.health, recovery, lastSync: Date.now() } };
}

export function markHealthSynced(state: AppState, activityId: string): AppState {
  return { ...state, activities: state.activities.map((a) => (a.id === activityId ? { ...a, healthSynced: true } : a)) };
}

const STRUCTURAL: (keyof Profile)[] = ['level', 'frequency', 'goal', 'runsPerWeek', 'strengthPerWeek', 'preferredDays', 'includeQuality', 'issues', 'pbs', 'planMode', 'customWeek'];

/** Update settings; structural changes rebuild the rest of the current week. */
export function updateProfile(state: AppState, patch: Partial<Profile>, today: DateKey): AppState {
  if (!state.profile || !state.plan) return state;
  const profile = { ...state.profile, ...patch };
  let s: AppState = { ...state, profile };
  if (patch.pbs && JSON.stringify(patch.pbs) !== JSON.stringify(state.profile.pbs ?? [])) {
    // Explicit PBs are the user's word: restart the estimate from them (keep run-based history if none left).
    s = { ...s, fitness: fitnessFromPbs(s, today) ?? state.fitness };
  }
  const structural = STRUCTURAL.some((k) => JSON.stringify(patch[k] ?? state.profile![k]) !== JSON.stringify(state.profile![k]));
  if (!structural) return s;

  let plan = s.plan!;
  if (patch.level && patch.level !== state.profile.level) {
    plan = { ...plan, step: Math.min(stepCap(profile.goal, profile.level), startingStep(profile.level, profile.frequency, profile.pbs)) };
  } else if (plan.step > stepCap(profile.goal, profile.level)) {
    plan = { ...plan, step: stepCap(profile.goal, profile.level) };
  }
  const week = currentWeek(plan, today);
  if (!week) return { ...s, plan };
  const fresh = generateWeek(profile, week.index, week.start, plan.step, week.directive, currentFiveK(s), s.races);
  const kept = week.sessions.filter((x) => x.date < today || x.status !== 'planned');
  const version = uid('v').slice(-5);
  const added = fresh.sessions
    .filter((x) => x.date >= today && !kept.some((k) => k.date === x.date && k.kind === x.kind))
    .map((x) => ({ ...x, id: `${x.id}-${version}` }));
  const sessions = [...kept, ...added].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  plan = {
    ...plan,
    weeks: plan.weeks.map((w) => (w.index === week.index ? { ...w, sessions, phaseNote: fresh.phaseNote, summary: profile.planMode === 'custom' ? fresh.summary : w.summary } : w)),
  };
  return { ...s, plan };
}

/** A preview of next week at the current step; the real one adapts to how this week goes. */
export function previewNextWeek(state: AppState, today: DateKey): PlanWeek | null {
  if (!state.plan || !state.profile) return null;
  const week = currentWeek(state.plan, today);
  if (!week) return null;
  return generateWeek(state.profile, week.index + 1, addDays(week.end, 1), state.plan.step, 'hold', currentFiveK(state), state.races);
}

/** Rebuild the rest of the current week (after races or settings change). */
function rebuildCurrentWeek(state: AppState, today: DateKey): AppState {
  if (!state.plan || !state.profile) return state;
  const week = currentWeek(state.plan, today);
  if (!week) return state;
  const fresh = generateWeek(state.profile, week.index, week.start, state.plan.step, week.directive, currentFiveK(state), state.races);
  const kept = week.sessions.filter((x) => x.date < today || x.status !== 'planned');
  const version = uid('v').slice(-5);
  const added = fresh.sessions
    .filter((x) => x.date >= today && !kept.some((k) => k.date === x.date && k.kind === x.kind))
    .map((x) => (x.raceId ? x : { ...x, id: `${x.id}-${version}` }));
  const sessions = [...kept, ...added].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return {
    ...state,
    plan: {
      ...state.plan,
      weeks: state.plan.weeks.map((w) =>
        w.index === week.index ? { ...w, sessions, phaseNote: fresh.phaseNote, summary: state.profile!.planMode === 'custom' ? fresh.summary : w.summary } : w,
      ),
    },
  };
}

export function saveRace(state: AppState, race: Race, today: DateKey): AppState {
  const races = [...(state.races ?? []).filter((r) => r.id !== race.id), race].sort((a, b) => (a.date < b.date ? -1 : 1));
  return rebuildCurrentWeek({ ...state, races }, today);
}

export function removeRace(state: AppState, raceId: string, today: DateKey): AppState {
  return rebuildCurrentWeek({ ...state, races: (state.races ?? []).filter((r) => r.id !== raceId) }, today);
}

/** Import past runs. Sets fitness from them when there's no PB-based estimate yet, or when they show you're clearly fitter. */
export function importHistory(state: AppState, incoming: ImportedRun[], today: DateKey): Result & { added: number } {
  const events: EngineEvent[] = [];
  const { runs, added } = mergeImports(state, incoming);
  let s: AppState = { ...state, importedRuns: runs };
  const fromHistory = state.profile?.level !== 'new' ? fitnessFromHistory(runs, today) : null;
  const cur = currentFiveK(s);
  if (fromHistory && (!cur || fromHistory < cur * 0.98)) {
    s = applyFitnessMove(s, { fiveKSec: fromHistory, reason: 'history' }, today, events);
  }
  // Every activity since the plan started counts, whatever recorded it (oldest first, so weekly bonuses land right).
  for (const r of [...runs].filter((x) => !x.countedActivityId).sort((x, y) => x.startedAt - y.startedAt)) {
    const m = matchImportedRun(s, r, today);
    if (!m) continue;
    const c = countImportedRun(s, r.id, m.session?.id ?? null, today);
    s = c.state;
    events.push(...c.events);
  }
  s = { ...s, pendingMatches: [] };
  const sum = historySummary(runs, today);
  const hint = state.profile ? levelHint(sum, state.profile.level) : null;
  const text =
    added === 0
      ? 'No new runs to import — you’re up to date.'
      : `Imported ${added} activit${added === 1 ? 'y' : 'ies'}. Lately: about ${sum.perWeek} runs a week, longest ${sum.longestMin} min. Everything since you started your Steady plan counts with XP.${hint ? ` ${hint}` : ''}`;
  events.push({ type: 'history_imported', count: added, text });
  return { state: s, events, added };
}

const SOURCE_NAME = { apple_health: 'Apple Health', health_connect: 'Health Connect', strava: 'Strava' } as const;

/** Count an imported (watch) run as a planned session — or as an extra run when sessionId is null. */
export function countImportedRun(state: AppState, importedRunId: string, sessionId: string | null, today: DateKey): Result & { activityId?: string } {
  const run = (state.importedRuns ?? []).find((r) => r.id === importedRunId);
  if (!run || run.countedActivityId) return { state, events: [] };
  const r = completeSession(
    state,
    {
      plannedSessionId: sessionId ?? undefined,
      kind: run.kind ?? 'run',
      title: sessionId ? findSession(state, sessionId)?.session.title ?? run.title : run.title,
      startedAt: run.startedAt,
      endedAt: run.startedAt + run.durationSec * 1000,
      durationSec: run.durationSec,
      distanceM: run.distanceM,
      treadmill: run.treadmill,
      avgHr: run.avgHr,
      hrSource: run.avgHr ? 'health' : undefined,
    },
    run.date,
  );
  const activityId = r.activity.id;
  let s: AppState = {
    ...r.state,
    activities: r.state.activities.map((a) => (a.id === activityId ? { ...a, importedFrom: run.source, healthSynced: true, stravaId: run.source === 'strava' ? run.externalId : a.stravaId ?? 'external' } : a)),
    importedRuns: (r.state.importedRuns ?? []).map((x) => (x.id === run.id ? { ...x, countedActivityId: activityId } : x)),
    pendingMatches: (r.state.pendingMatches ?? []).filter((p) => p.importedRunId !== run.id),
  };
  const what = (run.kind ?? 'run') === 'run' ? 'run' : 'workout';
  const text = `Your ${what} from ${SOURCE_NAME[run.source]} counted${sessionId ? ` for ${s.activities.find((a) => a.id === activityId)?.title}` : ` as an extra ${what === 'run' ? 'run' : 'session'}`} (+${r.activity.xpEarned} XP).${what === 'run' ? ' How did it feel?' : ''}`;
  const events: EngineEvent[] = [...r.events, { type: 'watch_run_counted', activityId, text }];
  s = addNotice(s, 'plan', text, today);
  return { state: s, events, activityId };
}

export function dismissMatch(state: AppState, importedRunId: string): AppState {
  return { ...state, pendingMatches: (state.pendingMatches ?? []).filter((p) => p.importedRunId !== importedRunId) };
}

/** Recent runs (last 2 days) still waiting for a check-in. */
export function pendingCheckIns(state: AppState, today: DateKey) {
  return state.activities.filter((a) => !a.feel && a.kind === 'run' && diffDays(a.date, today) <= 2);
}

/**
 * Change when the plan starts. If it hasn't really begun (nothing completed), it's
 * rebuilt from the new date. If it has, past weeks and all history stay; remaining
 * planned sessions are cleared and a fresh week 1 of the new block starts on the date.
 */
export function setPlanStart(state: AppState, start: DateKey, today: DateKey): AppState {
  if (!state.plan || !state.profile || start < today) return state;
  const plan = state.plan;
  const begun = plan.startDate <= today && allSessions(plan).some((s) => s.status === 'completed');
  if (!begun) {
    return { ...state, plan: { ...createPlan(state.profile, start, currentFiveK(state), state.races), step: plan.step } };
  }
  const kept = plan.weeks
    .filter((w) => w.start < start)
    .map((w) => ({ ...w, sessions: w.sessions.filter((x) => !(x.status === 'planned' && x.date >= today)), end: w.end >= start ? addDays(start, -1) : w.end }));
  const index = (kept[kept.length - 1]?.index ?? -1) + 1;
  const week = generateWeek(state.profile, index, start, plan.step, 'hold', currentFiveK(state), state.races);
  week.summary = 'A fresh start. Same you, same rank — new block.';
  const s: AppState = { ...state, plan: { ...plan, weeks: [...kept, week] } };
  return addNotice(s, 'plan', start === today ? 'Your plan restarted today.' : `Your plan restarts on ${start}. Runs before then still count as extras.`, today);
}

/** Save a PB detected from a run (or entered by hand) and update fitness from it. */
export function savePersonalBest(state: AppState, pb: { distance: RaceDistance; timeSec: number }, today: DateKey): Result {
  const events: EngineEvent[] = [];
  if (!state.profile) return { state, events };
  const pbs = [...(state.profile.pbs ?? []).filter((p) => p.distance !== pb.distance), { ...pb, recency: 'recent' as const }];
  let s: AppState = { ...state, profile: { ...state.profile, pbs } };
  const equiv = fiveKEquivalent([{ ...pb, recency: 'recent' }], s.profile!.level);
  const cur = currentFiveK(state);
  if (equiv && (!cur || equiv < cur)) s = applyFitnessMove(s, { fiveKSec: Math.round(equiv), reason: 'faster_run' }, today, events);
  return finish(s, today, events);
}

export function dismissNotice(state: AppState, id: string): AppState {
  return { ...state, notices: state.notices.map((n) => (n.id === id ? { ...n, dismissed: true } : n)) };
}

// ───────────────────────────── stats ─────────────────────────────

export function seasonStats(state: AppState, today: DateKey) {
  const season = seasonFor(today);
  const acts = state.activities.filter((a) => a.date >= season.start && a.date <= season.end);
  const from = state.plan ? maxKey(season.start, state.plan.startDate) : season.start;
  const c = completionRate(state, from, minKey(season.end, today), today);
  return {
    season,
    sessions: acts.length,
    runs: acts.filter((a) => a.kind === 'run').length,
    strength: acts.filter((a) => a.kind === 'strength').length,
    completion: c.rate,
    completionDone: c.done,
    completionDue: c.due,
    xp: state.rank.seasonXp,
    daysLeft: diffDays(today, season.end),
  };
}

export function lifetimeStats(state: AppState) {
  const runs = state.activities.filter((a) => a.kind === 'run');
  return {
    sessions: state.activities.length,
    runs: runs.length,
    strength: state.activities.length - runs.length,
    distanceM: runs.reduce((sum, a) => sum + (a.distanceM ?? 0), 0),
    durationSec: state.activities.reduce((sum, a) => sum + a.durationSec, 0),
    activeDays: new Set(state.activities.map((a) => a.date)).size,
    badges: Object.keys(state.badges).length,
    totalBadges: BADGES.length,
    totalXp: state.xpLog.reduce((sum, e) => sum + e.amount, 0),
    importedRuns: (state.importedRuns ?? []).length,
    importedDistanceM: (state.importedRuns ?? []).reduce((sum, r) => sum + (r.distanceM ?? 0), 0),
  };
}
