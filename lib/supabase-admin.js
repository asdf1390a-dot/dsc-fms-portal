// Server-side only. Uses service_role key. NEVER import in client components.
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const sr  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (typeof window !== 'undefined') {
  throw new Error('supabase-admin must not be imported on the client');
}

export const supabaseAdmin = createClient(url, sr, {
  auth: { autoRefreshToken: false, persistSession: false },
});
