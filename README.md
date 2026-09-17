# Planstin OE Planner

Internal planning tool for open-enrollment specialists: specialist capacity, OE
scheduling windows and eNav (Employee Navigator) closeout deadlines in one
shared view.

Stack: React + Vite + TypeScript, TanStack Query, react-router-dom, date-fns,
Supabase (Postgres + Auth).

## Screens

| Route | What it is |
| --- | --- |
| `/signin` | Password sign-in and create-account request (new accounts require admin approval — see [2.4](#24-authentication--account-approval)) |
| `/calendar` | Week / 2-week / month calendar of OE windows, draggable bars, unscheduled queue |
| `/board` | 13-week capacity board — employees booked vs. weekly capacity per specialist |
| `/groups` | Filterable, sortable book of business |
| `/groups/:id` | Group detail: Details, OE Guide, Plan options, Contributions |
| `/admin` | Approve/reject account requests, assign roles, manage the team (admins only) |

---

## 1. Run it locally

```bash
npm install
npm run dev     # http://localhost:5173
```

**You do not need Supabase to start.** With no environment variables set, the
app runs on bundled demo data (the same roster and groups as `supabase/seed.sql`),
shows a "Demo data" banner, and persists every edit to `localStorage` only.
Sign-in accepts any email in this mode — try `dana@planstin.com` or
`sarah@planstin.com` to land on that person's view.

Other scripts:

```bash
npm run build     # typecheck (tsc -b) + production build into dist/
npm run preview   # serve the production build locally
```

---

## 2. Connect a Supabase project

### 2.1 Create the project

1. Go to <https://supabase.com/dashboard> and create a new project.
2. Once it finishes provisioning, open **Project Settings → API** and copy the
   **Project URL** and the **anon / public** key.

### 2.2 Set the environment variables

```bash
cp .env.example .env.local
```

Then fill in `.env.local`:

```
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your anon public key>
```

`.env.local` is gitignored. Both variables must be present — if either is blank
the app falls back to demo data. Restart `npm run dev` after changing them.

Only the **anon** key belongs here. It is shipped to the browser, so never put
the `service_role` key in a `VITE_` variable.

### 2.3 Run the migrations and the seed

The schema lives in `supabase/migrations/*.sql` (run in filename order —
`0001_init.sql` first, then `0002`, `0003`, `0004`, …) and sample rows in
`supabase/seed.sql`.

**Option A — Supabase dashboard (no tooling required)**

1. Open **SQL Editor → New query**.
2. Paste the entire contents of `supabase/migrations/0001_init.sql`, run it.
3. Repeat for each later `000N_*.sql` migration, in order.
4. New query again, paste `supabase/seed.sql`, run it.

**Option B — Supabase CLI**

```bash
npm install -g supabase          # or: brew install supabase/tap/supabase
supabase login
supabase link --project-ref <your-project-ref>
supabase db push                 # applies supabase/migrations/*
```

`db push` does not run the seed against a linked remote project. Load it
separately with `psql`, using the connection string from **Project Settings →
Database**:

```bash
psql "$SUPABASE_DB_URL" -f supabase/seed.sql
```

…or just paste `seed.sql` into the dashboard SQL editor. Locally,
`supabase start && supabase db reset` runs the migrations *and* `seed.sql`
against the local Postgres in one step.

### 2.4 Authentication & account approval

The app is password-only (no magic links) with a "Create account" request
flow, gated by an in-app admin-approval queue at `/admin` — the real security
boundary is that approval step, not email verification, so **turn off
Authentication → Sign In / Providers → Email → "Confirm email"** in the
dashboard. With it on, every signup burns one send against Supabase's
built-in mailer, which caps at a very low rate meant for development, not
real signup volume; with it off, a new account lands straight on the pending
queue with no email round-trip at all. If you'd rather keep confirmation on,
you'll need a custom SMTP provider (SendGrid, Postmark, Resend, …) under
**Authentication → Emails → SMTP Settings** — still a Supabase dashboard
setting, not a separate system, but not required by anything else here.

New signups start `pending` in `public.specialists` with no role and **no
access to any data** (enforced by RLS, not just the UI). An admin reviews
requests at `/admin`, assigns one of the roles (Benefit Guide / Manager /
Specialist / Employee) or Reject, and can flip the `is_admin` flag on anyone
active from the same screen — that's how you'd hand admin rights to a second
person. Employee is for someone who needs signed-in access but shouldn't be a
schedulable resource: they're automatically excluded from the capacity board
and every Guide/Manager/specialist picker.

**Bootstrapping the first admin**: creating an actual login has to go through
Supabase's Admin API, not plain SQL. Copy the **service_role** secret from
**Project Settings → API** into `.env.local` as `SUPABASE_SERVICE_ROLE_KEY`
(never prefix it with `VITE_` — it must never reach the browser), then run:

```bash
node scripts/seed-admin.mjs you@yourcompany.com <a-real-password>
```

This creates the auth user and marks their roster row `active` + `is_admin`.
Change the password after first login if you used a placeholder one.

### 2.5 Pre-provisioning roster rows

You can still add a `public.specialists` row ahead of time (Table Editor, or
via `seed.sql`) with an email and no `user_id` — when that person signs up
with a matching address, the trigger claims the row and marks it `active`
immediately, skipping the approval queue. This is the "we already know who
you are" path; anyone who signs up without a matching row goes through
`/admin` instead. Replace the `@planstin.com` addresses in
`supabase/seed.sql` with your team's real addresses before relying on this,
or edit the rows afterwards in the Table Editor.

### 2.6 Row-level security

RLS is enabled on every table. `0001_init.sql`'s policies are a sensible
first pass: any authenticated user can read the whole book of business, and
writes are narrowed to the rows a person is expected to own (managers get
broader write access). `0002_account_approval.sql` narrows all of that to
`active` accounts only — pending/rejected accounts can read nothing but
their own roster row and can't write anywhere. **None of this has had a
professional security review.** Read it against your actual roles before the
tables hold real client data.

---

## 3. Deploy

The app is a static SPA — any static host works. Two things matter: the two
`VITE_` variables must be set at *build* time (Vite inlines them), and the host
must rewrite unknown paths to `index.html` so deep links like `/groups/abc`
work.

**Vercel**

1. Import the repository. Framework preset: **Vite**. Build command
   `npm run build`, output directory `dist`.
2. **Settings → Environment Variables**: add `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY` for Production (and Preview, if you want previews
   hitting the same project).
3. SPA rewrites are automatic for the Vite preset. If deep links 404, add a
   `vercel.json` with a rewrite of `/(.*)` to `/index.html`.

**Netlify**

1. Build command `npm run build`, publish directory `dist`.
2. **Site settings → Environment variables**: add the same two variables.
3. Add a `public/_redirects` file containing `/*  /index.html  200`.

Afterwards, add the deployed origin to Supabase's **Authentication → URL
Configuration** redirect list, in case you ever re-enable "Confirm email" or
add a password-reset flow — either would otherwise redirect back to
`localhost`.

---

## Project layout

```
src/
  main.tsx              entry point — mounts <App> into #root
  App.tsx               providers (Query, Auth, Data, Ui) + routes + auth gates
  auth/AuthProvider     Supabase session, password sign-in / signup
  data/
    DataProvider.tsx    one AppData object in a TanStack Query cache; optimistic
                        writes that fan out to Supabase, or to localStorage in
                        demo mode
    repository.ts       Supabase <-> app-model mapping (read + diffed writes),
                        plus the admin approve/reject/role/is_admin writes
    demoData.ts         bundled seed used when Supabase is not configured
  lib/
    capacity.ts         scheduling/capacity domain logic
    dates.ts            ISO-date helpers (local-time safe)
    constants.ts        checklist/plan/tier vocabularies, role labels
  screens/              SignIn, PendingApproval, Admin, Calendar, Board,
                        Groups, GroupDetail
  components/           AppShell, WeekBand, primitives, overlays/
  styles/theme.css      design tokens + .btn/.input/.tbl primitives
supabase/
  migrations/           0001_init.sql, then 0002+ (account approval, roles)
  seed.sql
scripts/
  seed-admin.mjs        one-off: create the first admin login (see 2.4)
```

The data layer is deliberately one denormalised `AppData` object (people,
groups, closeouts) because every screen cross-references the whole book of
business. `repository.ts` assembles it from the normalised tables and diffs a
group against its previous version on save so only touched child rows move.
