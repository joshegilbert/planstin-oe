-- =============================================================================
-- Planstin OE Planner — sample data
-- =============================================================================
-- Mirrors the demo data the app falls back to when Supabase is not configured,
-- so a fresh project looks the same as `npm run dev` with no env vars.
--
-- Run AFTER 0001_init.sql:
--   supabase db reset          (CLI, runs migrations + this file)
--   or paste into the dashboard SQL editor.
--
-- The roster rows carry emails but no user_id. When someone signs up with a
-- matching email the handle_new_user() trigger claims their row. Replace the
-- @planstin.com addresses below with real ones before inviting the team.
-- =============================================================================

begin;

insert into public.enav_closeouts (month, closeout_day) values
  (1, null), (2, 22), (3, 22), (4, 19), (5, 24), (6, 21),
  (7, 26), (8, 23), (9, 20), (10, 25), (11, 22), (12, 20)
on conflict (month) do update set closeout_day = excluded.closeout_day;

insert into public.specialists (id, email, name, role, color, weekly_capacity, sort_order) values
  ('11111111-0000-4000-8000-000000000001', 'alex@planstin.com',    'Alex',    'Guide',      null,      null, 1),
  ('11111111-0000-4000-8000-000000000002', 'priya@planstin.com',   'Priya',   'Guide',      null,      null, 2),
  ('11111111-0000-4000-8000-000000000003', 'dana@planstin.com',    'Dana',    'Manager',    null,      null, 3),
  ('11111111-0000-4000-8000-000000000004', 'marcus@planstin.com',  'Marcus',  'Manager',    null,      null, 4),
  ('11111111-0000-4000-8000-000000000005', 'tara@planstin.com',    'Tara',    'Manager',    null,      null, 5),
  ('11111111-0000-4000-8000-000000000006', 'sarah@planstin.com',   'Sarah',   'Specialist', '#0072B2',  150, 6),
  ('11111111-0000-4000-8000-000000000007', 'mike@planstin.com',    'Mike',    'Specialist', '#E69F00',  300, 7),
  ('11111111-0000-4000-8000-000000000008', 'jessica@planstin.com', 'Jessica', 'Specialist', '#009E73',  200, 8),
  ('11111111-0000-4000-8000-000000000009', 'luis@planstin.com',    'Luis',    'Specialist', '#CC79A7',  200, 9)
on conflict (id) do nothing;

insert into public.groups
  (id, name, employees, group_type, effective_date, oe_format, oe_mode, status,
   guide_id, manager_id, notes)
