import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AppData, Group, Person } from '../types';
import { SUPABASE_ENABLED } from '../lib/supabase';
import { demoData, normalize } from './demoData';
import {
  deletePerson as repoDeletePerson,
  insertGroup as repoInsertGroup,
  loadAppData,
  saveCapacityOverride,
  saveCloseout,
  saveGroup,
  savePerson,
} from './repository';
import { useAuth } from '../auth/AuthProvider';

const DEMO_STORE_KEY = 'planstin-oe-v2';
export const APP_DATA_KEY = ['app-data'] as const;

function readDemo(): AppData {
  try {
    const raw = localStorage.getItem(DEMO_STORE_KEY);
    if (raw) return normalize(JSON.parse(raw) as AppData);
  } catch {
    /* fall through to a fresh seed */
  }
  const seeded = demoData();
  writeDemo(seeded);
  return seeded;
}

function writeDemo(d: AppData) {
  try {
    localStorage.setItem(DEMO_STORE_KEY, JSON.stringify(d));
  } catch {
    /* ignore quota / private-mode failures */
  }
}

interface DataContextValue {
  data: AppData;
  loading: boolean;
  error: Error | null;
  /** The roster row for the signed-in account, if one is linked. */
  me: Person | null;
  meName: string;
  patchGroup: (id: string, patch: Partial<Group>) => void;
  addGroup: (group: Group) => void;
  patchPerson: (id: string, patch: Partial<Person>) => void;
  addPerson: (person: Person) => void;
  removePerson: (id: string) => void;
  setCapacityOverride: (specialistId: string, weekStart: string, value: string) => void;
  setCloseout: (month: number, day: number | null) => void;
}

const DataContext = createContext<DataContextValue | null>(null);

const EMPTY: AppData = { people: [], groups: [], closeouts: {}, updatedAt: 0 };

