import {
  addDays as fnsAddDays,
  differenceInCalendarDays,
  format,
  parse,
  startOfWeek,
} from 'date-fns';
import { WEEK_STARTS_ON } from './constants';

export const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
export const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Parse a `yyyy-MM-dd` string as a *local* date (never UTC-shifted). */
export function D(s: string): Date {
  return parse(s, 'yyyy-MM-dd', new Date());
}

export function ISO(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

export function addDays(s: string, n: number): string {
  return ISO(fnsAddDays(D(s), n));
}

export function todayIso(): string {
  return ISO(new Date());
}

/** Start of the week containing `s`, as an ISO date string. */
export function sow(s: string): string {
  return ISO(startOfWeek(D(s), { weekStartsOn: WEEK_STARTS_ON }));
}

/** Whole days between two ISO dates (b - a). */
export function daysBetween(a: string, b: string): number {
  return differenceInCalendarDays(D(b), D(a));
}

/** Every week-start between two ISO dates, inclusive. */
export function weeksBetween(a: string, b: string): string[] {
  const out: string[] = [];
  if (!a || !b) return out;
  let w = sow(a);
  const last = sow(b);
  let guard = 0;
  while (w <= last && guard++ < 520) {
    out.push(w);
    w = addDays(w, 7);
  }
  return out;
}

/** "Sep 3" */
export function md(s: string | null | undefined): string {
  if (!s) return '—';
  const d = D(s);
  return `${MON[d.getMonth()]} ${d.getDate()}`;
}

/** "Sep 3, 2026" */
export function mdy(s: string | null | undefined): string {
  if (!s) return '—';
  const d = D(s);
  return `${MON[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export function monthLabel(yyyyMM: string): string {
  return `${MONL[Number(yyyyMM.slice(5)) - 1]} ${yyyyMM.slice(0, 4)}`;
}
