import { addDays, diffDays } from './dates.ts';
import type { DateKey } from './types.ts';

export interface SeasonInfo {
  id: string; // '2026-Q1'
  year: number;
  quarter: 1 | 2 | 3 | 4;
  start: DateKey;
  end: DateKey;
  /** Short label used on finish badges, e.g. "Q1 2026". */
  label: string;
  /** Friendly name shown in the UI. */
  name: string;
}

const NAMES = ['Fresh Start', 'Spring Stride', 'Summer Miles', 'Autumn Steady'] as const;

export function seasonFor(k: DateKey): SeasonInfo {
  const year = Number(k.slice(0, 4));
  const month = Number(k.slice(5, 7));
  const quarter = (Math.floor((month - 1) / 3) + 1) as 1 | 2 | 3 | 4;
  return seasonOf(year, quarter);
}

export function seasonOf(year: number, quarter: 1 | 2 | 3 | 4): SeasonInfo {
  const startMonth = (quarter - 1) * 3 + 1;
  const start = `${year}-${String(startMonth).padStart(2, '0')}-01`;
  const nextStart =
    quarter === 4 ? `${year + 1}-01-01` : `${year}-${String(startMonth + 3).padStart(2, '0')}-01`;
  return {
    id: `${year}-Q${quarter}`,
    year,
    quarter,
    start,
    end: addDays(nextStart, -1),
    label: `Q${quarter} ${year}`,
    name: NAMES[quarter - 1],
  };
}

export function seasonById(id: string): SeasonInfo {
  const [y, q] = id.split('-Q');
  return seasonOf(Number(y), Number(q) as 1 | 2 | 3 | 4);
}

export function nextSeason(s: SeasonInfo): SeasonInfo {
  return s.quarter === 4 ? seasonOf(s.year + 1, 1) : seasonOf(s.year, (s.quarter + 1) as 2 | 3 | 4);
}

/** Days remaining after today (0 on the last day). */
export function daysLeft(k: DateKey): number {
  return diffDays(k, seasonFor(k).end);
}

/** Rank decay is paused in the final 14 days of every season. */
export function inFinalTwoWeeks(k: DateKey): boolean {
  return daysLeft(k) < 14;
}
