/**
 * Popular races to pick from instead of typing. Dates change every year, so we
 * only store the usual month (when well established) and ask the user to set
 * the actual date from the official site.
 */
import type { RaceTerrain } from './types.ts';

export interface CatalogRace {
  id: string;
  name: string;
  place: string;
  distanceM: number;
  terrain: RaceTerrain;
  /** 1–12, or null when it varies / is weekly. */
  usualMonth: number | null;
  note?: string;
}

const M = 42195;
const H = 21097.5;

export const RACE_CATALOG: CatalogRace[] = [
  { id: 'parkrun', name: 'parkrun', place: 'Worldwide', distanceM: 5000, terrain: 'road', usualMonth: null, note: 'Free, timed 5K every Saturday morning.' },
  { id: 'turkey-trot', name: 'Turkey Trot', place: 'USA', distanceM: 5000, terrain: 'road', usualMonth: 11, note: 'Thanksgiving morning 5Ks.' },
  { id: 'great-manchester-run', name: 'Great Manchester Run', place: 'Manchester, UK', distanceM: 10000, terrain: 'road', usualMonth: 5 },
  { id: 'peachtree', name: 'AJC Peachtree Road Race', place: 'Atlanta, USA', distanceM: 10000, terrain: 'road', usualMonth: 7 },
  { id: 'bolder-boulder', name: 'Bolder Boulder', place: 'Boulder, USA', distanceM: 10000, terrain: 'road', usualMonth: 5 },
  { id: 'cooper-river', name: 'Cooper River Bridge Run', place: 'Charleston, USA', distanceM: 10000, terrain: 'road', usualMonth: 4 },
  { id: 'great-north-run', name: 'Great North Run', place: 'Newcastle, UK', distanceM: H, terrain: 'road', usualMonth: 9 },
  { id: 'royal-parks-half', name: 'Royal Parks Half', place: 'London, UK', distanceM: H, terrain: 'road', usualMonth: 10 },
  { id: 'bath-half', name: 'Bath Half', place: 'Bath, UK', distanceM: H, terrain: 'road', usualMonth: 3 },
  { id: 'cardiff-half', name: 'Cardiff Half', place: 'Cardiff, UK', distanceM: H, terrain: 'road', usualMonth: 10 },
  { id: 'great-scottish-run', name: 'Great Scottish Run (half)', place: 'Glasgow, UK', distanceM: H, terrain: 'road', usualMonth: 10 },
  { id: 'nyc-half', name: 'NYC Half', place: 'New York, USA', distanceM: H, terrain: 'road', usualMonth: 3 },
  { id: 'london-marathon', name: 'London Marathon', place: 'London, UK', distanceM: M, terrain: 'road', usualMonth: 4 },
  { id: 'manchester-marathon', name: 'Manchester Marathon', place: 'Manchester, UK', distanceM: M, terrain: 'road', usualMonth: 4 },
  { id: 'brighton-marathon', name: 'Brighton Marathon', place: 'Brighton, UK', distanceM: M, terrain: 'road', usualMonth: 4 },
  { id: 'edinburgh-marathon', name: 'Edinburgh Marathon', place: 'Edinburgh, UK', distanceM: M, terrain: 'road', usualMonth: 5 },
  { id: 'dublin-marathon', name: 'Dublin Marathon', place: 'Dublin, Ireland', distanceM: M, terrain: 'road', usualMonth: 10 },
  { id: 'boston-marathon', name: 'Boston Marathon', place: 'Boston, USA', distanceM: M, terrain: 'road', usualMonth: 4, note: 'Qualifying time or charity place needed.' },
  { id: 'nyc-marathon', name: 'New York City Marathon', place: 'New York, USA', distanceM: M, terrain: 'road', usualMonth: 11 },
  { id: 'chicago-marathon', name: 'Chicago Marathon', place: 'Chicago, USA', distanceM: M, terrain: 'road', usualMonth: 10 },
  { id: 'marine-corps-marathon', name: 'Marine Corps Marathon', place: 'Arlington, USA', distanceM: M, terrain: 'road', usualMonth: 10 },
  { id: 'la-marathon', name: 'Los Angeles Marathon', place: 'Los Angeles, USA', distanceM: M, terrain: 'road', usualMonth: 3 },
  { id: 'philadelphia-marathon', name: 'Philadelphia Marathon', place: 'Philadelphia, USA', distanceM: M, terrain: 'road', usualMonth: 11 },
  { id: 'grandmas-marathon', name: "Grandma's Marathon", place: 'Duluth, USA', distanceM: M, terrain: 'road', usualMonth: 6 },
  { id: 'berlin-marathon', name: 'Berlin Marathon', place: 'Berlin, Germany', distanceM: M, terrain: 'road', usualMonth: 9 },
  { id: 'paris-marathon', name: 'Paris Marathon', place: 'Paris, France', distanceM: M, terrain: 'road', usualMonth: 4 },
  { id: 'amsterdam-marathon', name: 'Amsterdam Marathon', place: 'Amsterdam, Netherlands', distanceM: M, terrain: 'road', usualMonth: 10 },
  { id: 'valencia-marathon', name: 'Valencia Marathon', place: 'Valencia, Spain', distanceM: M, terrain: 'road', usualMonth: 12 },
  { id: 'tokyo-marathon', name: 'Tokyo Marathon', place: 'Tokyo, Japan', distanceM: M, terrain: 'road', usualMonth: 3 },
  { id: 'sydney-marathon', name: 'Sydney Marathon', place: 'Sydney, Australia', distanceM: M, terrain: 'road', usualMonth: null },
  // Ultras (distances vary slightly by year/course — adjust if needed).
  { id: 'two-oceans', name: 'Two Oceans Ultra', place: 'Cape Town, South Africa', distanceM: 56000, terrain: 'road', usualMonth: null, note: 'Usually around Easter.' },
  { id: 'comrades', name: 'Comrades Marathon', place: 'KwaZulu-Natal, South Africa', distanceM: 88000, terrain: 'road', usualMonth: 6, note: 'Direction (up/down) and distance change by year.' },
  { id: 'lavaredo', name: 'Lavaredo Ultra Trail', place: 'Cortina, Italy', distanceM: 120000, terrain: 'trail', usualMonth: 6 },
  { id: 'western-states', name: 'Western States 100', place: 'California, USA', distanceM: 160934, terrain: 'trail', usualMonth: 6, note: 'Entry by lottery.' },
  { id: 'badwater', name: 'Badwater 135', place: 'California, USA', distanceM: 217000, terrain: 'road', usualMonth: 7, note: 'Invitation only.' },
  { id: 'leadville', name: 'Leadville Trail 100', place: 'Colorado, USA', distanceM: 160934, terrain: 'trail', usualMonth: 8 },
  { id: 'utmb', name: 'UTMB', place: 'Chamonix, France', distanceM: 171000, terrain: 'trail', usualMonth: 8, note: 'Qualifying points needed.' },
  { id: 'javelina', name: 'Javelina Jundred', place: 'Arizona, USA', distanceM: 160934, terrain: 'trail', usualMonth: 10 },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function usualWhen(r: CatalogRace): string {
  if (r.id === 'parkrun') return 'Every Saturday';
  return r.usualMonth ? `Usually ${MONTHS[r.usualMonth - 1]}` : 'Date varies';
}

export function searchCatalog(q: string): CatalogRace[] {
  const t = q.trim().toLowerCase();
  if (!t) return RACE_CATALOG;
  return RACE_CATALOG.filter((r) => `${r.name} ${r.place}`.toLowerCase().includes(t));
}
