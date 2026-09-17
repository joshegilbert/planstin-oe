/**
 * Bundled demo roster + book of business, carried over from the mockup's seed()
 * so the UI is populated before a Supabase project exists. `supabase/seed.sql`
 * inserts the same rows server-side.
 */
import type { AppData, Group, GroupSpecialist, GroupStatus, Person } from '../types';

const P = (id: string, name: string, role: Person['role'], capacity?: number): Person => ({
  id,
  name,
  role,
  capacity: capacity ?? null,
  capWeeks: {},
  accountStatus: 'active',
  // Demo mode has no real approval flow; Dana stands in as the admin so the
  // Admin screen is still browsable without a Supabase project.
  isAdmin: id === 'dana',
});

const s = (id: string, share: number, manual = false): GroupSpecialist => ({ id, share, manual });

interface Seed {
  id: string;
  name: string;
  employees: number;
  type: Group['type'];
  effective: string;
  oeStart: string;
  oeEnd: string;
  format: Group['format'];
  guideId: string;
  managerId: string;
  specialists: GroupSpecialist[];
  status: GroupStatus;
  docs: [boolean, boolean, string];
  notes?: string;
}

const SEEDS: Seed[] = [
  { id: 'g1', name: 'ESC Auto Group Inc', employees: 21, type: 'Renewal', effective: '2026-09-01', oeStart: '2026-08-03', oeEnd: '2026-08-14', format: 'Virtual', guideId: 'a', managerId: 'dana', specialists: [s('sarah', 21)], status: 'Complete', docs: [true, true, '2026-07-10'] },
  { id: 'g2', name: 'Family Resource Agency', employees: 297, type: 'Renewal', effective: '2026-09-01', oeStart: '2026-08-03', oeEnd: '2026-08-07', format: 'Hybrid', guideId: 'p', managerId: 'marcus', specialists: [s('sarah', 250, true), s('jessica', 47, true)], status: 'Complete', docs: [false, true, '2026-07-02'], notes: 'Compressed to a single week at the client’s request — Sarah is far over capacity that week.' },
  { id: 'g3', name: 'Hangar I', employees: 60, type: 'Renewal', effective: '2026-10-01', oeStart: '2026-09-02', oeEnd: '2026-09-12', format: 'In-Person', guideId: 'a', managerId: 'dana', specialists: [s('jessica', 60)], status: 'Scheduled', docs: [true, true, '2026-08-05'] },
  { id: 'g4', name: 'Green River Farming', employees: 14, type: 'Renewal', effective: '2026-10-01', oeStart: '2026-09-08', oeEnd: '2026-09-26', format: 'Virtual', guideId: 'p', managerId: 'tara', specialists: [s('mike', 14)], status: 'Complete', docs: [true, false, '2026-08-12'] },
  { id: 'g5', name: 'Boardwalk Cabinetry', employees: 45, type: 'Renewal', effective: '2026-11-01', oeStart: '2026-09-29', oeEnd: '2026-10-10', format: 'Hybrid', guideId: 'a', managerId: 'marcus', specialists: [s('luis', 45)], status: 'Scheduled', docs: [true, true, '2026-08-20'] },
  { id: 'g6', name: 'Northern Title Co', employees: 80, type: 'Renewal', effective: '2026-11-01', oeStart: '2026-10-06', oeEnd: '2026-10-17', format: 'Virtual', guideId: 'p', managerId: 'dana', specialists: [s('sarah', 80)], status: 'Scheduled', docs: [true, true, '2026-08-24'] },
  { id: 'g7', name: 'Herban Market', employees: 84, type: 'Renewal', effective: '2026-11-01', oeStart: '', oeEnd: '', format: 'Virtual', guideId: 'a', managerId: 'tara', specialists: [], status: 'Not scheduled', docs: [true, false, '2026-08-18'] },
  { id: 'g8', name: 'Andalas LLC', employees: 2, type: 'Renewal', effective: '2026-11-01', oeStart: '', oeEnd: '', format: 'Virtual', guideId: 'p', managerId: 'marcus', specialists: [], status: 'Not scheduled', docs: [false, false, ''] },
  { id: 'g9', name: 'Apex Health Group', employees: 110, type: 'Renewal', effective: '2026-12-01', oeStart: '2026-11-03', oeEnd: '2026-11-14', format: 'Virtual', guideId: 'a', managerId: 'tara', specialists: [s('mike', 55), s('jessica', 55)], status: 'Scheduled', docs: [true, true, '2026-08-26'] },
  { id: 'g10', name: 'AVS', employees: 150, type: 'New', effective: '2027-01-01', oeStart: '2026-10-05', oeEnd: '2026-10-30', format: 'Hybrid', guideId: 'p', managerId: 'dana', specialists: [s('luis', 150)], status: 'Scheduled', docs: [true, true, '2026-08-14'] },
  { id: 'g11', name: 'The Lamb’s Chapel', employees: 40, type: 'Renewal', effective: '2027-01-01', oeStart: '', oeEnd: '', format: 'Virtual', guideId: 'a', managerId: 'marcus', specialists: [], status: 'Not scheduled', docs: [true, true, '2026-08-21'] },
  { id: 'g12', name: 'PCAH Miami Beach', employees: 55, type: 'Renewal', effective: '2027-01-01', oeStart: '', oeEnd: '', format: 'In-Person', guideId: 'p', managerId: 'dana', specialists: [], status: 'Not scheduled', docs: [true, false, '2026-08-19'] },
  { id: 'g13', name: 'Salt Lake Express', employees: 200, type: 'Renewal', effective: '2027-01-01', oeStart: '', oeEnd: '', format: 'Hybrid', guideId: 'a', managerId: 'tara', specialists: [], status: 'Not scheduled', docs: [false, true, '2026-08-22'] },
];

