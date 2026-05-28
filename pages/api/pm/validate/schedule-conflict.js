// POST /api/pm/validate/schedule-conflict
// Body: { asset_id: uuid, scheduled_date: 'YYYY-MM-DD', exclude_id?: uuid }
// Returns: { conflict: bool, conflicts: [...], severity: 'none'|'warning'|'conflict' }
//
// Validates whether a proposed PM schedule conflicts with existing pending/in_progress
// schedules on the same asset and date. Also flags overlap with non-completed BM events
// on the same asset (treated as severity='warning' since BM blocks asset availability).

import { supabaseAdmin } from '../../../../lib/supabase-admin';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method not allowed' });
  }

  const { asset_id, scheduled_date, exclude_id } = req.body || {};

  if (!asset_id || !scheduled_date) {
    return res.status(400).json({
      error: { message: 'asset_id and scheduled_date are required', fields: ['asset_id', 'scheduled_date'] },
    });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduled_date)) {
    return res.status(400).json({
      error: { message: 'scheduled_date must be YYYY-MM-DD', field: 'scheduled_date' },
    });
  }

  // 1) Existing PM schedules on same asset+date that are still active
  let q = supabaseAdmin
    .from('pm_schedules')
    .select('id, plan_id, asset_id, scheduled_date, status, notes')
    .eq('asset_id', asset_id)
    .eq('scheduled_date', scheduled_date)
    .in('status', ['pending', 'in_progress']);

  if (exclude_id) q = q.neq('id', exclude_id);

  const pmRes = await q;
  if (pmRes.error) return res.status(500).json({ error: pmRes.error.message });
  const pmConflicts = pmRes.data || [];

  // 2) Active BM events on same asset (any non-resolved). BM table name 'bm_events'.
  // If column 'status' exists, filter; otherwise treat all matches as warnings.
  const bmRes = await supabaseAdmin
    .from('bm_events')
    .select('id, asset_id, status, occurred_at, resolved_at')
    .eq('asset_id', asset_id)
    .is('resolved_at', null);

  const bmWarnings = bmRes.error ? [] : (bmRes.data || []);

  const conflict = pmConflicts.length > 0;
  const warning = !conflict && bmWarnings.length > 0;
  const severity = conflict ? 'conflict' : warning ? 'warning' : 'none';

  return res.json({
    conflict,
    severity,
    pm_conflicts: pmConflicts,
    bm_warnings: bmWarnings,
    checked_at: new Date().toISOString(),
  });
}
