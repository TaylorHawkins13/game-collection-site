import type { DateKey } from './types.ts';

const DAY_MS = 86_400_000;

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Local calendar date of a Date (or epoch ms). */
export function toDateKey(d: Date | number = new Date()): DateKey {
  const date = typeof d === 'number' ? new Date(d) : d;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parts(k: DateKey): [number, number, number] {
  const [y, m, d] = k.split('-').map(Number);
  return [y, m, d];
}

/** Local midnight for a date key. */
export function fromDateKey(k: DateKey): Date {
  const [y, m, d] = parts(k);
  return new Date(y, m - 1, d);
}

// Calendar arithmetic is done in UTC on the date components so DST never
// produces 23- or 25-hour "days".
function utc(k: DateKey): number {
  const [y, m, d] = parts(k);
  return Date.UTC(y, m - 1, d);
}

function fromUtc(ms: number): DateKey {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function addDays(k: DateKey, n: number): DateKey {
  return fromUtc(utc(k) + n * DAY_MS);
}

/** Whole days from a to b (positive when b is later). */
export function diffDays(a: DateKey, b: DateKey): number {
  return Math.round((utc(b) - utc(a)) / DAY_MS);
}

/** 0 = Monday … 6 = Sunday. */
export function weekday(k: DateKey): number {
  return (new Date(utc(k)).getUTCDay() + 6) % 7;
}

export function weekStartMonday(k: DateKey): DateKey {
  return addDays(k, -weekday(k));
}

export function rangeKeys(from: DateKey, to: DateKey): DateKey[] {
  const out: DateKey[] = [];
  for (let k = from; k <= to; k = addDays(k, 1)) out.push(k);
  return out;
}

export function minKey(a: DateKey, b: DateKey): DateKey {
  return a < b ? a : b;
}

export function maxKey(a: DateKey, b: DateKey): DateKey {
  return a > b ? a : b;
}

const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEKDAY_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function weekdayShort(k: DateKey): string {
  return WEEKDAY_SHORT[weekday(k)];
}

export function weekdayLong(k: DateKey): string {
  return WEEKDAY_LONG[weekday(k)];
}

export function weekdayName(i: number): string {
  return WEEKDAY_SHORT[i];
}

export function formatShort(k: DateKey): string {
  const [, m, d] = parts(k);
  return `${MONTH_SHORT[m - 1]} ${d}`;
}
