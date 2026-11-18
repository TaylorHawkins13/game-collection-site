/**
 * Shared domain types. Everything under src/domain is pure TypeScript with no
 * React Native imports, so it can be unit-tested with `node --test`.
 */

/** Local calendar date, 'YYYY-MM-DD'. */
export type DateKey = string;

export type ExperienceLevel = 'new' | 'returning' | 'consistent' | 'experienced';
export type WeeklyFrequency = 0 | 1 | 2 | 3;
export type GoalId =
  | 'habit'
  | 'run30'
  | '5k'
  | '5k_faster'
  | '10k'
  | '10k_faster'
  | 'half'
  | 'half_faster'
  | 'marathon'
  | 'back_to_routine'
  | 'fitness'
  | 'stress';

export type RaceDistance = '5k' | '10k' | 'half' | 'marathon';
export type RaceTerrain = 'road' | 'trail' | 'track' | 'cross_country';

export interface Race {
  id: string;
  name: string;
  date: DateKey;
  distanceM: number;
  terrain: RaceTerrain;
  /** PB attempt = "A race": the plan builds, peaks and tapers for it. */
  pbAttempt: boolean;
  goalTimeSec?: number;
  catalogId?: string;
  result?: { activityId: string; timeSec: number };
}

/** One slot in a self-built weekly plan. */
export interface CustomSlot {
  weekday: number; // 0 = Monday
  kind: 'run' | 'strength';
  runType?: 'easy' | 'long' | 'tempo' | 'intervals' | 'hills' | 'walk_run' | 'strides';
  routineId?: string;
  durationMin: number;
  optional?: boolean;
}
export type PbRecency = 'recent' | 'one_two_years' | 'older';

export interface PersonalBest {
  distance: RaceDistance;
  timeSec: number;
  recency: PbRecency;
}
export type IssueId = 'knee' | 'shin' | 'calf_achilles' | 'hip_back' | 'fatigue';
export type Units = 'km' | 'mi';

export interface Profile {
  level: ExperienceLevel;
  /** Only asked for new/returning runners. */
  frequency: WeeklyFrequency | null;
  goal: GoalId;
  issues: IssueId[];
  /** Personal bests; the plan derives training paces from these. */
  pbs: PersonalBest[];
  /** Optional finish-time target for "get faster" goals (seconds). */
  goalTimeSec?: number;
  /** 'adaptive' (default): Steady builds and adapts the plan. 'custom': the user's own weekly plan. */
  planMode?: 'adaptive' | 'custom';
  customWeek?: CustomSlot[];
  /** Experienced/consistent runners may opt into one light quality session (strides). */
  includeQuality: boolean;
  runsPerWeek: number;
  /** Optional strength/mobility sessions per week (0–2). */
  strengthPerWeek: number;
  /** Preferred run weekdays, 0 = Monday … 6 = Sunday. Empty = use defaults. */
  preferredDays: number[];
  units: Units;
  /** Hide the first/last stretch of routes on maps and exports. */
  hideRouteEnds: boolean;
  audioCues: boolean;
  /** Announce each km/mi split. */
  splitAnnouncements: boolean;
  morningReminder: { enabled: boolean; hour: number; minute: number };
  afternoonNudge: { enabled: boolean; hour: number; minute: number };
  createdAt: DateKey;
}

export type RunType = 'walk_run' | 'easy' | 'long' | 'strides' | 'walk' | 'tempo' | 'intervals' | 'hills' | 'race';

export interface WalkRunStructure {
  warmupMin: number;
  runSec: number;
  walkSec: number;
  repeats: number;
  cooldownMin: number;
}

export type SessionStatus =
  | 'planned'
  | 'completed'
  | 'missed' // date passed without being done — never penalised beyond not earning XP
  | 'skipped' // user chose to skip
  | 'dropped' // user shortened the week; no longer counts toward the weekly target
  | 'paused'; // fell inside a "life happens" pause; excluded from every metric

export interface PlannedSession {
  id: string;
  date: DateKey;
  kind: 'run' | 'strength';
  runType?: RunType;
  /** Index into the run progression ladder this session was built from. */
  step?: number;
  title: string;
  durationMin: number;
  walkRun?: WalkRunStructure;
  /** Tempo/interval structure: runSec = hard rep, walkSec = easy jog between reps. */
  workout?: WalkRunStructure;
  /** Target pace for the hard reps (sec/km), from the user's PBs. */
  targetPaceSecPerKm?: number;
  strides?: number;
  routineId?: string;
  raceId?: string;
  /** Optional sessions earn XP but never count against completion %. */
  optional: boolean;
  status: SessionStatus;
  activityId?: string;
  /** Set when the plan swapped this in for a run (e.g. after soreness). */
  replacedFrom?: 'run';
  /** Short, encouraging note explaining any adjustment. */
  note?: string;
  movedFrom?: DateKey;
}