values
  ('22222222-0000-4000-8000-000000000001', 'ESC Auto Group Inc',     21,  'Renewal', '2026-09-01', 'Virtual',   'Passive', 'Complete',
   '11111111-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000003', ''),
  ('22222222-0000-4000-8000-000000000002', 'Family Resource Agency', 297, 'Renewal', '2026-09-01', 'Hybrid',    'Passive', 'Complete',
   '11111111-0000-4000-8000-000000000002', '11111111-0000-4000-8000-000000000004',
   'Compressed to a single week at the client''s request — Sarah is far over capacity that week.'),
  ('22222222-0000-4000-8000-000000000003', 'Hangar I',               60,  'Renewal', '2026-10-01', 'In-Person', 'Passive', 'Scheduled',
   '11111111-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000003', ''),
  ('22222222-0000-4000-8000-000000000004', 'Green River Farming',    14,  'Renewal', '2026-10-01', 'Virtual',   'Passive', 'Complete',
   '11111111-0000-4000-8000-000000000002', '11111111-0000-4000-8000-000000000005', ''),
  ('22222222-0000-4000-8000-000000000005', 'Boardwalk Cabinetry',    45,  'Renewal', '2026-11-01', 'Hybrid',    'Passive', 'Scheduled',
   '11111111-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000004', ''),
  ('22222222-0000-4000-8000-000000000006', 'Northern Title Co',      80,  'Renewal', '2026-11-01', 'Virtual',   'Passive', 'Scheduled',
   '11111111-0000-4000-8000-000000000002', '11111111-0000-4000-8000-000000000003', ''),
  ('22222222-0000-4000-8000-000000000007', 'Herban Market',          84,  'Renewal', '2026-11-01', 'Virtual',   'Passive', 'Not scheduled',
   '11111111-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000005', ''),
  ('22222222-0000-4000-8000-000000000008', 'Andalas LLC',            2,   'Renewal', '2026-11-01', 'Virtual',   'None',    'Not scheduled',
   '11111111-0000-4000-8000-000000000002', '11111111-0000-4000-8000-000000000004', ''),
  ('22222222-0000-4000-8000-000000000009', 'Apex Health Group',      110, 'Renewal', '2026-12-01', 'Virtual',   'Passive', 'Scheduled',
   '11111111-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000005', ''),
  ('22222222-0000-4000-8000-000000000010', 'AVS',                    150, 'New',     '2027-01-01', 'Hybrid',    'Full',    'Scheduled',
   '11111111-0000-4000-8000-000000000002', '11111111-0000-4000-8000-000000000003', ''),
  ('22222222-0000-4000-8000-000000000011', 'The Lamb''s Chapel',     40,  'Renewal', '2027-01-01', 'Virtual',   'None',    'Not scheduled',
   '11111111-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000004', ''),
  ('22222222-0000-4000-8000-000000000012', 'PCAH Miami Beach',       55,  'Renewal', '2027-01-01', 'In-Person', 'None',    'Not scheduled',
   '11111111-0000-4000-8000-000000000002', '11111111-0000-4000-8000-000000000003', ''),
  ('22222222-0000-4000-8000-000000000013', 'Salt Lake Express',      200, 'Renewal', '2027-01-01', 'Hybrid',    'None',    'Not scheduled',
   '11111111-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000005', '')
on conflict (id) do nothing;

-- Apex Health Group's enrollment guide is already signed off.
update public.groups
   set guide_complete = true, guide_completed_by = 'Dana', guide_completed_at = now()
 where id = '22222222-0000-4000-8000-000000000009';

-- Every group starts with a single catch-all employee class.
insert into public.employee_classes (group_id, name, sort_order)
select id, 'All employees', 0 from public.groups
on conflict do nothing;

insert into public.group_specialists (group_id, specialist_id, employee_share, manual_override) values
  ('22222222-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000006', 21,  false),
  ('22222222-0000-4000-8000-000000000002', '11111111-0000-4000-8000-000000000006', 250, true),
  ('22222222-0000-4000-8000-000000000002', '11111111-0000-4000-8000-000000000008', 47,  true),
  ('22222222-0000-4000-8000-000000000003', '11111111-0000-4000-8000-000000000008', 60,  false),
  ('22222222-0000-4000-8000-000000000004', '11111111-0000-4000-8000-000000000007', 14,  false),
  ('22222222-0000-4000-8000-000000000005', '11111111-0000-4000-8000-000000000009', 45,  false),
  ('22222222-0000-4000-8000-000000000006', '11111111-0000-4000-8000-000000000006', 80,  false),
  ('22222222-0000-4000-8000-000000000009', '11111111-0000-4000-8000-000000000007', 55,  false),
  ('22222222-0000-4000-8000-000000000009', '11111111-0000-4000-8000-000000000008', 55,  false),
  ('22222222-0000-4000-8000-000000000010', '11111111-0000-4000-8000-000000000009', 150, false)
on conflict do nothing;

