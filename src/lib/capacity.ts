/**
 * Scheduling / capacity domain logic, ported straight from the Claude Design
 * mockup's component script so the real app behaves identically.
 */
import type { AppData, BarDrag, Group, GroupSpecialist, Person } from '../types';
import { CAPACITY_CEILING, SPECIALIST_PALETTE } from './constants';
import { D, ISO, addDays, daysBetween, sow, todayIso, weeksBetween } from './dates';

export function specialistsOf(data: AppData): Person[] {
  return data.people.filter((p) => p.role === 'Specialist');
}

export function personById(data: AppData, id: string): Person | undefined {
  return data.people.find((p) => p.id === id);
}

export function personName(data: AppData, id: string): string {
  return personById(data, id)?.name ?? '—';
}

export function specialistColor(data: AppData, id: string): string {
  const i = specialistsOf(data).findIndex((p) => p.id === id);
  return i < 0 ? 'var(--color-neutral-500)' : SPECIALIST_PALETTE[i % SPECIALIST_PALETTE.length];
}

/**
 * The group's OE window, with any in-flight calendar drag applied so bars
 * follow the pointer before the change is committed.
 */
export function windowOf(g: Group, drag: BarDrag | null): [string, string] {
  if (drag && drag.gid === g.id && drag.delta !== 0 && g.oeStart) {
    if (drag.mode === 'move') return [addDays(g.oeStart, drag.delta), addDays(g.oeEnd, drag.delta)];
    if (drag.mode === 'start') {
      const s = addDays(g.oeStart, drag.delta);
      return [s > g.oeEnd ? g.oeEnd : s, g.oeEnd];
    }
    const e = addDays(g.oeEnd, drag.delta);
    return [g.oeStart, e < g.oeStart ? g.oeStart : e];
  }
  return [g.oeStart, g.oeEnd];
}

/**
 * A group's eNav closeout: the configured closeout day in the month *before*
 * its benefit effective date. Effective 9/1 closes out in August.
 */
export function deadlineOf(data: AppData, g: Group): string | null {
  if (!g.effective) return null;
  const d = D(g.effective);
  let m = d.getMonth();
  let y = d.getFullYear();
  m -= 1;
  if (m < 0) {
    m = 11;
    y -= 1;
  }
  const day = data.closeouts[m + 1];
  if (!day) return null;
  return ISO(new Date(y, m, day));
}

export function isLate(data: AppData, g: Group, drag: BarDrag | null = null): boolean {
  const dl = deadlineOf(data, g);
  const end = windowOf(g, drag)[1];
  return !!(dl && end && end > dl);
}

export type DocState = 'asa' | 'census' | 'ok';

export function docState(g: Group): DocState {
  if (!g.docs.asa.done) return 'asa';
  return g.docs.census.done ? 'ok' : 'census';
}

/** A specialist's capacity for a given week, honouring per-week overrides. */
export function capacityOf(p: Person, weekStart: string): number {
  const raw = (p.capWeeks ?? {})[weekStart];
  const n = Number(raw);
  return raw !== undefined && raw !== '' && !Number.isNaN(n) ? n : p.capacity ?? 0;
}

export function teamCapacityOf(data: AppData, weekStart: string): number {
  return specialistsOf(data).reduce((t, p) => t + capacityOf(p, weekStart), 0);
}

/** Employees of `g` that land in the given week (evenly split unless overridden). */
export function loadFor(g: Group, weekStart: string, drag: BarDrag | null = null): number {
  const [s, e] = windowOf(g, drag);
  if (!s || !e) return 0;
  const wks = weeksBetween(s, e);
  if (wks.indexOf(weekStart) < 0) return 0;
  const raw = (g.weekLoad ?? {})[weekStart];
  const n = Number(raw);
  if (raw !== undefined && raw !== '' && !Number.isNaN(n)) return n;
  return (g.employees || 0) / wks.length;
}

/** Employees booked per specialist for one week. */
export function bookedByWeek(
  data: AppData,
  weekStart: string,
  excludeGroupId?: string,
  drag: BarDrag | null = null,
): Record<string, number> {
  const m: Record<string, number> = {};
  for (const g of data.groups) {
    if (g.oeMode === 'None' || g.id === excludeGroupId) continue;
    const load = loadFor(g, weekStart, drag);
    if (!load) continue;
    const tot = g.employees || 1;
    for (const a of g.specialists ?? []) {
      m[a.id] = (m[a.id] ?? 0) + load * ((Number(a.share) || 0) / tot);
    }
  }
  return m;
}

export interface WeekTotals {
  booked: number;
  cap: number;
  pct: number;
}

