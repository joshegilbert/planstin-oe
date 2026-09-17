// Turn the book-of-business export into supabase/seed_real.sql.
//
// Usage:
//   node scripts/build-seed.mjs [path/to/export.csv]
//
// Pure text generation — no network, no database. Read the generated SQL before
// running it through scripts/run-sql.mjs.
//
// What it produces, in order:
//   1. deletes that clear every demo row but keep enav_closeouts and any
//      specialists row that has claimed a real login (user_id is not null)
//   2. the roster: one specialists row per Benefit Manager / Benefit Specialist
//   3. the groups, with effective_date rolled to the next renewal
//   4. group_specialists links, one per group that has a specialist
//   5. an 'All employees' employee_classes row per group
//   6. empty ASA / Census documents rows per group
//
// Rows 2-4 are keyed by EMAIL and GROUP NAME rather than by hard-coded uuids
// for people, because joshgilbert@planstin.com may already exist with a login
// and must keep its id, user_id, is_admin and account_status.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname } from 'node:path';

const SRC = process.argv[2] || new URL('../supabase/data/book-of-business.csv', import.meta.url).pathname;
const OUT = new URL('../supabase/seed_real.sql', import.meta.url).pathname;

const EMAIL_DOMAIN = 'planstin.com';
/** Matches SPECIALIST_PALETTE in src/lib/constants.ts. */
const PALETTE = ['#0072B2', '#E69F00', '#009E73', '#CC79A7', '#56B4E9', '#D55E00'];
/** Demo default; tune per person once the capacity board has real bars on it. */
const WEEKLY_CAPACITY = 200;

const MONTHS = {
  January: 1, February: 2, March: 3, April: 4, May: 5, June: 6,
  July: 7, August: 8, September: 9, October: 10, November: 11, December: 12,
};

// --- helpers ----------------------------------------------------------------

/** RFC4180-ish parser: handles quoted fields, embedded commas and "" escapes. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else { quoted = false; }
      } else field += c;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((f) => f !== ''));
}

/** Collapse runs of whitespace — the export has "Alexander  Spencer" (2 spaces). */
const tidy = (s) => (s ?? '').replace(/\s+/g, ' ').trim();

/** "Crystal Jessop" -> "crystaljessop@planstin.com" (matches joshgilbert@). */
const emailFor = (name) =>
  `${tidy(name).toLowerCase().replace(/[^a-z]/g, '')}@${EMAIL_DOMAIN}`;

