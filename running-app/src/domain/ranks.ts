/**
 * Seasonal rank ladder.
 *
 * Divisions are numbered 0…18: Bronze I = 0, Bronze III = 2, Silver I = 3 …
 * Master III = 17, Grandmaster = 18 (single tier).
 *
 * Climbing: XP fills the current division; filling it promotes. From Gold up,
 * a promotion also needs a consistency gate (recent plan-completion % and
 * active weeks). XP earned while waiting on a gate is banked, not lost.
 *
 * Regression: only while in Gold+, only on sustained inactivity, never in the
 * final two weeks of a season, and never below one major rank under where the
 * season started (and never out of Gold).
 */
import type { RankState } from './types.ts';

export const RANK_NAMES = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Master', 'Grandmaster'] as const;
export type RankName = (typeof RANK_NAMES)[number];

/** XP needed to clear one tier of each rank (tunable). */
export const XP_PER_TIER: Record<RankName, number> = {
  Bronze: 300,
  Silver: 450,
  Gold: 700,
  Platinum: 1000,
  Diamond: 1400,
  Master: 1900,
  Grandmaster: 2500,
};

export const MAX_DIVISION = 18;
export const GOLD_I = 6;

export interface ConsistencyGate {
  /** Plan completion over the last 28 days. */
  minCompletion: number;
  /** Weeks with at least one completed session, out of the last 4. */
  minActiveWeeks: number;
}

const GATES: Partial<Record<RankName, ConsistencyGate>> = {
  Gold: { minCompletion: 0.7, minActiveWeeks: 3 },
  Platinum: { minCompletion: 0.75, minActiveWeeks: 3 },
  Diamond: { minCompletion: 0.8, minActiveWeeks: 4 },
  Master: { minCompletion: 0.85, minActiveWeeks: 4 },
  Grandmaster: { minCompletion: 0.9, minActiveWeeks: 4 },
};

const TIER_NUMERALS = ['I', 'II', 'III'];

export function rankOf(division: number): RankName {
  return RANK_NAMES[Math.min(6, Math.floor(division / 3))];
}

export function majorIndex(division: number): number {
  return Math.min(6, Math.floor(division / 3));
}

export function tierOf(division: number): 1 | 2 | 3 | null {
  if (division >= MAX_DIVISION) return null;
  return ((division % 3) + 1) as 1 | 2 | 3;
}

export function divisionLabel(division: number): string {
  const tier = tierOf(division);
  return tier === null ? 'Grandmaster' : `${rankOf(division)} ${TIER_NUMERALS[tier - 1]}`;
}

/** XP to clear the given division. Grandmaster has a nominal bar for display. */
export function xpToClear(division: number): number {
  return XP_PER_TIER[rankOf(division)];
}

export function gateFor(targetDivision: number): ConsistencyGate | null {
  return GATES[rankOf(targetDivision)] ?? null;
}

export interface Consistency {
  completion28: number;
  activeWeeks4: number;
}

export type RankEvent =
  | { type: 'promoted'; division: number }
  | { type: 'gated'; division: number; requiredCompletion: number; currentCompletion: number };

export function newRankState(seasonId: string, division = 0): RankState {
  return { seasonId, division, xp: 0, bankedXp: 0, seasonXp: 0, startDivision: division, peakDivision: division };
}

function passesGate(target: number, c: Consistency): boolean {
  const gate = gateFor(target);
  return !gate || (c.completion28 >= gate.minCompletion && c.activeWeeks4 >= gate.minActiveWeeks);
}

