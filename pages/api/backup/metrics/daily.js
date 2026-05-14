// GET /api/backup/metrics/daily — paginated daily metrics for caller.
//
// Query:
//   start_date? YYYY-MM-DD (inclusive)
//   end_date?   YYYY-MM-DD (inclusive)
//   limit?      1..365 (default 30)
//   offset?     >=0     (default 0)
//
// Order: metric_date desc (latest first — per Auto-status / sort-order rule).
//
// Auth: Bearer JWT (user).

import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { requireUser } from '../../../../lib/career-auth';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const { user, error: authErr } = await requireUser(req);
  if (authErr) return res.status(authErr.status).json(authErr.body);

  const errors = [];
  const { start_date, end_date } = req.query;
  let limit = Number(req.query.limit ?? 30);
  let offset = Number(req.query.offset ?? 0);

  if (start_date && !DATE_RE.test(String(start_date))) errors.push('start_date must be YYYY-MM-DD');
  if (end_date && !DATE_RE.test(String(end_date))) errors.push('end_date must be YYYY-MM-DD');
  if (!Number.isInteger(limit) || limit < 1 || limit > 365) {
    errors.push('limit must be integer 1..365');
  }
  if (!Number.isInteger(offset) || offset < 0) {
    errors.push('offset must be non-negative integer');
  }
  if (errors.length) {
    return res.status(400).json({ error: 'invalid_request', details: errors });
  }

  try {
    let q = supabaseAdmin
      .from('backup_metrics')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('metric_date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (start_date) q = q.gte('metric_date', start_date);
    if (end_date) q = q.lte('metric_date', end_date);

    const { data, error, count } = await q;
    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({
      user_id: user.id,
      total: count ?? null,
      limit,
      offset,
      metrics: data || [],
    });
  } catch (e) {
    console.error('[metrics/daily] fatal', e);
    return res.status(500).json({ error: e?.message || 'internal_error' });
  }
}
