import {
  createContext,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import type { BarDrag, CalendarView, GroupFilters, SortState } from '../types';
import { sow, todayIso } from '../lib/dates';

export interface Anchored {
  x: number;
  y: number;
  ay: number;
}

export interface BookingPopState extends Anchored {
  gid: string;
}

export interface CapacityPopState extends Anchored {
  pid: string;
  ws: string;
}

export interface SchedState {
  gid: string;
  len: number;
  start: string | null;
}

export interface DraftState {
  name: string;
  employees: string;
  type: 'New' | 'Renewal';
  effective: string;
  format: 'Virtual' | 'In-Person' | 'Hybrid';
  managerId: string;
  guideId: string;
  /** Seeds SchedState.start once the group is created; not persisted. */
  prefillStart?: string | null;
}

export type DetailTab = 'details' | 'guide' | 'plans' | 'contrib';

interface UiContextValue {
  view: CalendarView;
  setView: Dispatch<SetStateAction<CalendarView>>;
  anchor: string;
  setAnchor: Dispatch<SetStateAction<string>>;
  boardAnchor: string;
  setBoardAnchor: Dispatch<SetStateAction<string>>;
  lanes: boolean;
  setLanes: Dispatch<SetStateAction<boolean>>;
  hidden: Record<string, boolean>;
  setHidden: Dispatch<SetStateAction<Record<string, boolean>>>;
  search: string;
  setSearch: Dispatch<SetStateAction<string>>;
  sort: SortState;
  setSort: Dispatch<SetStateAction<SortState>>;
  filters: GroupFilters;
  setFilters: Dispatch<SetStateAction<GroupFilters>>;
  barDrag: BarDrag | null;
  setBarDrag: Dispatch<SetStateAction<BarDrag | null>>;
  dragChip: string | null;
  setDragChip: Dispatch<SetStateAction<string | null>>;
  dropIso: string | null;
  setDropIso: Dispatch<SetStateAction<string | null>>;
  pop: BookingPopState | null;
  setPop: Dispatch<SetStateAction<BookingPopState | null>>;
  capPop: CapacityPopState | null;
  setCapPop: Dispatch<SetStateAction<CapacityPopState | null>>;
  sched: SchedState | null;
  setSched: Dispatch<SetStateAction<SchedState | null>>;
  draft: DraftState | null;
  setDraft: Dispatch<SetStateAction<DraftState | null>>;
  detailTab: DetailTab;
  setDetailTab: Dispatch<SetStateAction<DetailTab>>;
  onlyOffered: boolean;
  setOnlyOffered: Dispatch<SetStateAction<boolean>>;
}

export const EMPTY_FILTERS: GroupFilters = {
  manager: '',
  specialist: '',
  month: '',
  status: '',
  state: '',
  agent: '',
  bucket: '',
  mine: false,
};

const UiContext = createContext<UiContextValue | null>(null);

export function UiProvider({ children }: { children: ReactNode }) {
  const thisWeek = sow(todayIso());
  const [view, setView] = useState<CalendarView>('month');
  const [anchor, setAnchor] = useState(thisWeek);
  const [boardAnchor, setBoardAnchor] = useState(thisWeek);
  const [lanes, setLanes] = useState(false);
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortState>({ k: 'eff', d: 1 });
  const [filters, setFilters] = useState<GroupFilters>(EMPTY_FILTERS);
  const [barDrag, setBarDrag] = useState<BarDrag | null>(null);
  const [dragChip, setDragChip] = useState<string | null>(null);
  const [dropIso, setDropIso] = useState<string | null>(null);
  const [pop, setPop] = useState<BookingPopState | null>(null);
  const [capPop, setCapPop] = useState<CapacityPopState | null>(null);
  const [sched, setSched] = useState<SchedState | null>(null);
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('details');
  const [onlyOffered, setOnlyOffered] = useState(true);

  const value = useMemo<UiContextValue>(
    () => ({
      view, setView, anchor, setAnchor, boardAnchor, setBoardAnchor,
      lanes, setLanes, hidden, setHidden, search, setSearch, sort, setSort,
      filters, setFilters, barDrag, setBarDrag, dragChip, setDragChip,
      dropIso, setDropIso, pop, setPop, capPop, setCapPop, sched, setSched,
      draft, setDraft, detailTab, setDetailTab, onlyOffered, setOnlyOffered,
    }),
    [
      view, anchor, boardAnchor, lanes, hidden, search, sort, filters,
      barDrag, dragChip, dropIso, pop, capPop, sched, draft, detailTab, onlyOffered,
    ],
  );

  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

export function useUi(): UiContextValue {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error('useUi must be used inside <UiProvider>');
  return ctx;
}
