// Server-side helper: extract Supabase user from Bearer token.
// Returns { user, error } where error is { status, body } on failure.
import { supabaseAdmin } from './supabase-admin';

export async function requireUser(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return { user: null, error: { status: 401, body: { error: 'missing_token' } } };
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return { user: null, error: { status: 401, body: { error: 'invalid_token' } } };
  return { user: data.user, error: null };
}