export function demoData(): AppData {
  const people: Person[] = [
    P('a', 'Alex', 'Guide'),
    P('p', 'Priya', 'Guide'),
    P('dana', 'Dana', 'Manager'),
    P('marcus', 'Marcus', 'Manager'),
    P('tara', 'Tara', 'Manager'),
    P('sarah', 'Sarah', 'Specialist', 150),
    P('mike', 'Mike', 'Specialist', 300),
    P('jessica', 'Jessica', 'Specialist', 200),
    P('luis', 'Luis', 'Specialist', 200),
  ];

  const groups: Group[] = SEEDS.map((x) => ({
    id: x.id,
    name: x.name,
    employees: x.employees,
    type: x.type,
    effective: x.effective,
    oeStart: x.oeStart,
    oeEnd: x.oeEnd,
    format: x.format,
    guideId: x.guideId,
    managerId: x.managerId,
    specialists: x.specialists,
    status: x.status,
    // Renewals stay "No OE" until the group contact confirms; new groups get a full OE.
    oeMode: x.type === 'Renewal' ? (x.oeStart ? 'Passive' : 'None') : 'Full',
    docs: {
      asa: { done: x.docs[0], date: x.docs[0] ? x.docs[2] : '', note: '' },
      census: { done: x.docs[1], date: x.docs[1] ? x.docs[2] : '', note: '' },
    },
    oeGuide: { complete: false, by: '', at: 0 },
    notes: x.notes ?? '',
    info: {},
    tool: {},
    timeline: {},
    planRows: {},
    classes: [{ id: 'c1', name: 'All employees' }],
    contrib: {},
    contribMode: '$',
    weekLoad: {},
    editedBy: '',
    editedAt: 0,
  }));

  // Herban Market is queued for a renewal OE even though it has no dates yet.
  groups[6].oeMode = 'Passive';
  groups[8].oeGuide = { complete: true, by: 'Dana', at: Date.now() };

  return {
    people,
    groups,
    closeouts: { 1: null, 2: 22, 3: 22, 4: 19, 5: 24, 6: 21, 7: 26, 8: 23, 9: 20, 10: 25, 11: 22, 12: 20 },
    updatedAt: Date.now(),
  };
}

/** Fill in any collections a persisted/loaded payload might be missing. */
export function normalize(d: AppData): AppData {
  for (const g of d.groups) {
    if (!g.oeMode) g.oeMode = 'Full';
    if (!g.info) g.info = {};
    if (!g.tool) g.tool = {};
    if (!g.timeline) g.timeline = {};
    if (!g.planRows) g.planRows = {};
    if (!g.classes || !g.classes.length) g.classes = [{ id: 'c1', name: 'All employees' }];
    if (!g.contrib) g.contrib = {};
    if (!g.weekLoad) g.weekLoad = {};
    if (!g.contribMode) g.contribMode = '$';
    if (!g.specialists) g.specialists = [];
    if (!g.docs) {
      g.docs = {
        asa: { done: false, date: '', note: '' },
        census: { done: false, date: '', note: '' },
      };
    }
    if (!g.oeGuide) g.oeGuide = { complete: false, by: '', at: 0 };
  }
  for (const p of d.people) {
    if (!p.capWeeks) p.capWeeks = {};
    if (!p.accountStatus) p.accountStatus = 'active';
    if (p.isAdmin === undefined) p.isAdmin = false;
  }
  if (!d.closeouts) d.closeouts = {};
  return d;
}
