export type Role = 'Guide' | 'Manager' | 'Specialist' | 'Employee';
export type AccountStatus = 'pending' | 'active' | 'rejected';
export type GroupType = 'New' | 'Renewal';
export type OeFormat = 'Virtual' | 'In-Person' | 'Hybrid';
export type OeMode = 'Full' | 'Passive' | 'None';
export type GroupStatus = 'Not scheduled' | 'Scheduled' | 'In progress' | 'Complete';
export type ContribMode = '$' | '%';
export type Tier = 'EE' | 'ES' | 'EC' | 'EF';

/** A member of the Planstin team. Benefit specialists carry a weekly capacity. */
export interface Person {
  id: string;
  /** Supabase auth.users id, when this roster row is claimed by a real account. */
  userId?: string | null;
  email?: string | null;
  name: string;
  /** Null until an admin approves the account and assigns one of the three roles. */
  role: Role | null;
  capacity: number | null;
  /** Per-week capacity overrides, keyed by ISO week-start date. */
  capWeeks?: Record<string, string | number>;
  accountStatus: AccountStatus;
  /** Permission flag, independent of `role` — can approve/reject accounts and assign roles. */
  isAdmin: boolean;
}

export interface GroupSpecialist {
  id: string;
  share: number;
  manual: boolean;
}

export interface DocRecord {
  done: boolean;
  date: string;
  note: string;
}

export interface EmployeeClass {
  id: string;
  name: string;
}

export interface ToolItem {
  done: boolean;
  note: string;
}

export interface TimelineItem {
  done: boolean;
  date: string;
}

export interface PlanRow {
  offering?: boolean;
  rates?: Partial<Record<Tier, string>>;
  version?: string;
  rx?: string;
}

export interface OeGuide {
  complete: boolean;
  by: string;
  at: number;
}

/** contrib[planName][employeeClassId][tier] = raw string value */
export type Contributions = Record<string, Record<string, Partial<Record<Tier, string>>>>;

export interface Group {
  id: string;
  name: string;
  employees: number;
  type: GroupType;
  effective: string;
  oeStart: string;
  oeEnd: string;
  format: OeFormat;
  guideId: string;
  managerId: string;
  specialists: GroupSpecialist[];
  status: GroupStatus;
  oeMode: OeMode;
  docs: { asa: DocRecord; census: DocRecord };
  oeGuide: OeGuide;
  notes: string;
  info: Record<string, string>;
  tool: Record<string, ToolItem>;
  timeline: Record<string, TimelineItem>;
  planRows: Record<string, PlanRow>;
  classes: EmployeeClass[];
  contrib: Contributions;
  contribMode: ContribMode;
  /** Per-week employee effort overrides, keyed by ISO week-start date. */
  weekLoad: Record<string, string | number>;
  editedBy: string;
  editedAt: number;
}

export interface AppData {
  people: Person[];
  groups: Group[];
  /** Month number (1-12) -> day of month the eNav portal closes out. */
  closeouts: Record<number, number | null>;
  updatedAt: number;
}

export type CalendarView = 'week' | '2week' | 'month';

export interface GroupFilters {
  manager: string;
  specialist: string;
  month: string;
  status: string;
  bucket: string;
  mine: boolean;
}

export interface SortState {
  k: string;
  d: 1 | -1;
}

export interface BarDrag {
  gid: string;
  mode: 'move' | 'start' | 'end';
  delta: number;
}
