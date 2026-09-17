import type { Group } from '../types';
import { resplitShares } from './capacity';

export type PatchGroup = (id: string, patch: Partial<Group>) => void;

/** Add or remove a specialist from a group, re-splitting the employee shares. */
export function toggleSpecialist(g: Group, pid: string, patch: PatchGroup): void {
  const sp = g.specialists.slice();
  const i = sp.findIndex((a) => a.id === pid);
  if (i >= 0) sp.splice(i, 1);
  else sp.push({ id: pid, share: 0, manual: false });
  patch(g.id, { specialists: resplitShares(g.employees, sp) });
}

/** Pin one specialist's share; everyone else re-splits around it. */
export function setSpecialistShare(g: Group, pid: string, value: string, patch: PatchGroup): void {
  const sp = g.specialists.map((a) =>
    a.id === pid ? { id: a.id, share: Number(value) || 0, manual: true } : { ...a },
  );
  patch(g.id, { specialists: resplitShares(g.employees, sp) });
}

/** Changing the headcount re-splits the auto shares. */
export function setEmployeeCount(g: Group, value: string, patch: PatchGroup): void {
  const employees = Number(value) || 0;
  patch(g.id, {
    employees,
    specialists: resplitShares(employees, g.specialists.map((a) => ({ ...a }))),
  });
}