export function DataProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { user } = useAuth();

  const query = useQuery({
    queryKey: APP_DATA_KEY,
    queryFn: async (): Promise<AppData> => (SUPABASE_ENABLED ? loadAppData() : readDemo()),
    // In Supabase mode, don't fetch until there's a session: firing this before
    // sign-in runs as the unauthenticated 'anon' role, RLS returns zero rows,
    // and — since window-focus refetch is off — that empty result would stay
    // cached (staleTime) even after the user signs in, wrongly showing them as
    // having no roster row.
    enabled: !SUPABASE_ENABLED || !!user,
    staleTime: 30_000,
  });

  const data = query.data ?? EMPTY;

  const me = useMemo<Person | null>(() => {
    if (!user) return null;
    const linked = data.people.find((p) => p.userId === user.id);
    if (linked) return linked;
    if (SUPABASE_ENABLED) return null;
    // Demo mode: match the local part of the email to a roster name so signing
    // in as dana@… lands you on Dana's view.
    const local = user.email.split('@')[0].toLowerCase();
    return (
      data.people.find((p) => p.name.toLowerCase() === local) ??
      data.people.find((p) => p.role === 'Manager') ??
      data.people[0] ??
      null
    );
  }, [user, data.people]);

  /** Apply a change to the cache immediately, then persist it. */
  const persist = useMutation({
    mutationFn: async (job: () => Promise<void>) => job(),
    onError: (err) => {
      console.error('[Planstin OE] write failed', err);
      qc.invalidateQueries({ queryKey: APP_DATA_KEY });
    },
  });

  const apply = useCallback(
    (next: AppData, job?: (prev: AppData) => Promise<void>) => {
      const prev = qc.getQueryData<AppData>(APP_DATA_KEY) ?? EMPTY;
      qc.setQueryData(APP_DATA_KEY, next);
      if (SUPABASE_ENABLED) {
        if (job) persist.mutate(() => job(prev));
      } else {
        writeDemo(next);
      }
    },
    [qc, persist],
  );

  const meName = me?.name ?? '';

  const patchGroup = useCallback(
    (id: string, patch: Partial<Group>) => {
      const current = qc.getQueryData<AppData>(APP_DATA_KEY) ?? EMPTY;
      const groups = current.groups.map((g) =>
        g.id === id ? { ...g, ...patch, editedBy: meName, editedAt: Date.now() } : g,
      );
      const next = { ...current, groups, updatedAt: Date.now() };
      apply(next, async (prev) => {
        const before = prev.groups.find((g) => g.id === id);
        const after = groups.find((g) => g.id === id);
        if (after) await saveGroup(before, after);
      });
    },
    [qc, apply, meName],
  );

  const addGroup = useCallback(
    (group: Group) => {
      const current = qc.getQueryData<AppData>(APP_DATA_KEY) ?? EMPTY;
      const next = { ...current, groups: [...current.groups, group], updatedAt: Date.now() };
      apply(next, async () => {
        await repoInsertGroup(group);
      });
    },
    [qc, apply],
  );

  const patchPerson = useCallback(
    (id: string, patch: Partial<Person>) => {
      const current = qc.getQueryData<AppData>(APP_DATA_KEY) ?? EMPTY;
      const people = current.people.map((p) => (p.id === id ? { ...p, ...patch } : p));
      const next = { ...current, people, updatedAt: Date.now() };
      apply(next, async () => {
        const after = people.find((p) => p.id === id);
        if (after) await savePerson(after);
      });
    },
    [qc, apply],
  );

  const addPerson = useCallback(
    (person: Person) => {
      const current = qc.getQueryData<AppData>(APP_DATA_KEY) ?? EMPTY;
      const next = { ...current, people: [...current.people, person], updatedAt: Date.now() };
      apply(next, async () => {
        await savePerson(person);
      });
    },
    [qc, apply],
  );

  const removePerson = useCallback(
    (id: string) => {
      const current = qc.getQueryData<AppData>(APP_DATA_KEY) ?? EMPTY;
      const next = {
        ...current,
        people: current.people.filter((p) => p.id !== id),
        updatedAt: Date.now(),
      };
      apply(next, async () => {
        await repoDeletePerson(id);
      });
    },
    [qc, apply],
  );

  const setCapacityOverride = useCallback(
    (specialistId: string, weekStart: string, value: string) => {
      const current = qc.getQueryData<AppData>(APP_DATA_KEY) ?? EMPTY;
      const people = current.people.map((p) => {
        if (p.id !== specialistId) return p;
        const capWeeks = { ...(p.capWeeks ?? {}) };
        if (value === '') delete capWeeks[weekStart];
        else capWeeks[weekStart] = value;
        return { ...p, capWeeks };
      });
      apply({ ...current, people, updatedAt: Date.now() }, async () => {
        const n = value === '' ? null : Number(value);
        await saveCapacityOverride(
          specialistId,
          weekStart,
          n === null || Number.isNaN(n) ? null : n,
        );
      });
    },
    [qc, apply],
  );

  const setCloseoutValue = useCallback(
    (month: number, day: number | null) => {
      const current = qc.getQueryData<AppData>(APP_DATA_KEY) ?? EMPTY;
      const next = {
        ...current,
        closeouts: { ...current.closeouts, [month]: day },
        updatedAt: Date.now(),
      };
      apply(next, async () => {
        await saveCloseout(month, day);
      });
    },
    [qc, apply],
  );

  const value = useMemo<DataContextValue>(
    () => ({
      data,
      // isPending (not isLoading) so this stays true while the query is
      // disabled pre-sign-in too, not just while actively fetching — avoids a
      // one-frame flash of "no data" once enabled flips true.
      loading: query.isPending,
      error: (query.error as Error | null) ?? null,
      me,
      meName,
      patchGroup,
      addGroup,
      patchPerson,
      addPerson,
      removePerson,
      setCapacityOverride,
      setCloseout: setCloseoutValue,
    }),
    [
      data, query.isPending, query.error, me, meName, patchGroup, addGroup,
      patchPerson, addPerson, removePerson, setCapacityOverride, setCloseoutValue,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside <DataProvider>');
  return ctx;
}