insert into public.bookings (group_id, specialist_id, start_date, end_date, status) values
  ('22222222-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000006', '2026-08-03', '2026-08-14', 'Complete'),
  ('22222222-0000-4000-8000-000000000002', '11111111-0000-4000-8000-000000000006', '2026-08-03', '2026-08-07', 'Complete'),
  ('22222222-0000-4000-8000-000000000003', '11111111-0000-4000-8000-000000000008', '2026-09-02', '2026-09-12', 'Scheduled'),
  ('22222222-0000-4000-8000-000000000004', '11111111-0000-4000-8000-000000000007', '2026-09-08', '2026-09-26', 'Complete'),
  ('22222222-0000-4000-8000-000000000005', '11111111-0000-4000-8000-000000000009', '2026-09-29', '2026-10-10', 'Scheduled'),
  ('22222222-0000-4000-8000-000000000006', '11111111-0000-4000-8000-000000000006', '2026-10-06', '2026-10-17', 'Scheduled'),
  ('22222222-0000-4000-8000-000000000009', '11111111-0000-4000-8000-000000000007', '2026-11-03', '2026-11-14', 'Scheduled'),
  ('22222222-0000-4000-8000-000000000010', '11111111-0000-4000-8000-000000000009', '2026-10-05', '2026-10-30', 'Scheduled')
on conflict (group_id) do nothing;

insert into public.documents (group_id, doc_key, label, done, doc_date, sort_order) values
  ('22222222-0000-4000-8000-000000000001', 'asa',    'ASA',    true,  '2026-07-10', 0),
  ('22222222-0000-4000-8000-000000000001', 'census', 'Census', true,  '2026-07-10', 1),
  ('22222222-0000-4000-8000-000000000002', 'asa',    'ASA',    false, null,         0),
  ('22222222-0000-4000-8000-000000000002', 'census', 'Census', true,  '2026-07-02', 1),
  ('22222222-0000-4000-8000-000000000003', 'asa',    'ASA',    true,  '2026-08-05', 0),
  ('22222222-0000-4000-8000-000000000003', 'census', 'Census', true,  '2026-08-05', 1),
  ('22222222-0000-4000-8000-000000000004', 'asa',    'ASA',    true,  '2026-08-12', 0),
  ('22222222-0000-4000-8000-000000000004', 'census', 'Census', false, null,         1),
  ('22222222-0000-4000-8000-000000000005', 'asa',    'ASA',    true,  '2026-08-20', 0),
  ('22222222-0000-4000-8000-000000000005', 'census', 'Census', true,  '2026-08-20', 1),
  ('22222222-0000-4000-8000-000000000006', 'asa',    'ASA',    true,  '2026-08-24', 0),
  ('22222222-0000-4000-8000-000000000006', 'census', 'Census', true,  '2026-08-24', 1),
  ('22222222-0000-4000-8000-000000000007', 'asa',    'ASA',    true,  '2026-08-18', 0),
  ('22222222-0000-4000-8000-000000000007', 'census', 'Census', false, null,         1),
  ('22222222-0000-4000-8000-000000000008', 'asa',    'ASA',    false, null,         0),
  ('22222222-0000-4000-8000-000000000008', 'census', 'Census', false, null,         1),
  ('22222222-0000-4000-8000-000000000009', 'asa',    'ASA',    true,  '2026-08-26', 0),
  ('22222222-0000-4000-8000-000000000009', 'census', 'Census', true,  '2026-08-26', 1),
  ('22222222-0000-4000-8000-000000000010', 'asa',    'ASA',    true,  '2026-08-14', 0),
  ('22222222-0000-4000-8000-000000000010', 'census', 'Census', true,  '2026-08-14', 1),
  ('22222222-0000-4000-8000-000000000011', 'asa',    'ASA',    true,  '2026-08-21', 0),
  ('22222222-0000-4000-8000-000000000011', 'census', 'Census', true,  '2026-08-21', 1),
  ('22222222-0000-4000-8000-000000000012', 'asa',    'ASA',    true,  '2026-08-19', 0),
  ('22222222-0000-4000-8000-000000000012', 'census', 'Census', false, null,         1),
  ('22222222-0000-4000-8000-000000000013', 'asa',    'ASA',    false, null,         0),
  ('22222222-0000-4000-8000-000000000013', 'census', 'Census', true,  '2026-08-22', 1)
on conflict (group_id, doc_key) do nothing;

commit;