export type WeekDirective = 'progress' | 'hold' | 'ease' | 'recovery';

export interface PlanWeek {
  index: number; // 0-based week number since plan start
  start: DateKey;
  end: DateKey;
  directive: WeekDirective;
  sessions: PlannedSession[];
  challengeId: string;
  summary: string;
  /** e.g. "Build phase · London Marathon in 9 weeks" */
  phaseNote?: string;
}

export interface PlanState {
  startDate: DateKey;
  step: number;
  weeksSinceProgress: number;
  weeks: PlanWeek[];
}

export type Feel = 'easy' | 'just_right' | 'hard';
export type Soreness = 'none' | 'mild' | 'noticeable';

export interface Split {
  index: number; // 1-based
  distanceM: number; // length of this split (last one may be partial)
  durationSec: number;
}

export interface RoutePoint {
  lat: number;
  lng: number;
  t: number; // epoch ms
  alt?: number;
}

export interface Activity {
  id: string;
  date: DateKey;
  startedAt: number;
  endedAt: number;
  kind: 'run' | 'strength';
  plannedSessionId?: string;
  title: string;
  /** Moving time (pauses excluded). */
  durationSec: number;
  distanceM?: number;
  treadmill?: boolean;
  splits?: Split[];
  route?: RoutePoint[];
  avgHr?: number;
  maxHr?: number;
  feel?: Feel;
  soreness?: Soreness;
  xpEarned: number;
  /** Fraction of the planned session completed (1 = all of it). */
  completion: number;
  healthSynced?: boolean;
  routineId?: string;
}

export interface RankState {
  seasonId: string;
  division: number;
  xp: number; // progress inside the current division
  bankedXp: number; // XP earned while waiting on a consistency gate
  seasonXp: number;
  startDivision: number;
  peakDivision: number; // this season
}

export interface SeasonFinish {
  seasonId: string;
  label: string; // e.g. "Gold – Q1 2026"
  division: number;
  sessions: number;
  completion: number;
}

export interface XpEvent {
  date: DateKey;
  amount: number;
  reason: XpReason;
  refId?: string;
}

export type XpReason =
  | 'run'
  | 'strength'
  | 'extra_session'
  | 'weekly_target'
  | 'weekly_challenge'
  | 'feedback'
  | 'rest_day';

export interface RecoverySnapshot {
  date: DateKey;
  sleepHours?: number;
  restingHr?: number;
  restingHrBaseline?: number;
}

export interface Pause {
  start: DateKey;
  end: DateKey;
  reason: 'sick' | 'injury' | 'travel' | 'busy' | 'other';
}

export interface Notice {
  id: string;
  date: DateKey;
  kind: 'plan' | 'rank' | 'recovery' | 'welcome';
  text: string;
  dismissed?: boolean;
}

export type FitnessReason =
  | 'pb'
  | 'estimated'
  | 'faster_run'
  | 'workouts_easy'
  | 'easy_trend'
  | 'workouts_hard'
  | 'easy_struggle'
  | 'break';

export interface FitnessChange {
  date: DateKey;
  fiveKSec: number;
  reason: FitnessReason;
}

/** Current fitness as a 5K-equivalent time. Starts from PBs and moves with real runs. */
export interface Fitness {
  fiveKSec: number;
  updatedAt: DateKey;
  log: FitnessChange[];
}

export interface AppState {
  version: 1;
  fitness?: Fitness;
  races?: Race[];
  profile: Profile | null;
  plan: PlanState | null;
  activities: Activity[];
  rank: RankState;
  peakDivisionEver: number;
  seasonFinishes: SeasonFinish[];
  badges: Record<string, DateKey>;
  xpLog: XpEvent[];
  restClaims: DateKey[];
  pauses: Pause[];
  health: { connected: boolean; lastSync?: number; recovery?: RecoverySnapshot };
  notices: Notice[];
  /** Weeks (by start date) where the weekly-target / challenge bonus was paid. */
  weeklyTargetPaid: DateKey[];
  challengePaid: DateKey[];
  lastTick: DateKey | null;
}

export type EngineEvent =
  | { type: 'xp'; amount: number; reason: XpReason }
  | { type: 'promoted'; division: number }
  | { type: 'gated'; division: number; requiredCompletion: number; currentCompletion: number }
  | { type: 'decay'; xpLost: number; division: number; demoted: boolean }
  | { type: 'badge'; id: string }
  | { type: 'season_reset'; finish: SeasonFinish | null; newDivision: number }
  | { type: 'weekly_target' }
  | { type: 'challenge'; id: string }
  | { type: 'plan_note'; text: string }
  | { type: 'fitness'; direction: 'up' | 'down'; reason: FitnessReason; text: string }
  | { type: 'possible_pb'; distance: RaceDistance; timeSec: number };
