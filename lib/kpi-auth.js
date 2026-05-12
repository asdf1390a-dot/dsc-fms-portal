// Server-side: admin check for KPI write APIs.
// Returns { user, isAdmin, error } where error is { status, body } on failure.
import { supabaseAdmin } from './supabase-admin';
import { requireUser } from './career-auth';

export async function requireUserWithAdmin(req) {
  const { user, error } = await requireUser(req);
  if (error) return { user: null, isAdmin: false, error };

  const { data, error: pErr } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();
  if (pErr) {
    return { user, isAdmin: false, error: { status: 500, body: { error: pErr.message } } };
  }
  const isAdmin = data?.role === 'admin';
  return { user, isAdmin, error: null };
}

export async function requireAdmin(req) {
  const { user, isAdmin, error } = await requireUserWithAdmin(req);
  if (error) return { user: null, error };
  if (!isAdmin) return { user, error: { status: 403, body: { error: 'admin_only' } } };
  return { user, error: null };
}

// Normalize "YYYY-MM" or "YYYY-MM-DD" → "YYYY-MM-01"
export function normMonth(m) {
  if (!m) return null;
  const s = String(m);
  const match = s.match(/^(\d{4})-(\d{2})/);
  if (!match) return null;
  return `${match[1]}-${match[2]}-01`;
}
