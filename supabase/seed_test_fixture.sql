-- =============================================================================
-- Planstin OE Planner — test fixture
-- =============================================================================
-- A throwaway person and group for poking at the app without touching a real
-- client. Deliberately kept OUT of seed_real.sql (which is regenerated from the
-- CSV) so it can be added and removed independently.
--
--   Batman       Benefit Specialist, batman@planstin.com, no login
--   Batman Inc.  a group managed by Josh Gilbert, worked by Batman
--
-- Both use recognisable dddddddd-… ids so they are obvious in the table editor.
--
-- Run with:  node scripts/run-sql.mjs supabase/seed_test_fixture.sql
-- Undo with: supabase/drop_test_fixture.sql
-- =============================================================================

-- 1. Retire the old scratch account entirely — roster row and login.
delete from public.specialists where lower(email) = 'test@gmail.com';
delete from auth.users        where lower(email) = 'test@gmail.com';

-- 2. Batman. Specialist, so he shows up on the capacity board and in the
--    scheduling pickers. 'active' with a role, per the 0003 constraint.
insert into public.specialists
  (id, email, name, role, color, weekly_capacity, sort_order, account_status)
values
  ('dddddddd-0000-4000-8000-000000000001', 'batman@planstin.com', 'Batman',
   'Specialist', '#56B4E9', 200, 99, 'active')
on conflict (email) do update set
  name            = excluded.name,
  role            = excluded.role,
  color           = excluded.color,
  weekly_capacity = excluded.weekly_capacity,
  sort_order      = excluded.sort_order;

-- 3. Batman Inc. Renews in the October 2026 wave so it lands on the calendar
--    next to the real work.
insert into public.groups
  (id, name, employees, enrollments, state, agent, group_type, effective_date,
   original_effective_date, oe_format, oe_mode, status, manager_id, notes)
values
  ('dddddddd-0000-4000-8000-000000000002', 'Batman Inc.', 12, 30, 'Utah',
   'Planstin - Default Agent', 'Renewal', '2026-10-01', '2026-10-01',
   'Virtual', 'Full', 'Not scheduled',
   (select id from public.specialists where email = 'joshgilbert@planstin.com'),
   'Test group — safe to edit or delete.')
on conflict (id) do update set
  name        = excluded.name,
  employees   = excluded.employees,
  enrollments = excluded.enrollments,
  notes       = excluded.notes;

insert into public.group_specialists (group_id, specialist_id, employee_share)
values
  ('dddddddd-0000-4000-8000-000000000002',
   (select id from public.specialists where email = 'batman@planstin.com'), 12)
on conflict (group_id, specialist_id) do update set
  employee_share = excluded.employee_share;

insert into public.employee_classes (group_id, name, sort_order)
select 'dddddddd-0000-4000-8000-000000000002', 'All employees', 0
where not exists (
  select 1 from public.employee_classes
   where group_id = 'dddddddd-0000-4000-8000-000000000002'
);

insert into public.documents (group_id, doc_key, label, done, sort_order) values
  ('dddddddd-0000-4000-8000-000000000002', 'asa',    'ASA',    false, 0),
  ('dddddddd-0000-4000-8000-000000000002', 'census', 'Census', false, 1)
on conflict (group_id, doc_key) do nothing;

select 'specialists' as t, count(*) as n from public.specialists
union all select 'groups', count(*) from public.groups
union all select 'auth users', count(*) from auth.users
order by t;
