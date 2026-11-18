/** Consistency XP values (tunable). XP rewards showing up, not volume. */
export const XP = {
  run: 50,
  strength: 30,
  /** An unplanned extra session: a small thank-you, deliberately not a reason to overdo it. */
  extraSession: 15,
  weeklyTarget: 100,
  weeklyChallenge: 75,
  feedback: 10,
  restDay: 10,
  /** Stopping early still counts for something when at least this much was done. */
  partialThreshold: 0.5,
  partialFactor: 0.6,
} as const;

export function sessionXp(kind: 'run' | 'strength', planned: boolean, completion: number): number {
  if (!planned) return XP.extraSession;
  const base = kind === 'run' ? XP.run : XP.strength;
  if (completion >= 0.9) return base;
  if (completion >= XP.partialThreshold) return Math.round(base * XP.partialFactor);
  return Math.round(base * 0.3);
}
