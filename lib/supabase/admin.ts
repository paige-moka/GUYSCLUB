import 'server-only';
import { createClient } from '@supabase/supabase-js';

/** Service key client. Bypasses Row Level Security, so it is used ONLY for inviting people and verified Stripe events. */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
