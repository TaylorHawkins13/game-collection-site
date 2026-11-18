/**
 * Imported history (Apple Health, Health Connect, Strava). Imported runs feed
 * the fitness estimate and lifetime stats, but never XP, badges or plan completion.
 */
import { addDays, diffDays } from './dates.ts';
import { riegel } from './pace.ts';
import type { Activity, AppState, DateKey, ImportedRun } from './types.ts';

/** Add new imports, skipping ones already imported or that overlap a run recorded in Steady (we write those to Health ourselves). */
export function mergeImports(state: AppState, incoming: ImportedRun[]): { runs: ImportedRun[]; added: number } {
  const existing = state.importedRuns ?? [];
  const seen = new Set(existing.map((r) => `${r.source}:${r.externalId}`));
  const overlapsRecorded = (r: ImportedRun) =>
    state.activities.some((a: Activity) => Math.abs(a.startedAt - r.startedAt) < 5 * 60_000) ||
    existing.some((e) => e.source !== r.source && Math.abs(e.startedAt - r.startedAt) < 5 * 60_000);
  const fresh: ImportedRun[] = [];
  for (const r of incoming) {
    const key = `${r.source}:${r.externalId}`;
    if (seen.has(key) || overlapsRecorded(r) || fresh.some((f) => Math.abs(f.startedAt - r.startedAt) < 5 * 60_000)) continue;
    if (r.durationSec < 300) continue; // ignore tiny entries
    seen.add(key);
    fresh.push(r);
  }
  const runs = [...existing, ...fresh].sort((a, b) => b.startedAt - a.startedAt).slice(0, 2000);
  return { runs, added: fresh.length };
}

/**
 * A 5K-equivalent from recent history: the median of the three best equivalents
 * among runs ≥3 km in the last 10 weeks (training runs understate fitness a bit,
 * and the median protects against one GPS-glitched "super run").
 */
export function fitnessFromHistory(runs: ImportedRun[], today: DateKey): number | null {
  const since = addDays(today, -70);
  const equivs = runs
    .filter((r) => r.date >= since && !r.treadmill && (r.distanceM ?? 0) >= 3000 && r.durationSec > 0)
    .map((r) => riegel(r.durationSec, r.distanceM!, 5000))
    .filter((t) => t / 5 >= 160 && t / 5 <= 720)
    .sort((a, b) => a - b)
    .slice(0, 3);
  if (equivs.length < 2) return null;
  return Math.round(equivs[Math.floor(equivs.length / 2)]);
}

export interface HistorySummary {
  runs: number;
  last8Weeks: number;
  perWeek: number;
  longestMin: number;
  lastRunDaysAgo: number | null;
}

export function historySummary(runs: ImportedRun[], today: DateKey): HistorySummary {
  const recent = runs.filter((r) => diffDays(r.date, today) <= 56);
  const last = runs.reduce<DateKey | null>((m, r) => (!m || r.date > m ? r.date : m), null);
  return {
    runs: runs.length,
    last8Weeks: recent.length,
    perWeek: Math.round((recent.length / 8) * 10) / 10,
    longestMin: Math.round(Math.max(0, ...recent.map((r) => r.durationSec)) / 60),
    lastRunDaysAgo: last ? diffDays(last, today) : null,
  };
}

/** A gentle hint if history suggests a different starting point than the one picked. */
export function levelHint(s: HistorySummary, level: string): string | null {
  if (level === 'new' && s.perWeek >= 2) return `You’ve been running about ${s.perWeek}× a week lately. “Returning” or “Already consistent” might suit you better (Profile → Plan & settings).`;
  if ((level === 'experienced' || level === 'consistent') && s.last8Weeks <= 2 && s.runs > 0) return 'Your history shows only a few runs recently. Starting a little gentler (“Returning”) could help you build back safely.';
  return null;
}
