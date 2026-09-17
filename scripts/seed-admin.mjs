// Create — or repair — an admin account.
//
// Usage:
//   node scripts/seed-admin.mjs <email> <password>
//
// Requires VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local (the
// service_role key, never the anon key — it bypasses RLS entirely, so never
// commit it or ship it to the browser).
//
// Safe to re-run, and the re-run is the point: if the auth user already exists
// its password is RESET to the one given, so this doubles as the way back in
// when nobody remembers the password. The specialists row is upserted either
// way, preserving whatever name and role the roster already has.

import { readFileSync, existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function loadEnvLocal() {
  const path = new URL('../.env.local', import.meta.url);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}
loadEnvLocal();

const [, , email, password] = process.argv;
if (!email || !password) {
  console.error('usage: node scripts/seed-admin.mjs <email> <password>');
  process.exit(1);
}

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (.env.local)');
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

let userId;
const { data: created, error: createErr } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});

if (createErr) {
  if (!/already been registered|already exists/i.test(createErr.message)) {
    console.error('createUser failed:', createErr.message);
    process.exit(1);
  }
  console.log(`Auth user for ${email} already exists — looking it up.`);
  let page = 1;
  const perPage = 200;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      console.error('listUsers failed:', error.message);
      process.exit(1);
    }
    const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (match) {
      userId = match.id;
      break;
    }
    if (data.users.length < perPage) break;
    page += 1;
  }
  if (!userId) {
    console.error(`Could not find an existing auth user for ${email}`);
    process.exit(1);
  }
  const { error: pwErr } = await admin.auth.admin.updateUserById(userId, {
    password,
    email_confirm: true,
  });
  if (pwErr) {
    console.error('password reset failed:', pwErr.message);
    process.exit(1);
  }
  console.log(`Password for ${email} reset.`);
} else {
  userId = created.user.id;
  console.log(`Created auth user ${email} (${userId}).`);
}

// The sign-up trigger (handle_new_user) only runs on INSERT into auth.users,
// so for a brand-new user it has already created a pending specialists row
// linked to this user_id — either freshly inserted, or a pre-provisioned roster
// row claimed by matching email. Either way, look it up so the name and role the
// roster already carries survive being promoted to admin.
const { data: existing } = await admin
  .from('specialists')
  .select('name, role')
  .eq('email', email)
  .maybeSingle();

const fallbackName = email
  .split('@')[0]
  .split(/[._-]+/)
  .filter(Boolean)
  .map((w) => w[0].toUpperCase() + w.slice(1))
  .join(' ');

const { data: upserted, error: upsertErr } = await admin
  .from('specialists')
  .upsert(
    {
      user_id: userId,
      email,
      name: existing?.name || fallbackName,
      // An admin needs a role to be 'active' at all (migration 0003). Manager is
      // the widest one, and matches what a first admin is in practice.
      role: existing?.role || 'Manager',
      account_status: 'active',
      is_admin: true,
    },
    { onConflict: 'user_id' },
  )
  .select()
  .single();

if (upsertErr) {
  console.error('specialists upsert failed:', upsertErr.message);
  process.exit(1);
}

console.log('Admin specialists row ready:', {
  id: upserted.id,
  email: upserted.email,
  role: upserted.role,
  account_status: upserted.account_status,
  is_admin: upserted.is_admin,
});