export function teamWeek(
  data: AppData,
  weekStart: string,
  excludeGroupId?: string,
  drag: BarDrag | null = null,
): WeekTotals {
  const m = bookedByWeek(data, weekStart, excludeGroupId, drag);
  const booked = specialistsOf(data).reduce((t, p) => t + (m[p.id] ?? 0), 0);
  const cap = teamCapacityOf(data, weekStart);
  return { booked: Math.round(booked), cap, pct: cap ? booked / cap : 0 };
}

export interface WindowFit {
  pct: number;
  at: { booked: number; cap: number; ws: string };
  weeks: number;
  past: boolean;
  dl: string | null;
  over: boolean;
  tight: boolean;
}

/** How a candidate window would land: busiest week, closeout overrun, verdict. */
export function fitWindow(data: AppData, g: Group, start: string, end: string): WindowFit {
  const wks = weeksBetween(start, end);
  const per = (g.employees || 0) / Math.max(1, wks.length);
  let worst = 0;
  let at: WindowFit['at'] | null = null;
  for (const ws of wks) {
    const t = teamWeek(data, ws, g.id);
    const booked = t.booked + per;
    const pct = t.cap ? booked / t.cap : 0;
    if (pct >= worst) {
      worst = pct;
      at = { booked: Math.round(booked), cap: t.cap, ws };
    }
  }
  const dl = deadlineOf(data, g);
  return {
    pct: worst,
    at: at ?? { booked: 0, cap: 0, ws: start },
    weeks: wks.length,
    past: !!(dl && end > dl),
    dl,
    over: worst > 1,
    tight: worst >= CAPACITY_CEILING && worst <= 1,
  };
}

export interface Suggestion {
  week: string;
  spec: Person;
}

/**
 * First two-week opening before the closeout where some specialist still has
 * room. `reserve` lets the caller walk the unscheduled queue without handing
 * every group the same slot.
 */
export function suggestOpening(
  data: AppData,
  g: Group,
  reserve?: Record<string, Record<string, number>>,
): Suggestion | null {
  if (!g.employees) return null;
  const dl = deadlineOf(data, g);
  const sp = specialistsOf(data).filter((p) => (p.capacity ?? 0) > 0);
  if (!sp.length) return null;
  const per = g.employees / 2;
  const res = reserve ?? {};
  const held = (ws: string, id: string) => (res[ws]?.[id] ?? 0);
  const today = todayIso();
  let w = sow(today);
  if (w < today) w = addDays(w, 7);
  for (let i = 0; i < 26; i++) {
    const w2 = addDays(w, 7);
    if (!dl || addDays(w, 11) <= dl) {
      const m0 = bookedByWeek(data, w);
      const m1 = bookedByWeek(data, w2);
      const fits: Array<{ p: Person; room: number }> = [];
      for (const p of sp) {
        const lim = capacityOf(p, w) * CAPACITY_CEILING;
        const r0 = lim - ((m0[p.id] ?? 0) + held(w, p.id) + per);
        const r1 = lim - ((m1[p.id] ?? 0) + held(w2, p.id) + per);
        if (r0 >= 0 && r1 >= 0) fits.push({ p, room: Math.min(r0, r1) });
      }
      if (fits.length) {
        fits.sort((a, b) => b.room - a.room);
        const pick = fits[0].p;
        if (reserve) {
          res[w] = res[w] ?? {};
          res[w][pick.id] = (res[w][pick.id] ?? 0) + per;
          res[w2] = res[w2] ?? {};
          res[w2][pick.id] = (res[w2][pick.id] ?? 0) + per;
        }
        return { week: w, spec: pick };
      }
    }
    w = addDays(w, 7);
    if (dl && w > dl) break;
  }
  return null;
}

/**
 * Re-split the group's employees across its assigned specialists. Specialists
 * with a manual share keep it; the rest divide whatever is left.
 */
export function resplitShares(employees: number, sp: GroupSpecialist[]): GroupSpecialist[] {
  const out = sp.map((a) => ({ ...a }));
  const manual = out.filter((a) => a.manual);
  const auto = out.filter((a) => !a.manual);
  const used = manual.reduce((t, a) => t + (Number(a.share) || 0), 0);
  const rest = Math.max(0, employees - used);
  if (auto.length) {
    const base = Math.floor(rest / auto.length);
    let extra = rest - base * auto.length;
    for (const a of auto) {
      a.share = base + (extra-- > 0 ? 1 : 0);
    }
  }
  return out;
}

/** Days of buffer between a group's OE end and its closeout (negative = late). */
export function bufferDays(data: AppData, g: Group): number | null {
  const dl = deadlineOf(data, g);
  if (!dl || !g.oeEnd) return null;
  return daysBetween(g.oeEnd, dl);
}