/** Promote as far as XP + gates allow. Mutates a copy and returns it. */
function settle(state: RankState, c: Consistency, events: RankEvent[], reportGate: boolean): RankState {
  const s = { ...state };
  while (s.division < MAX_DIVISION) {
    const need = xpToClear(s.division);
    if (s.xp + s.bankedXp < need) {
      s.xp += s.bankedXp;
      s.bankedXp = 0;
      break;
    }
    const target = s.division + 1;
    if (!passesGate(target, c)) {
      const total = s.xp + s.bankedXp;
      s.xp = need;
      // Bank at most one extra tier so a long gate wait can't skip several divisions at once.
      s.bankedXp = Math.min(total - need, xpToClear(target));
      if (reportGate) {
        events.push({
          type: 'gated',
          division: target,
          requiredCompletion: gateFor(target)!.minCompletion,
          currentCompletion: c.completion28,
        });
      }
      break;
    }
    const overflow = s.xp + s.bankedXp - need;
    s.division = target;
    s.xp = overflow;
    s.bankedXp = 0;
    events.push({ type: 'promoted', division: target });
  }
  if (s.division >= MAX_DIVISION) {
    s.xp += s.bankedXp;
    s.bankedXp = 0;
  }
  s.peakDivision = Math.max(s.peakDivision, s.division);
  return s;
}

export function addXp(state: RankState, amount: number, c: Consistency): { state: RankState; events: RankEvent[] } {
  const events: RankEvent[] = [];
  const wasGated = state.division < MAX_DIVISION && state.xp >= xpToClear(state.division);
  const s = { ...state, xp: state.xp + amount, seasonXp: state.seasonXp + amount };
  // Only announce a gate the first time it's hit, not on every session afterwards.
  return { state: settle(s, c, events, !wasGated), events };
}

/** Re-check gates after consistency changes (e.g. completion % rises). */
export function reevaluate(state: RankState, c: Consistency): { state: RankState; events: RankEvent[] } {
  const events: RankEvent[] = [];
  return { state: settle(state, c, events, false), events };
}

/** Is the user sitting at a full bar, waiting on the consistency gate? */
export function isGated(state: RankState): boolean {
  return state.division < MAX_DIVISION && state.xp >= xpToClear(state.division);
}

export function decayFloor(startDivision: number): number {
  const oneMajorBelowStart = Math.max(0, majorIndex(startDivision) - 1) * 3;
  return Math.max(GOLD_I, oneMajorBelowStart);
}

export interface DecayResult {
  state: RankState;
  xpLost: number;
  demoted: boolean;
}

/**
 * Weekly decay check. `completion14` is plan completion over the last 14 days.
 * Gentle by design: 10% of a tier for low completion, 20% for very low, and a
 * demotion lands you 60% of the way through the division below.
 */
export function applyDecay(
  state: RankState,
  completion14: number,
  opts: { finalTwoWeeks: boolean; paused: boolean },
): DecayResult {
  const none = { state, xpLost: 0, demoted: false };
  if (state.division < GOLD_I || opts.finalTwoWeeks || opts.paused) return none;
  if (completion14 >= 0.5) return none;
  const need = xpToClear(state.division);
  const loss = Math.round(need * (completion14 < 0.25 ? 0.2 : 0.1));
  const floor = decayFloor(state.startDivision);
  const s = { ...state, bankedXp: 0 };
  if (s.xp >= loss) {
    s.xp -= loss;
    return { state: s, xpLost: loss, demoted: false };
  }
  if (s.division > floor) {
    s.division -= 1;
    s.xp = Math.round(xpToClear(s.division) * 0.6);
    return { state: s, xpLost: loss, demoted: true };
  }
  const lost = s.xp;
  s.xp = 0;
  return { state: s, xpLost: lost, demoted: false };
}

export interface SeasonSummary {
  completion: number; // whole-season plan completion
  sessions: number;
  activeWeeksLast4: number;
}

/**
 * Where a user starts next season. Roughly one major rank down; very consistent
 * users drop only two tiers; inactive users start at Bronze I.
 */
export function softResetDivision(finalDivision: number, summary: SeasonSummary): number {
  if (summary.sessions === 0 || summary.activeWeeksLast4 === 0 || summary.completion < 0.25) return 0;
  const drop = summary.completion >= 0.85 && summary.activeWeeksLast4 >= 3 ? 2 : 3;
  return Math.max(0, Math.min(finalDivision, MAX_DIVISION) - drop);
}

/** 0..1 progress through the current division, for progress bars. */
export function divisionProgress(state: RankState): number {
  if (state.division >= MAX_DIVISION) return Math.min(1, (state.xp % xpToClear(state.division)) / xpToClear(state.division));
  return Math.min(1, state.xp / xpToClear(state.division));
}
