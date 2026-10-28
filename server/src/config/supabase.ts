import { createClient } from '@supabase/supabase-js';
import { env } from './env';

if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
}

// Service-role client: bypasses Row Level Security, so it must only ever live on
// the server. Never send this key to the Angular client.
export const supabase = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
