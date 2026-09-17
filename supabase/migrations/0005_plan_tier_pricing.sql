-- =============================================================================
-- Planstin OE Planner — Per-tier plan pricing
-- =============================================================================
-- Replaces the single flat plan_options.rate with 4 tier rates (EE/ES/EC/EF),
-- matching the tier vocabulary already used by contribution_tiers. Existing
-- rate values migrate into rate_ee, since EE (employee only) is the base tier.
-- =============================================================================

alter table public.plan_options
  add column if not exists rate_ee numeric(10, 2),
  add column if not exists rate_es numeric(10, 2),
  add column if not exists rate_ec numeric(10, 2),
  add column if not exists rate_ef numeric(10, 2);

update public.plan_options set rate_ee = rate where rate is not null and rate_ee is null;

alter table public.plan_options drop column if exists rate;
