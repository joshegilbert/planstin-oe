-- =============================================================================
-- Planstin OE Planner — Employee role
-- =============================================================================
-- Adds a 4th role for someone who needs signed-in access but is not part of
-- the scheduling pool (not a Guide, Manager, or Specialist). Every existing
-- role-based filter in the frontend is an explicit allow-list for the
-- original three values, so 'Employee' is automatically excluded from the
-- capacity board and every Guide/Manager/specialist picker with no other
-- schema change needed.
-- =============================================================================

alter table public.specialists drop constraint if exists specialists_role_check;
alter table public.specialists
  add constraint specialists_role_check
  check (role is null or role in ('Guide', 'Manager', 'Specialist', 'Employee'));
