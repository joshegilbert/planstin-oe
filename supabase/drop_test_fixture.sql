-- Remove the Batman / Batman Inc. test fixture (supabase/seed_test_fixture.sql).
-- Children cascade off groups, so only the group and the person need naming.
--
-- Run with: node scripts/run-sql.mjs supabase/drop_test_fixture.sql

delete from public.groups      where id = 'dddddddd-0000-4000-8000-000000000002';
delete from public.specialists where id = 'dddddddd-0000-4000-8000-000000000001';

select 'specialists' as t, count(*) as n from public.specialists
union all select 'groups', count(*) from public.groups
order by t;
