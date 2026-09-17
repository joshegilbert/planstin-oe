/**
 * Supabase <-> app-model mapping.
 *
 * The UI works on one denormalised `AppData` object (people, groups, closeouts)
 * because every screen cross-references the whole book of business. This module
 * assembles that object out of the normalised tables and writes changes back,
 * diffing a group against its previous version so only touched child rows move.
 */
import type {
  AppData,
  Contributions,
  Group,
  GroupStatus,
  Person,
  Role,
  Tier,
} from '../types';
import { supabase } from '../lib/supabase';
import { normalize } from './demoData';

function db() {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}

const numOrNull = (v: unknown): number | null => {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
};

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function loadAppData(): Promise<AppData> {
  const c = db();
  const [
    specialists,
    capacity,
    groups,
    classes,
    groupSpecs,
    bookings,
    weekLoads,
    documents,
    toolItems,
    timelineItems,
    planOptions,
    contribPlans,
    contribTiers,
    closeouts,
  ] = await Promise.all([
    c.from('specialists').select('*').order('sort_order'),
    c.from('specialist_capacity').select('*'),
    c.from('groups').select('*').order('effective_date', { nullsFirst: false }),
    c.from('employee_classes').select('*').order('sort_order'),
    c.from('group_specialists').select('*'),
    c.from('bookings').select('*'),
    c.from('booking_week_loads').select('*'),
    c.from('documents').select('*'),
    c.from('guide_tool_items').select('*').order('sort_order'),
    c.from('guide_timeline_items').select('*').order('sort_order'),
    c.from('plan_options').select('*').order('sort_order'),
    c.from('contribution_plans').select('*'),
    c.from('contribution_tiers').select('*'),
    c.from('enav_closeouts').select('*'),
  ]);

  for (const r of [
    specialists, capacity, groups, classes, groupSpecs, bookings, weekLoads,
    documents, toolItems, timelineItems, planOptions, contribPlans, contribTiers, closeouts,
  ]) {
    if (r.error) throw r.error;
  }

  const capByPerson: Record<string, Record<string, number>> = {};
  for (const row of capacity.data ?? []) {
    (capByPerson[row.specialist_id] ??= {})[row.week_start] = row.capacity;
  }

  const people: Person[] = (specialists.data ?? []).map((r) => ({
    id: r.id,
    userId: r.user_id,
    email: r.email,
    name: r.name,
    role: r.role,
    capacity: r.weekly_capacity,
    capWeeks: capByPerson[r.id] ?? {},
    accountStatus: r.account_status,
    isAdmin: r.is_admin,
  }));

  const bookingByGroup: Record<string, { id: string; start: string; end: string; status: string }> = {};
  for (const b of bookings.data ?? []) {
    bookingByGroup[b.group_id] = {
      id: b.id,
      start: b.start_date,
      end: b.end_date,
      status: b.status,
    };
  }
  const loadsByBooking: Record<string, Record<string, number>> = {};
  for (const w of weekLoads.data ?? []) {
    (loadsByBooking[w.booking_id] ??= {})[w.week_start] = Number(w.employees);
  }
  const contribPlanById: Record<string, { groupId: string; plan: string }> = {};
  for (const p of contribPlans.data ?? []) {
    contribPlanById[p.id] = { groupId: p.group_id, plan: p.plan_name };
  }
  const contribByGroup: Record<string, Contributions> = {};
  for (const t of contribTiers.data ?? []) {
    const meta = contribPlanById[t.contribution_plan_id];
    if (!meta) continue;
    const byGroup = (contribByGroup[meta.groupId] ??= {});
    const byPlan = (byGroup[meta.plan] ??= {});
    const byClass = (byPlan[t.employee_class_id] ??= {});
    byClass[t.tier as Tier] = t.value === null ? '' : String(t.value);
  }

  const result: Group[] = (groups.data ?? []).map((g) => {
    const booking = bookingByGroup[g.id];
    const docs = (documents.data ?? []).filter((d) => d.group_id === g.id);
    const asa = docs.find((d) => d.doc_key === 'asa');
    const census = docs.find((d) => d.doc_key === 'census');
    const group: Group = {
      id: g.id,
      name: g.name,
      employees: g.employees ?? 0,
      type: g.group_type,
      effective: str(g.effective_date),
      oeStart: booking?.start ?? '',
      oeEnd: booking?.end ?? '',
      enrollments: g.enrollments ?? null,
      state: str(g.state),
      agent: str(g.agent),
      originalEffective: str(g.original_effective_date),
      format: g.oe_format,
      guideId: str(g.guide_id),
      managerId: str(g.manager_id),
      specialists: (groupSpecs.data ?? [])
        .filter((s) => s.group_id === g.id)
        .map((s) => ({
          id: s.specialist_id,
          share: s.employee_share ?? 0,
          manual: !!s.manual_override,
        })),
      status: (booking?.status ?? g.status) as GroupStatus,
      oeMode: g.oe_mode,
      docs: {
        asa: { done: !!asa?.done, date: str(asa?.doc_date), note: str(asa?.note) },
        census: { done: !!census?.done, date: str(census?.doc_date), note: str(census?.note) },
      },
      oeGuide: {
        complete: !!g.guide_complete,
        by: str(g.guide_completed_by),
        at: g.guide_completed_at ? new Date(g.guide_completed_at).getTime() : 0,
      },
      notes: str(g.notes),
      info: (g.info ?? {}) as Record<string, string>,
      tool: {},
      timeline: {},
      planRows: {},
      classes: (classes.data ?? [])
        .filter((cl) => cl.group_id === g.id)
        .map((cl) => ({ id: cl.id, name: str(cl.name) })),
      contrib: contribByGroup[g.id] ?? {},
      contribMode: g.contrib_mode,
      weekLoad: booking ? loadsByBooking[booking.id] ?? {} : {},
      editedBy: str(g.edited_by),
      editedAt: g.edited_at ? new Date(g.edited_at).getTime() : 0,
    };
    for (const t of toolItems.data ?? []) {
      if (t.group_id === g.id) group.tool[t.label] = { done: !!t.done, note: str(t.note) };
    }
    for (const t of timelineItems.data ?? []) {
      if (t.group_id === g.id) group.timeline[t.label] = { done: !!t.done, date: str(t.item_date) };
    }
    for (const p of planOptions.data ?? []) {
      if (p.group_id === g.id) {
        const rates: Partial<Record<Tier, string>> = {};
        for (const [col, tier] of [
          ['rate_ee', 'EE'],
          ['rate_es', 'ES'],
          ['rate_ec', 'EC'],
          ['rate_ef', 'EF'],
        ] as const) {
          if (p[col] !== null) rates[tier] = String(p[col]);
        }
        group.planRows[p.plan_name] = {
          offering: !!p.offered,
          rates,
          version: str(p.version),
          rx: str(p.rx_version),
        };
      }
    }
    return group;
  });

  const closeoutMap: Record<number, number | null> = {};
  for (const r of closeouts.data ?? []) closeoutMap[r.month] = r.closeout_day;

  return normalize({ people, groups: result, closeouts: closeoutMap, updatedAt: Date.now() });
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Persist a group, writing only the child collections that actually changed. */
export async function saveGroup(prev: Group | undefined, next: Group): Promise<void> {
  const c = db();

  const core = {
    name: next.name,
    employees: next.employees,
    enrollments: next.enrollments ?? null,
    state: next.state || null,
    agent: next.agent || null,
    group_type: next.type,
    effective_date: next.effective || null,
    original_effective_date: next.originalEffective || null,
    oe_format: next.format,
    oe_mode: next.oeMode,
    status: next.status,
    guide_id: next.guideId || null,
    manager_id: next.managerId || null,
    notes: next.notes,
    info: next.info,
    contrib_mode: next.contribMode,
    guide_complete: next.oeGuide.complete,
    guide_completed_by: next.oeGuide.by,
    guide_completed_at: next.oeGuide.at ? new Date(next.oeGuide.at).toISOString() : null,
    edited_by: next.editedBy,
    edited_at: next.editedAt ? new Date(next.editedAt).toISOString() : null,
  };
  const coreChanged =
    !prev ||
    !same(
      [prev.name, prev.employees, prev.type, prev.effective, prev.format, prev.oeMode,
        prev.status, prev.guideId, prev.managerId, prev.notes, prev.info, prev.contribMode,
        prev.oeGuide, prev.editedBy, prev.editedAt,
        prev.enrollments, prev.state, prev.agent, prev.originalEffective],
      [next.name, next.employees, next.type, next.effective, next.format, next.oeMode,
        next.status, next.guideId, next.managerId, next.notes, next.info, next.contribMode,
        next.oeGuide, next.editedBy, next.editedAt,
        next.enrollments, next.state, next.agent, next.originalEffective],
    );
  if (coreChanged) {
    const { error } = await c.from('groups').update(core).eq('id', next.id);
    if (error) throw error;
  }

  // --- booking (the calendar bar) -----------------------------------------
  if (!prev || prev.oeStart !== next.oeStart || prev.oeEnd !== next.oeEnd || prev.status !== next.status) {
    if (next.oeStart && next.oeEnd) {
      const lead = next.specialists[0]?.id ?? null;
      const { error } = await c
        .from('bookings')
        .upsert(
          {
            group_id: next.id,
            specialist_id: lead,
            start_date: next.oeStart,
            end_date: next.oeEnd,
            status: next.status,
          },
          { onConflict: 'group_id' },
        );
      if (error) throw error;
    } else {
      const { error } = await c.from('bookings').delete().eq('group_id', next.id);
      if (error) throw error;
    }
  }

  if (!same(prev?.weekLoad, next.weekLoad)) {
    const { data: booking } = await c
      .from('bookings')
      .select('id')
      .eq('group_id', next.id)
      .maybeSingle();
    if (booking) {
      await c.from('booking_week_loads').delete().eq('booking_id', booking.id);
      const rows = Object.entries(next.weekLoad)
        .filter(([, v]) => v !== '' && v !== null && v !== undefined)
        .map(([week_start, employees]) => ({
          booking_id: booking.id,
          week_start,
          employees: Number(employees) || 0,
        }));
      if (rows.length) {
        const { error } = await c.from('booking_week_loads').insert(rows);
        if (error) throw error;
      }
    }
  }

  // --- assigned specialists / shares ---------------------------------------
  if (!same(prev?.specialists, next.specialists)) {
    await c.from('group_specialists').delete().eq('group_id', next.id);
    if (next.specialists.length) {
      const { error } = await c.from('group_specialists').insert(
        next.specialists.map((s) => ({
          group_id: next.id,
          specialist_id: s.id,
          employee_share: Number(s.share) || 0,
          manual_override: s.manual,
        })),
      );
      if (error) throw error;
    }
  }

  // --- employee classes -----------------------------------------------------
  if (!same(prev?.classes, next.classes)) {
    const removed = (prev?.classes ?? []).filter((p) => !next.classes.some((n) => n.id === p.id));
    for (const r of removed) {
      const { error } = await c.from('employee_classes').delete().eq('id', r.id);
      if (error) throw error;
    }
    if (next.classes.length) {
      const { error } = await c.from('employee_classes').upsert(
        next.classes.map((cl, i) => ({ id: cl.id, group_id: next.id, name: cl.name, sort_order: i })),
        { onConflict: 'id' },
      );
      if (error) throw error;
    }
  }

  // --- documents ------------------------------------------------------------
  for (const key of ['asa', 'census'] as const) {
    if (same(prev?.docs?.[key], next.docs[key])) continue;
    const d = next.docs[key];
    const { error } = await c.from('documents').upsert(
      {
        group_id: next.id,
        doc_key: key,
        label: key === 'asa' ? 'ASA' : 'Census',
        done: d.done,
        doc_date: d.date || null,
        note: d.note,
        tag: d.done ? 'Received' : 'Outstanding',
        sort_order: key === 'asa' ? 0 : 1,
      },
      { onConflict: 'group_id,doc_key' },
    );
    if (error) throw error;
  }

  // --- enrollment guide checklists -----------------------------------------
  for (const [label, item] of Object.entries(next.tool)) {
    if (same(prev?.tool?.[label], item)) continue;
    const { error } = await c.from('guide_tool_items').upsert(
      { group_id: next.id, label, done: item.done, note: item.note },
      { onConflict: 'group_id,label' },
    );
    if (error) throw error;
  }
  for (const [label, item] of Object.entries(next.timeline)) {
    if (same(prev?.timeline?.[label], item)) continue;
    const { error } = await c.from('guide_timeline_items').upsert(
      { group_id: next.id, label, done: item.done, item_date: item.date || null },
      { onConflict: 'group_id,label' },
    );
    if (error) throw error;
  }

  // --- plan options ---------------------------------------------------------
  for (const [plan, row] of Object.entries(next.planRows)) {
    if (same(prev?.planRows?.[plan], row)) continue;
    const { error } = await c.from('plan_options').upsert(
      {
        group_id: next.id,
        plan_name: plan,
        offered: !!row.offering,
        rate_ee: numOrNull(row.rates?.EE),
        rate_es: numOrNull(row.rates?.ES),
        rate_ec: numOrNull(row.rates?.EC),
        rate_ef: numOrNull(row.rates?.EF),
        version: row.version ?? '',
        rx_version: row.rx ?? '',
      },
      { onConflict: 'group_id,plan_name' },
    );
    if (error) throw error;
  }

  // --- contributions --------------------------------------------------------
  if (!same(prev?.contrib, next.contrib)) {
    for (const [plan, byClass] of Object.entries(next.contrib)) {
      if (same(prev?.contrib?.[plan], byClass)) continue;
      const { data: cp, error: cpErr } = await c
        .from('contribution_plans')
        .upsert({ group_id: next.id, plan_name: plan }, { onConflict: 'group_id,plan_name' })
        .select('id')
        .single();
      if (cpErr) throw cpErr;
      for (const [classId, tiers] of Object.entries(byClass)) {
        for (const [tier, value] of Object.entries(tiers)) {
          const { error } = await c.from('contribution_tiers').upsert(
            {
              contribution_plan_id: cp.id,
              employee_class_id: classId,
              tier,
              value: numOrNull(value),
            },
            { onConflict: 'contribution_plan_id,employee_class_id,tier' },
          );
          if (error) throw error;
        }
      }
    }
  }
}

export async function insertGroup(g: Group): Promise<void> {
  const c = db();
  const { error } = await c.from('groups').insert({
    id: g.id,
    name: g.name,
    employees: g.employees,
    group_type: g.type,
    effective_date: g.effective || null,
    oe_format: g.format,
    oe_mode: g.oeMode,
    status: g.status,
    guide_id: g.guideId || null,
    manager_id: g.managerId || null,
    notes: g.notes,
    info: g.info,
    contrib_mode: g.contribMode,
    edited_by: g.editedBy,
    edited_at: g.editedAt ? new Date(g.editedAt).toISOString() : null,
  });
  if (error) throw error;
  for (const [i, cl] of g.classes.entries()) {
    await c.from('employee_classes').insert({ id: cl.id, group_id: g.id, name: cl.name, sort_order: i });
  }
  await saveGroup(undefined, g);
}

export async function savePerson(p: Person): Promise<void> {
  const c = db();
  const { error } = await c
    .from('specialists')
    .upsert({
      id: p.id,
      name: p.name,
      role: p.role,
      weekly_capacity: p.capacity,
    })
    .eq('id', p.id);
  if (error) throw error;
}

export async function deletePerson(id: string): Promise<void> {
  const { error } = await db().from('specialists').delete().eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Admin: approve / reject sign-ups, change role or admin flag. RLS + the
// specialists_protect_admin_fields trigger reject these for non-admins.
// ---------------------------------------------------------------------------

export async function approveSpecialist(id: string, role: Role): Promise<void> {
  const { error } = await db()
    .from('specialists')
    .update({ role, account_status: 'active' })
    .eq('id', id);
  if (error) throw error;
}

export async function rejectSpecialist(id: string): Promise<void> {
  const { error } = await db()
    .from('specialists')
    .update({ account_status: 'rejected' })
    .eq('id', id);
  if (error) throw error;
}

export async function setSpecialistRole(id: string, role: Role): Promise<void> {
  const { error } = await db().from('specialists').update({ role }).eq('id', id);
  if (error) throw error;
}

export async function setSpecialistAdmin(id: string, isAdmin: boolean): Promise<void> {
  const { error } = await db().from('specialists').update({ is_admin: isAdmin }).eq('id', id);
  if (error) throw error;
}

export async function saveCapacityOverride(
  specialistId: string,
  weekStart: string,
  capacity: number | null,
): Promise<void> {
  const c = db();
  if (capacity === null) {
    const { error } = await c
      .from('specialist_capacity')
      .delete()
      .eq('specialist_id', specialistId)
      .eq('week_start', weekStart);
    if (error) throw error;
    return;
  }
  const { error } = await c.from('specialist_capacity').upsert(
    { specialist_id: specialistId, week_start: weekStart, capacity },
    { onConflict: 'specialist_id,week_start' },
  );
  if (error) throw error;
}

export async function saveCloseout(month: number, day: number | null): Promise<void> {
  const { error } = await db()
    .from('enav_closeouts')
    .upsert({ month, closeout_day: day }, { onConflict: 'month' });
  if (error) throw error;
}
