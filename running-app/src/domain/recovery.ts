/** Turns optional health signals into gentle plan notes. Never forces changes. */
import type { RecoverySnapshot } from './types.ts';

export interface RecoveryAdvice {
  level: 'good' | 'caution' | 'take_it_easy';
  text: string;
}

export function recoveryAdvice(r: RecoverySnapshot | undefined): RecoveryAdvice | null {
  if (!r) return null;
  const shortSleep = r.sleepHours !== undefined && r.sleepHours < 6;
  const veryShortSleep = r.sleepHours !== undefined && r.sleepHours < 5;
  const hrUp =
    r.restingHr !== undefined && r.restingHrBaseline !== undefined && r.restingHr - r.restingHrBaseline >= 5;
  const hrWayUp =
    r.restingHr !== undefined && r.restingHrBaseline !== undefined && r.restingHr - r.restingHrBaseline >= 8;

  if ((shortSleep && hrUp) || veryShortSleep || hrWayUp) {
    return {
      level: 'take_it_easy',
      text: 'Your recovery signals are lower than usual. Consider a shorter session or swapping for mobility today — it still counts.',
    };
  }
  if (shortSleep) {
    return { level: 'caution', text: `Short night (${r.sleepHours!.toFixed(1)} h). Keep today truly easy.` };
  }
  if (hrUp) {
    return { level: 'caution', text: 'Resting heart rate is a little up compared to your usual. Easy effort and walk breaks are welcome today.' };
  }
  if (r.sleepHours !== undefined || r.restingHr !== undefined) {
    return { level: 'good', text: 'Recovery looks normal. Enjoy your session.' };
  }
  return null;
}

/** Average of the last 7 resting HR values, excluding today. */
export function restingHrBaseline(values: number[]): number | undefined {
  const prior = values.slice(0, -1).slice(-7);
  if (prior.length < 3) return undefined;
  return Math.round(prior.reduce((a, b) => a + b, 0) / prior.length);
}
