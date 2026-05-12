// Server-side helper: extract authenticated user from Authorization Bearer token.
// Caller can rely on Supabase RLS for actual access control.
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function getUserFromRequest(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return { user: null, token: null };
  const client = createClient(url, anon, { auth: { persistSession: false } });
  const { data, error } = await client.auth.getUser(token);
  if (error) return { user: null, token };
  return { user: data?.user || null, token };
}

// Construct a per-request supabase client that forwards the user's JWT,
// so RLS policies for "authenticated" role apply correctly.
export function userScopedClient(token) {
  return createClient(url, anon, {
    auth: { persistSession: false },
    global: { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  });
}

export function isAdmin(user) {
  if (!user) return false;
  const role = user.user_metadata?.role || user.app_metadata?.role;
  return role === 'admin';
}