/** Deterministic uuid from a string, so re-running yields an identical file. */
function uuidFor(ns, key) {
  const h = createHash('sha1').update(`${ns}:${key}`).digest();
  const b = Buffer.from(h.subarray(0, 16));
  b[6] = (b[6] & 0x0f) | 0x50; // version 5
  b[8] = (b[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = b.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const q = (s) => (s === null || s === undefined || s === '' ? 'null' : `'${String(s).replace(/'/g, "''")}'`);
const num = (s) => { const n = parseInt(String(s).replace(/,/g, ''), 10); return Number.isFinite(n) ? n : 'null'; };

const pad = (n) => String(n).padStart(2, '0');
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/**
 * The renewal roll. A group effective "2021 November" renews every November;
 * return the first November 1st on or after today so the calendar and capacity
 * board show the upcoming OE wave rather than a date in 2021.
 */
function nextRenewal(month, today) {
  const year = Number(today.slice(0, 4));
  const candidate = `${year}-${pad(month)}-01`;
  return candidate >= today ? candidate : `${year + 1}-${pad(month)}-01`;
}

// --- read -------------------------------------------------------------------

const rows = parseCsv(readFileSync(SRC, 'utf8'));
const header = rows[0].map(tidy);
const idx = Object.fromEntries(header.map((h, i) => [h, i]));
for (const need of ['Benefit Manager', 'Benefit Specialist', 'Group', 'Group Effective Date',
  'State', 'Agent', 'Current Employees', 'Enrollments']) {
  if (!(need in idx)) { console.error(`CSV is missing the "${need}" column`); process.exit(1); }
}

const TODAY = todayIso();
const groups = [];
const seenNames = new Set();
const problems = [];

for (const r of rows.slice(1)) {
  const name = tidy(r[idx['Group']]);
  const manager = tidy(r[idx['Benefit Manager']]);
  if (!name || manager === 'Total') continue; // trailing totals row

  if (seenNames.has(name.toLowerCase())) { problems.push(`duplicate group name skipped: ${name}`); continue; }
  seenNames.add(name.toLowerCase());

  const [yearStr, monthName] = tidy(r[idx['Group Effective Date']]).split(' ');
  const month = MONTHS[monthName];
  if (!month) { problems.push(`unparseable effective date on "${name}": ${r[idx['Group Effective Date']]}`); }

  groups.push({
    id: uuidFor('group', name),
    name,
    manager,
    specialist: tidy(r[idx['Benefit Specialist']]),
    // State keeps its verbatim value, "[E]" markers included.
    state: tidy(r[idx['State']]),
    agent: tidy(r[idx['Agent']]),
    employees: num(r[idx['Current Employees']]),
    enrollments: num(r[idx['Enrollments']]),
    effective: month ? nextRenewal(month, TODAY) : null,
    original: month ? `${yearStr}-${pad(month)}-01` : null,
  });
}

// --- roster -----------------------------------------------------------------

const managerNames = [...new Set(groups.map((g) => g.manager).filter(Boolean))].sort();
const specialistNames = [...new Set(groups.map((g) => g.specialist).filter(Boolean))].sort();
const overlap = managerNames.filter((n) => specialistNames.includes(n));
if (overlap.length) problems.push(`person is both a Manager and a Specialist: ${overlap.join(', ')}`);

const people = [
  ...managerNames.map((name, i) => ({
    name, email: emailFor(name), role: 'Manager',
    color: null, capacity: null, sort: i + 1,
  })),
  ...specialistNames.map((name, i) => ({
    name, email: emailFor(name), role: 'Specialist',
    color: PALETTE[i % PALETTE.length], capacity: WEEKLY_CAPACITY,
    sort: managerNames.length + i + 1,
  })),
];

const dupeEmails = people.map((p) => p.email).filter((e, i, a) => a.indexOf(e) !== i);
if (dupeEmails.length) problems.push(`two people derive the same email: ${[...new Set(dupeEmails)].join(', ')}`);

// --- emit -------------------------------------------------------------------

const L = [];
const withSpecialist = groups.filter((g) => g.specialist);

L.push('-- =============================================================================');
L.push('-- Planstin OE Planner — real book of business');
L.push('-- =============================================================================');
L.push(`-- GENERATED by scripts/build-seed.mjs on ${TODAY}. Do not edit by hand —`);
L.push('-- change the CSV or the script and regenerate.');
L.push('--');
L.push(`-- Source : ${SRC.split('/').slice(-2).join('/')}`);
L.push(`-- Groups : ${groups.length}`);
L.push(`-- Roster : ${managerNames.length} Benefit Managers, ${specialistNames.length} Benefit Specialists`);
L.push(`-- Links  : ${withSpecialist.length} group_specialists`);
L.push('--');
L.push('-- effective_date is each group\'s NEXT renewal (its recurring month, rolled to');
L.push(`-- the first occurrence on or after ${TODAY}). The untouched export value is`);
L.push('-- kept in original_effective_date.');
L.push('--');
L.push('-- Run with: node scripts/run-sql.mjs supabase/seed_real.sql');
L.push('-- The runner wraps this in a single transaction.');
L.push('-- =============================================================================');
L.push('');

L.push('-- 1. Clear the demo book. enav_closeouts (org-wide month config) is kept, and');
L.push('--    so is any specialists row that has claimed a real login.');
L.push('delete from public.booking_week_loads;');
L.push('delete from public.bookings;');
L.push('delete from public.contribution_tiers;');
L.push('delete from public.contribution_plans;');
L.push('delete from public.specialist_capacity;');
L.push('delete from public.group_specialists;');
L.push('delete from public.plan_options;');
L.push('delete from public.guide_tool_items;');
L.push('delete from public.guide_timeline_items;');
L.push('delete from public.documents;');
L.push('delete from public.employee_classes;');
L.push('delete from public.groups;');
L.push('delete from public.specialists where user_id is null;');
L.push('');

L.push('-- 2. The roster. No logins are created here: a row with an email and no');
L.push('--    user_id is fully assignable, and handle_new_user() claims it the moment');
L.push('--    that person signs up with the matching address (0002, README 2.5).');
L.push('--    account_status is \'active\' so they are team members rather than pending');
L.push('--    requests on /admin; role is always set, because 0003 rejects an active');
L.push('--    row with a null role and the claim trigger does not supply one.');
L.push('--    on conflict (email) leaves user_id, account_status and is_admin alone, so');
L.push('--    an already-claimed login (joshgilbert@planstin.com) keeps its admin bit.');
L.push('insert into public.specialists (email, name, role, color, weekly_capacity, sort_order, account_status) values');
L.push(people.map((p) =>
  `  (${q(p.email)}, ${q(p.name)}, ${q(p.role)}, ${q(p.color)}, ${p.capacity ?? 'null'}, ${p.sort}, 'active')`,
).join(',\n') + '\non conflict (email) do update set');
L.push('  name            = excluded.name,');
L.push('  role            = excluded.role,');
L.push('  color           = excluded.color,');
L.push('  weekly_capacity = excluded.weekly_capacity,');
L.push('  sort_order      = excluded.sort_order;');
L.push('');

L.push(`-- 3. The ${groups.length} groups. manager_id resolves by email so it works whether the`);
L.push('--    roster row was just inserted or already existed.');
L.push('--');
L.push("--    oe_mode is 'None' for every one of them: these are renewals, and a renewal");
L.push('--    does not enter the OE pipeline just by existing. It stays off the calendar,');
L.push('--    the capacity board and the unscheduled queue until the Benefit Manager');
L.push("--    switches it to Full or Renewal OE on the group page — which they do once");
L.push('--    the ASA and Census are in. Same convention demoData.ts already used.');
L.push('insert into public.groups');
L.push('  (id, name, employees, enrollments, state, agent, group_type, effective_date,');
L.push('   original_effective_date, oe_format, oe_mode, status, manager_id) values');
L.push(groups.map((g) =>
  `  (${q(g.id)}, ${q(g.name)}, ${g.employees}, ${g.enrollments}, ${q(g.state)}, ${q(g.agent)},` +
  ` 'Renewal', ${q(g.effective)}, ${q(g.original)}, 'Virtual', 'None', 'Not scheduled',` +
  ` (select id from public.specialists where email = ${q(emailFor(g.manager))}))`,
).join(',\n') + ';');
L.push('');

L.push(`-- 4. Benefit Specialist assignments (${withSpecialist.length} of ${groups.length} groups have one).`);
L.push('--    employee_share carries the whole group: one specialist, no split.');
L.push('insert into public.group_specialists (group_id, specialist_id, employee_share) values');
L.push(withSpecialist.map((g) =>
  `  (${q(g.id)}, (select id from public.specialists where email = ${q(emailFor(g.specialist))}), ${g.employees})`,
).join(',\n') + '\non conflict (group_id, specialist_id) do update set employee_share = excluded.employee_share;');
L.push('');

L.push('-- 5. One default employee class per group — contributions need a class to hang');
L.push('--    off. Same pattern as supabase/seed.sql.');
L.push("insert into public.employee_classes (group_id, name, sort_order)");
L.push("select id, 'All employees', 0 from public.groups;");
L.push('');

L.push('-- 6. ASA / Census, both marked received. Every group in this import is an');
L.push('--    existing client whose paperwork has long been on file — the ASA and');
L.push('--    Census checks exist to track NEW group onboarding, not to re-litigate');
L.push('--    groups already on the books. No doc_date: the export does not carry');
L.push('--    one and inventing a receipt date would be worse than leaving it blank.');
L.push('insert into public.documents (group_id, doc_key, label, done, sort_order)');
L.push("select id, 'asa', 'ASA', true, 0 from public.groups");
L.push('union all');
L.push("select id, 'census', 'Census', true, 1 from public.groups;");
L.push('');

L.push('-- Sanity check — the runner prints this.');
L.push("select 'groups' as t, count(*) as n from public.groups");
L.push("union all select 'specialists', count(*) from public.specialists");
L.push("union all select 'group_specialists', count(*) from public.group_specialists");
L.push("union all select 'employee_classes', count(*) from public.employee_classes");
L.push("union all select 'documents', count(*) from public.documents");
L.push("union all select 'employees (sum)', sum(employees) from public.groups");
L.push("union all select 'enrollments (sum)', sum(enrollments) from public.groups");
L.push("union all select 'groups missing a manager', count(*) from public.groups where manager_id is null");
L.push('order by t;');
L.push('');

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, L.join('\n'));

// --- summary ----------------------------------------------------------------

const tally = (key) => {
  const m = new Map();
  for (const g of groups) {
    const k = typeof key === 'function' ? key(g) : g[key];
    const cur = m.get(k) || { groups: 0, employees: 0 };
    cur.groups++; cur.employees += Number(g.employees) || 0;
    m.set(k, cur);
  }
  return [...m.entries()].sort((a, b) => b[1].groups - a[1].groups);
};

console.log(`\nwrote ${OUT.replace(process.cwd() + '/', '')}  (${groups.length} groups)\n`);

console.log('Benefit Managers');
for (const [n, v] of tally('manager')) {
  console.log(`  ${n.padEnd(20)} ${String(v.groups).padStart(3)} groups  ${String(v.employees).padStart(4)} employees   ${emailFor(n)}`);
}
console.log('\nBenefit Specialists');
for (const [n, v] of tally((g) => g.specialist || '(unassigned)')) {
  console.log(`  ${n.padEnd(20)} ${String(v.groups).padStart(3)} groups  ${String(v.employees).padStart(4)} employees   ${n === '(unassigned)' ? '' : emailFor(n)}`);
}
console.log('\nNext renewal');
for (const [n, v] of tally('effective').sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
  console.log(`  ${n}  ${String(v.groups).padStart(3)} groups  ${String(v.employees).padStart(4)} employees`);
}
console.log('\nTotals');
console.log(`  employees   ${groups.reduce((s, g) => s + (Number(g.employees) || 0), 0)}`);
console.log(`  enrollments ${groups.reduce((s, g) => s + (Number(g.enrollments) || 0), 0)}`);
console.log(`  states      ${new Set(groups.map((g) => g.state)).size}`);
console.log(`  agents      ${new Set(groups.map((g) => g.agent)).size}`);

if (problems.length) {
  console.log('\n⚠  ' + problems.length + ' issue(s):');
  for (const p of problems) console.log('   - ' + p);
}
console.log('\nReview the SQL, then: node scripts/run-sql.mjs supabase/seed_real.sql\n');
