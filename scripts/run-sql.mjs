// Run a .sql file against the linked Supabase project.
//
// Usage:
//   node scripts/run-sql.mjs supabase/migrations/0006_group_book_fields.sql
//   node scripts/run-sql.mjs supabase/seed_real.sql
//
// Reads SUPABASE_POOLER_URL (preferred) or SUPABASE_DB_URL from .env.local.
// The whole file runs inside ONE transaction — any error rolls the lot back,
// so a half-applied wipe is not a state this can leave you in.
//
// Why the pooler: db.<ref>.supabase.co publishes no A record (IPv6-only), so a
// direct connection fails from most machines. aws-0-<region>.pooler.supabase.com
// is IPv4 and, on port 5432 (session mode), supports DDL and transactions.

import { readFileSync, existsSync } from 'node:fs';
import pg from 'pg';

function loadEnvLocal() {
  const path = new URL('../.env.local', import.meta.url);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}
loadEnvLocal();

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const file = args.find((a) => !a.startsWith('--'));
if (!file) {
  console.error('usage: node scripts/run-sql.mjs [--dry-run] <file.sql>');
  console.error('  --dry-run  execute everything, print the results, then ROLL BACK');
  process.exit(1);
}
if (!existsSync(file)) {
  console.error(`no such file: ${file}`);
  process.exit(1);
}

const conn = process.env.SUPABASE_POOLER_URL || process.env.SUPABASE_DB_URL;
if (!conn) {
  console.error('SUPABASE_POOLER_URL or SUPABASE_DB_URL must be set (.env.local)');
  process.exit(1);
}

const sql = readFileSync(file, 'utf8');
const client = new pg.Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });

const host = new URL(conn).host;
console.log(`→ ${file} (${(sql.length / 1024).toFixed(1)} KB) against ${host}`);

try {
  await client.connect();
} catch (err) {
  console.error(`connection failed: ${err.message}`);
  console.error('\nFallback: paste the file into the Supabase dashboard SQL editor');
  console.error('(README §2.3).');
  process.exit(1);
}

const started = Date.now();
try {
  await client.query('begin');
  // node-postgres sends a multi-statement string as one simple-query batch;
  // results come back as an array, one entry per statement.
  const res = await client.query(sql);
  await client.query(dryRun ? 'rollback' : 'commit');

  const results = Array.isArray(res) ? res : [res];
  for (const r of results) {
    if (r.command && r.rowCount !== null && r.rowCount !== undefined) {
      console.log(`   ${r.command} ${r.rowCount}`);
    }
    if (r.rows?.length) console.table(r.rows);
  }
  console.log(
    dryRun
      ? `✓ dry run OK in ${((Date.now() - started) / 1000).toFixed(1)}s — ROLLED BACK, nothing changed`
      : `✓ committed in ${((Date.now() - started) / 1000).toFixed(1)}s`,
  );
} catch (err) {
  await client.query('rollback').catch(() => {});
  console.error(`✗ rolled back: ${err.message}`);
  if (err.position) {
    const upto = sql.slice(0, Number(err.position));
    const line = upto.split('\n').length;
    console.error(`   at line ${line}: ${sql.split('\n')[line - 1]?.trim().slice(0, 120)}`);
  }
  process.exitCode = 1;
} finally {
  await client.end();
}
