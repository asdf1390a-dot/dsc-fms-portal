// GET /api/audit/logs — retrieve audit logs for dashboard display
//
// Query params:
//   audit_name   — filter by audit name (optional)
//   status       — filter by status: pass | warn | fail | error (optional)
//   since        — ISO timestamp, return logs run_at >= since (optional)
//   limit        — page size, 1..500 (default 100)
//   offset       — pagination offset (default 0)
//
// Phase 1: audit_logs table (see db/33_audit_system_phase1.sql).
// Auth: Bearer JWT (user); service-role used server-side to bypass RLS.

import { supabaseAdmin } from '../../../lib/supabase-admin';
import { requireUser } from '../../../lib/career-auth';

const STATUSES = new Set(['pass', 'warn', 'fail', 'error']);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const { user, error: authErr } = await requireUser(req);
  if (authErr) return res.status(authErr.status).json(authErr.body);

  const { audit_name, status, since } = req.query;

  let limit = Number(req.query.limit ?? 100);
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) limit = 100;

  let offset = Number(req.query.offset ?? 0);
  if (!Number.isInteger(offset) || offset < 0) offset = 0;

  if (status !== undefined && !STATUSES.has(String(status))) {
    return res.status(400).json({ error: 'invalid_status', allowed: Array.from(STATUSES) });
  }

  if (since !== undefined && Number.isNaN(Date.parse(String(since)))) {
    return res.status(400).json({ error: 'invalid_since', message: 'since must be ISO timestamp' });
  }

  let query = supabaseAdmin
    .from('audit_logs')
    .select('*', { count: 'exact' })
    .eq('owner_id', user.id)
    .order('run_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (audit_name) query = query.eq('audit_name', String(audit_name));
  if (status) query = query.eq('status', String(status));
  if (since) query = query.gte('run_at', String(since));

  const { data, error, count } = await query;
  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({
    logs: data || [],
    total: count ?? 0,
    limit,
    offset,
  });
}
