-- =============================================================================
-- Planstin OE Planner — book-of-business fields on groups
-- =============================================================================
-- The real export carries three facts about a group that had nowhere to live:
-- the state the group sits in, the broker agent of record, and the enrollment
-- count (members) as distinct from `employees` (the eligible headcount the
-- capacity board schedules against).
--
-- It also carries the group's ORIGINAL effective month, going back to 2017.
-- `effective_date` is rolled forward to the next renewal so the calendar and
-- capacity board show the upcoming OE wave; `original_effective_date` keeps the
-- untouched value so tenure isn't lost.
--
-- All four are nullable: groups created in-app from the Draft dialog won't set
-- them, and nothing in the scheduling logic depends on them.
-- =============================================================================

alter table public.groups
  add column if not exists state                   text,
  add column if not exists agent                   text,
  add column if not exists enrollments             integer,
  add column if not exists original_effective_date date;

alter table public.groups drop constraint if exists groups_enrollments_check;
alter table public.groups
  add constraint groups_enrollments_check
  check (enrollments is null or enrollments >= 0);

-- Both are low-cardinality filter targets on the Groups screen
-- (39 states, ~50 agents across 322 groups).
create index if not exists groups_state_idx on public.groups (state);
create index if not exists groups_agent_idx on public.groups (agent);
