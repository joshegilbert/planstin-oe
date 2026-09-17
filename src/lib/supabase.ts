import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * True when both env vars are present. Everything in the app branches on this:
 * without a Supabase project the app runs on bundled demo data persisted to
 * localStorage, so `npm run dev` works before the backend exists.
 */
export const SUPABASE_ENABLED = Boolean(url && anonKey);

export const USING_DEMO_DATA = !SUPABASE_ENABLED;

export const supabase: SupabaseClient | null = SUPABASE_ENABLED
  ? createClient(url as string, anonKey as string, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

if (USING_DEMO_DATA && typeof console !== 'undefined') {
  console.info(
    '[Planstin OE] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set — ' +
      'running on demo data. Edits persist to localStorage only. See README.md.',
  );
}
