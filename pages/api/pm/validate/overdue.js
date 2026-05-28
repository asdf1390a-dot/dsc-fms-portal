// GET /api/pm/validate/overdue
// Query: ?as_of=YYYY-MM-DD (default today) &limit=100 &offset=0 &asset_id=uuid (optional)
// Returns: { count, items: [{ id, plan_id, asset_id, scheduled_date, days_overdue, status }], as_of }
//
// Lists PM schedules whose scheduled_date is before `as_of` and status is still pending or
// in_progress. Used by the maintenance validation dashboard to flag SLA breaches.

import { supabaseAdmin } from '../../../../lib/supabase-admin';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'method not allowed' });
  }

  const asOfRaw = (req.query.as_of || '').toString();
  const asOf = /^\d{4}-\d{2}-\d{2}$/.test(asOfRaw)
    ? asOfRaw
    : new Date().toISOString().slice(0, 10);

  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
  const assetId = (req.query.asset_id || '').toString();

  let q = supabaseAdmin
    .from('pm_schedules')
    .select('id, plan_id, asset_id, scheduled_date, status, notes, created_at', { count: 'exact' })
    .lt('scheduled_date', asOf)
    .in('status', ['pending', 'in_progress'])
    .order('scheduled_date', { ascending: true })
    .range(offset, offset + limit - 1);

  if (assetId) q = q.eq('asset_id', assetId);

  const { data, error, count } = await q;
  if (error) return res.status(500).json({ error: error.message });

  const asOfMs = new Date(asOf + 'T00:00:00Z').getTime();
  const items = (data || []).map((r) => {
    const schedMs = new Date(r.scheduled_date + 'T00:00:00Z').getTime();
    const daysOverdue = Math.max(0, Math.floor((asOfMs - schedMs) / 86400000));
    let severity = 'low';
    if (daysOverdue >= 30) severity = 'critical';
    else if (daysOverdue >= 14) severity = 'high';
    else if (daysOverdue >= 7) severity = 'medium';
    return { ...r, days_overdue: daysOverdue, severity };
  });

  return res.json({
    as_of: asOf,
    count: count ?? items.length,
    limit,
    offset,
    items,
  });
}
