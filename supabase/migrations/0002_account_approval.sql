-- =============================================================================
-- Planstin OE Planner — account approval
-- =============================================================================
-- Run after 0001_init.sql, the same way: paste into the Supabase SQL editor,
-- or `supabase db push`. Adds a pending/active/rejected account status and an
-- is_admin flag to public.specialists, so new sign-ups require an admin to
-- approve them and assign a role before they can see anything.
--
-- Existing rows are backfilled to 'active' below BEFORE the not-null
-- constraint is added, so nobody already using the app is locked out — only
-- brand-new sign-ups (via the rewritten handle_new_user trigger) start out
-- 'pending'.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- specialists: account_status + is_admin, role becomes nullable
-- ---------------------------------------------------------------------------
alter table public.specialists add column if not exists account_status text;
update public.specialists set account_status = 'active' where account_status is null;
alter table public.specialists alter column account_status set default 'pending';
alter table public.specialists alter column account_status set not null;
alter table public.specialists
  drop constraint if exists specialists_account_status_check;
alter table public.specialists
  add constraint specialists_account_status_check
  check (account_status in ('pending', 'active', 'rejected'));

alter table public.specialists add column if not exists is_admin boolean not null default false;

alter table public.specialists alter column role drop not null;
alter table public.specialists alter column role drop default;
alter table public.specialists drop constraint if exists specialists_role_check;
alter table public.specialists
  add constraint specialists_role_check
  check (role is null or role in ('Guide', 'Manager', 'Specialist'));

-- ---------------------------------------------------------------------------
-- Sign-up trigger: claim a pre-provisioned roster row (admin already added
-- them, they're pre-approved), or create a new pending row with no role.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.specialists
     set user_id = new.id,
         account_status = 'active'
   where email is not null
     and lower(email) = lower(new.email)
     and user_id is null;

  if not found then
    insert into public.specialists (user_id, email, name, role, account_status)
    values (
      new.id,
      new.email,
      coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1)),
      null,
      'pending'
    );
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Helpers: is_admin() / is_active(), same pattern as the existing
-- is_manager() / current_specialist_id() in 0001_init.sql.
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.specialists
     where user_id = auth.uid() and is_admin and account_status = 'active'
  );
$$;

create or replace function public.is_active()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.specialists
     where user_id = auth.uid() and account_status = 'active'
  );
$$;

-- ---------------------------------------------------------------------------
-- Guardrail: only an admin may change role / account_status / is_admin on
-- ANY specialists row (including their own). specialists_update_self (below)
-- still lets a person edit their own name/capacity; this trigger closes the
-- gap RLS can't express (comparing old vs. new column values on UPDATE).
-- ---------------------------------------------------------------------------
create or replace function public.protect_specialist_admin_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- auth.uid() is null for the sign-up trigger (handle_new_user, which claims
  -- a pre-provisioned row and needs to flip it to 'active') and for
  -- service_role calls (already fully trusted, bypasses RLS everywhere) — in
  -- both cases there is no end-user session to protect against, so only
  -- enforce this for a real authenticated (browser) request.
  if auth.uid() is not null and not public.is_admin() then
    if new.role is distinct from old.role
       or new.account_status is distinct from old.account_status
       or new.is_admin is distinct from old.is_admin then
      raise exception 'only an admin may change role, account_status, or is_admin';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists specialists_protect_admin_fields on public.specialists;
create trigger specialists_protect_admin_fields
  before update on public.specialists
  for each row execute function public.protect_specialist_admin_fields();

-- ---------------------------------------------------------------------------
-- RLS: pending/rejected accounts see nothing except their own roster row.
-- Re-create the blanket "any authenticated user can read everything" policy
-- for every table EXCEPT specialists, gated on is_active(); specialists gets
-- its own select policy below.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'groups', 'employee_classes', 'group_specialists', 'bookings',
    'booking_week_loads', 'specialist_capacity', 'documents', 'guide_tool_items',
    'guide_timeline_items', 'plan_options', 'contribution_plans',
    'contribution_tiers', 'enav_closeouts'
  ]
  loop
    execute format('drop policy if exists %I on public.%I;', t || '_read', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.is_active());',
      t || '_read', t
    );
  end loop;
end
$$;

drop policy if exists specialists_read on public.specialists;
create policy specialists_read on public.specialists
  for select to authenticated
  using (user_id = auth.uid() or public.is_active());

-- Admins get the same specialists insert/delete power managers already have
-- (approving/rejecting is an edit/delete action on this table).
drop policy if exists specialists_insert_manager on public.specialists;
create policy specialists_insert_manager on public.specialists
  for insert to authenticated with check (public.is_manager() or public.is_admin());

drop policy if exists specialists_delete_manager on public.specialists;
create policy specialists_delete_manager on public.specialists
  for delete to authenticated using (public.is_manager() or public.is_admin());

drop policy if exists specialists_update_self on public.specialists;
create policy specialists_update_self on public.specialists
  for update to authenticated
  using (user_id = auth.uid() or public.is_manager() or public.is_admin())
  with check (user_id = auth.uid() or public.is_manager() or public.is_admin());

-- ---------------------------------------------------------------------------
-- Close the remaining write gaps so a pending/rejected account really has
-- zero access, not just read access. is_manager()-gated policies elsewhere
-- (groups_delete, enav_closeouts_write, specialists insert/delete above) are
-- already safe: a pending row has role = null, so is_manager() is false.
-- can_write_group() is used by groups_update and every "hangs off a group"
-- write policy, so tightening it here covers all of them in one place.
-- ---------------------------------------------------------------------------
create or replace function public.can_write_group(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_active()
     and (
       public.is_manager()
       or exists (
         select 1 from public.groups g
          where g.id = target and g.manager_id = public.current_specialist_id()
       )
       or exists (
         select 1 from public.group_specialists gs
          where gs.group_id = target and gs.specialist_id = public.current_specialist_id()
       )
     );
$$;

drop policy if exists groups_insert on public.groups;
create policy groups_insert on public.groups
  for insert to authenticated with check (public.is_active());

drop policy if exists specialist_capacity_write on public.specialist_capacity;
create policy specialist_capacity_write on public.specialist_capacity
  for all to authenticated
  using (public.is_active() and (specialist_id = public.current_specialist_id() or public.is_manager()))
  with check (public.is_active() and (specialist_id = public.current_specialist_id() or public.is_manager()));
