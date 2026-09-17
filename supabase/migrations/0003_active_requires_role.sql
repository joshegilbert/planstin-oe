-- =============================================================================
-- Planstin OE Planner — active accounts must have a role
-- =============================================================================
-- Small follow-up to 0002_account_approval.sql: an 'active' specialist should
-- never have role = null (approval always assigns one of the three roles in
-- the same step). Enforced at the DB level so a bug in the admin UI can't
-- leave the app in an inconsistent state the frontend doesn't expect.
-- =============================================================================

alter table public.specialists
  drop constraint if exists specialists_active_requires_role;
alter table public.specialists
  add constraint specialists_active_requires_role
  check (account_status <> 'active' or role is not null);
