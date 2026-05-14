// GET /api/assets/history?assetId=<uuid>&limit=20&offset=0
// Returns combined PM schedules + BM events for one asset.
// Response:
//   {
//     pmSchedules: [{ id, plan_id, scheduled_date, status, completed_at,
//                     completed_by_name, actual_hours, notes, title }],
//     bmEvents:    [{ id, symptom, status, priority, severity,
//                     reported_at, resolved_at, downtime_start, downtime_end,
//                     work_hours, cause_code }],
//     meta: { pmCount, bmCount, hasMorePm, hasMoreBm }
//   }
import { supabaseAdmin } from '../../../lib/supabase-admin';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });

  const assetId = (req.query.assetId || '').toString().trim();
  if (!assetId) return res.status(400).json({ error: 'assetId required' });

  const limit  = Math.min(parseInt(req.query.limit, 10) || 20, 100);
  const offset = parseInt(req.query.offset, 10) || 0;

  // PM schedules joined with pm_plans for title.
  const pmPromise = supabaseAdmin
    .from('pm_schedules')
    .select(
      'id, plan_id, scheduled_date, status, completed_at, completed_by_name, ' +
      'actual_hours, notes, pm_plans!inner(title, frequency_days)',
      { count: 'exact' },
    )
    .eq('asset_id', assetId)
    .order('scheduled_date', { ascending: false })
    .range(offset, offset + limit - 1);

  const bmPromise = supabaseAdmin
    .from('bm_events')
    .select(
      'id, symptom, status, priority, severity, reported_at, resolved_at, ' +
      'downtime_start, downtime_end, work_hours, cause_code',
      { count: 'exact' },
    )
    .eq('asset_id', assetId)
    .order('reported_at', { ascending: false })
    .range(offset, offset + limit - 1);

  const [pmRes, bmRes] = await Promise.all([pmPromise, bmPromise]);

  if (pmRes.error) return res.status(500).json({ error: 'pm: ' + pmRes.error.message });
  if (bmRes.error) return res.status(500).json({ error: 'bm: ' + bmRes.error.message });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const pmSchedules = (pmRes.data || []).map(r => {
    const sched = r.scheduled_date ? new Date(r.scheduled_date) : null;
    let derived = r.status;
    if (r.status === 'pending' && sched && sched < today) derived = 'overdue';
    return {
      id: r.id,
      plan_id: r.plan_id,
      title: r.pm_plans?.title || null,
      frequency_days: r.pm_plans?.frequency_days || null,
      scheduled_date: r.scheduled_date,
      status: r.status,
      derived_status: derived,
      completed_at: r.completed_at,
      completed_by_name: r.completed_by_name,
      actual_hours: r.actual_hours,
      notes: r.notes,
    };
  });

  const pmCount = pmRes.count || 0;
  const bmCount = bmRes.count || 0;

  return res.status(200).json({
    pmSchedules,
    bmEvents: bmRes.data || [],
    meta: {
      pmCount,
      bmCount,
      hasMorePm: offset + limit < pmCount,
      hasMoreBm: offset + limit < bmCount,
      limit,
      offset,
    },
  });
}
