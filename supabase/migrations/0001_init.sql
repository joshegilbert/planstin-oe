-- =============================================================================
-- Planstin OE Planner — initial schema
-- =============================================================================
-- Run with the Supabase CLI (`supabase db push`) or by pasting into the SQL
-- editor in the Supabase dashboard. `supabase/seed.sql` loads sample rows.
--
-- NOTE ON RLS: the policies at the bottom of this file are a reasonable FIRST
-- PASS, not a finished security review. They assume every authenticated user is
-- a Planstin employee who may read the whole book of business, and they narrow
-- *writes* to the rows a person is expected to own. Before this holds real
-- client data, review them against your actual roles and threat model.
-- =============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- specialists — the Planstin team roster.
-- Named `specialists` because benefit specialists are the ones that carry
-- weekly capacity, but the table holds the whole roster: Guides, Managers and
-- Specialists, distinguished by `role`. One row may be claimed by one
-- auth.users account (1:1 via user_id).
-- ---------------------------------------------------------------------------
create table if not exists public.specialists (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid unique references auth.users (id) on delete set null,
  email            text unique,
  name             text not null,
  role             text not null default 'Specialist'
                     check (role in ('Guide', 'Manager', 'Specialist')),
  color            text,
  weekly_capacity  integer check (weekly_capacity is null or weekly_capacity >= 0),
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists specialists_role_idx on public.specialists (role);

create trigger specialists_set_updated_at
  before update on public.specialists
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- groups — one client group / employer.
-- `info` is a small jsonb bag of free-text intake notes (enrollment tool,
-- waiting period, payroll, …). They are notes, never queried or joined, so
-- they stay denormalised on purpose.
-- ---------------------------------------------------------------------------
create table if not exists public.groups (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  employees           integer not null default 0 check (employees >= 0),
  group_type          text not null default 'Renewal' check (group_type in ('New', 'Renewal')),
  effective_date      date,
  oe_format           text not null default 'Virtual'
                        check (oe_format in ('Virtual', 'In-Person', 'Hybrid')),
  oe_mode             text not null default 'Full' check (oe_mode in ('Full', 'Passive', 'None')),
  status              text not null default 'Not scheduled'
                        check (status in ('Not scheduled', 'Scheduled', 'In progress', 'Complete')),
  guide_id            uuid references public.specialists (id) on delete set null,
  manager_id          uuid references public.specialists (id) on delete set null,
  notes               text not null default '',
  info                jsonb not null default '{}'::jsonb,
  contrib_mode        text not null default '$' check (contrib_mode in ('$', '%')),
  guide_complete      boolean not null default false,
  guide_completed_by  text not null default '',
  guide_completed_at  timestamptz,
  edited_by           text not null default '',
  edited_at           timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists groups_effective_idx on public.groups (effective_date);
create index if not exists groups_manager_idx on public.groups (manager_id);

create trigger groups_set_updated_at
  before update on public.groups
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- employee_classes — named groupings used for per-class contributions.
-- ---------------------------------------------------------------------------
create table if not exists public.employee_classes (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.groups (id) on delete cascade,
  name        text not null default '',
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists employee_classes_group_idx on public.employee_classes (group_id);

-- ---------------------------------------------------------------------------
-- group_specialists — which specialists run a group's OE and how the employee
-- count is split between them.
-- ---------------------------------------------------------------------------
create table if not exists public.group_specialists (
  group_id         uuid not null references public.groups (id) on delete cascade,
  specialist_id    uuid not null references public.specialists (id) on delete cascade,
  employee_share   integer not null default 0 check (employee_share >= 0),
  manual_override  boolean not null default false,
  created_at       timestamptz not null default now(),
  primary key (group_id, specialist_id)
);

create index if not exists group_specialists_specialist_idx
  on public.group_specialists (specialist_id);

-- ---------------------------------------------------------------------------
-- bookings — the scheduled OE window for a group. Exactly one window per
-- group, which is what the calendar bars represent; who runs it and how the
-- employees split lives in group_specialists. `specialist_id` names the lead
-- when a single owner is meaningful and is null for unassigned OE.
-- ---------------------------------------------------------------------------
create table if not exists public.bookings (
  id             uuid primary key default gen_random_uuid(),
  group_id       uuid not null unique references public.groups (id) on delete cascade,
  specialist_id  uuid references public.specialists (id) on delete set null,
  start_date     date not null,
  end_date       date not null,
  status         text not null default 'Scheduled'
                   check (status in ('Not scheduled', 'Scheduled', 'In progress', 'Complete')),
  created_by     uuid references public.specialists (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint bookings_window_ordered check (end_date >= start_date)
);

create index if not exists bookings_dates_idx on public.bookings (start_date, end_date);

create trigger bookings_set_updated_at
  before update on public.bookings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- booking_week_loads — optional per-week effort override for a booking, so a
-- group that front-loads its OE is not split evenly across its weeks.
-- ---------------------------------------------------------------------------
create table if not exists public.booking_week_loads (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null references public.bookings (id) on delete cascade,
  week_start  date not null,
  employees   numeric(8, 2) not null default 0,
  unique (booking_id, week_start)
);

-- ---------------------------------------------------------------------------
-- specialist_capacity — per-week capacity override for one specialist.
-- ---------------------------------------------------------------------------
create table if not exists public.specialist_capacity (
  id             uuid primary key default gen_random_uuid(),
  specialist_id  uuid not null references public.specialists (id) on delete cascade,
  week_start     date not null,
  capacity       integer not null check (capacity >= 0),
  unique (specialist_id, week_start)
);

-- ---------------------------------------------------------------------------
-- documents — per-group intake document checklist (ASA, Census, …).
-- ---------------------------------------------------------------------------
create table if not exists public.documents (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.groups (id) on delete cascade,
  doc_key     text not null,
  label       text not null,
  done        boolean not null default false,
  doc_date    date,
  note        text not null default '',
  tag         text,
  sort_order  integer not null default 0,
  unique (group_id, doc_key)
);

-- ---------------------------------------------------------------------------
-- guide_tool_items / guide_timeline_items — the two Enrollment Guide
-- checklists. Rows are created per group from the standard item lists.
-- ---------------------------------------------------------------------------
create table if not exists public.guide_tool_items (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.groups (id) on delete cascade,
  label       text not null,
  done        boolean not null default false,
  note        text not null default '',
  sort_order  integer not null default 0,
  unique (group_id, label)
);

create table if not exists public.guide_timeline_items (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.groups (id) on delete cascade,
  label       text not null,
  done        boolean not null default false,
  item_date   date,
  sort_order  integer not null default 0,
  unique (group_id, label)
);

-- ---------------------------------------------------------------------------
-- plan_options — every plan in the catalog, per group, with the offered flag
-- and the group's negotiated rate / version.
-- ---------------------------------------------------------------------------
create table if not exists public.plan_options (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.groups (id) on delete cascade,
  plan_name   text not null,
  offered     boolean not null default false,
  rate        numeric(10, 2),
  version     text not null default '',
  rx_version  text not null default '',
  sort_order  integer not null default 0,
  unique (group_id, plan_name)
);

create index if not exists plan_options_group_idx on public.plan_options (group_id);

-- ---------------------------------------------------------------------------
-- contribution_plans / contribution_tiers — employer contribution per plan,
-- per employee class, per coverage tier. `value` is read as dollars or as a
-- percentage of premium depending on groups.contrib_mode.
-- ---------------------------------------------------------------------------
create table if not exists public.contribution_plans (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.groups (id) on delete cascade,
  plan_name  text not null,
  unique (group_id, plan_name)
);

create table if not exists public.contribution_tiers (
  id                    uuid primary key default gen_random_uuid(),
  contribution_plan_id  uuid not null references public.contribution_plans (id) on delete cascade,
  employee_class_id     uuid not null references public.employee_classes (id) on delete cascade,
  tier                  text not null check (tier in ('EE', 'ES', 'EC', 'EF')),
  value                 numeric(10, 2),
  unique (contribution_plan_id, employee_class_id, tier)
);

-- ---------------------------------------------------------------------------
-- enav_closeouts — the day of each month the eNav portal closes out. A group's
-- OE must finish by the closeout in the month BEFORE its effective date.
-- ---------------------------------------------------------------------------
create table if not exists public.enav_closeouts (
  month         integer primary key check (month between 1 and 12),
  closeout_day  integer check (closeout_day between 1 and 31)
);

-- =============================================================================
-- Auth glue
-- =============================================================================

-- Claim a roster row on sign-up when its email matches the new account.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.specialists
     set user_id = new.id
   where email is not null
     and lower(email) = lower(new.email)
     and user_id is null;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- security definer helpers so policies can inspect the roster without
-- recursing back through specialists' own RLS.
create or replace function public.current_specialist_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.specialists where user_id = auth.uid() limit 1;
$$;

create or replace function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.specialists
     where user_id = auth.uid() and role = 'Manager'
  );
$$;

-- True when the signed-in user runs this group, manages it, or is a Manager.
create or replace function public.can_write_group(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_manager()
      or exists (
        select 1 from public.groups g
         where g.id = target and g.manager_id = public.current_specialist_id()
      )
      or exists (
        select 1 from public.group_specialists gs
         where gs.group_id = target and gs.specialist_id = public.current_specialist_id()
      );
$$;

-- =============================================================================
-- Row Level Security — FIRST PASS, review before production.
-- =============================================================================

alter table public.specialists          enable row level security;
alter table public.groups               enable row level security;
alter table public.employee_classes     enable row level security;
alter table public.group_specialists    enable row level security;
alter table public.bookings             enable row level security;
alter table public.booking_week_loads   enable row level security;
alter table public.specialist_capacity  enable row level security;
alter table public.documents            enable row level security;
alter table public.guide_tool_items     enable row level security;
alter table public.guide_timeline_items enable row level security;
alter table public.plan_options         enable row level security;
alter table public.contribution_plans   enable row level security;
alter table public.contribution_tiers   enable row level security;
alter table public.enav_closeouts       enable row level security;

-- Everyone signed in can read everything. OE planning is a shared team view.
do $$
declare t text;
begin
  foreach t in array array[
    'specialists', 'groups', 'employee_classes', 'group_specialists', 'bookings',
    'booking_week_loads', 'specialist_capacity', 'documents', 'guide_tool_items',
    'guide_timeline_items', 'plan_options', 'contribution_plans',
    'contribution_tiers', 'enav_closeouts'
  ]
  loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (true);',
      t || '_read', t
    );
  end loop;
end
$$;

-- Roster: you may edit your own row (name, capacity). Managers admin everyone.
create policy specialists_update_self on public.specialists
  for update to authenticated
  using (user_id = auth.uid() or public.is_manager())
  with check (user_id = auth.uid() or public.is_manager());

create policy specialists_insert_manager on public.specialists
  for insert to authenticated with check (public.is_manager());

create policy specialists_delete_manager on public.specialists
  for delete to authenticated using (public.is_manager());

-- Your own weekly capacity overrides (managers may set anyone's).
create policy specialist_capacity_write on public.specialist_capacity
  for all to authenticated
  using (specialist_id = public.current_specialist_id() or public.is_manager())
  with check (specialist_id = public.current_specialist_id() or public.is_manager());

-- Groups: any authenticated employee may create a group; edits are limited to
-- the people who run it (assigned specialists, its manager) plus Managers.
create policy groups_insert on public.groups
  for insert to authenticated with check (true);

create policy groups_update on public.groups
  for update to authenticated
  using (public.can_write_group(id))
  with check (public.can_write_group(id));

create policy groups_delete on public.groups
  for delete to authenticated using (public.is_manager());

-- Everything hanging off a group follows the group's write rule.
do $$
declare t text;
begin
  foreach t in array array[
    'employee_classes', 'group_specialists', 'bookings', 'documents',
    'guide_tool_items', 'guide_timeline_items', 'plan_options', 'contribution_plans'
  ]
  loop
    execute format(
      'create policy %I on public.%I for all to authenticated '
      'using (public.can_write_group(group_id)) '
      'with check (public.can_write_group(group_id));',
      t || '_write', t
    );
  end loop;
end
$$;

create policy booking_week_loads_write on public.booking_week_loads
  for all to authenticated
  using (exists (
    select 1 from public.bookings b
     where b.id = booking_id and public.can_write_group(b.group_id)
  ))
  with check (exists (
    select 1 from public.bookings b
     where b.id = booking_id and public.can_write_group(b.group_id)
  ));

create policy contribution_tiers_write on public.contribution_tiers
  for all to authenticated
  using (exists (
    select 1 from public.contribution_plans cp
     where cp.id = contribution_plan_id and public.can_write_group(cp.group_id)
  ))
  with check (exists (
    select 1 from public.contribution_plans cp
     where cp.id = contribution_plan_id and public.can_write_group(cp.group_id)
  ));

-- Closeout dates are org-wide settings: Managers only.
create policy enav_closeouts_write on public.enav_closeouts
  for all to authenticated
  using (public.is_manager())
  with check (public.is_manager());
