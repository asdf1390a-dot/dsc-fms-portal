// GET /api/assets/history
// Aggregated PM schedule and BM event history for assets.
//
// Query:
//   asset_id?  Filter by specific asset UUID (optional)
//   from_date? YYYY-MM-DD format (optional, defaults to 90 days ago)
//   to_date?   YYYY-MM-DD format (optional, defaults to today)
//   status?    Filter BM events by status (optional)
//   limit?     1..100 (default 20) — page size
//   offset?    >=0 (default 0) — pagination offset
//
// Response includes both PM schedules and BM events ordered by date (newest first).
// Aggregated at the asset level with pagination.
//
// Auth: Bearer JWT (user).

import { supabaseAdmin } from '../../../lib/supabase-admin';
import { requireUser } from '../../../lib/career-auth';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const { user, error: authErr } = await requireUser(req);
  if (authErr) return res.status(authErr.status).json(authErr.body);

  const { asset_id, from_date, to_date, status } = req.query;
  let limit = Number(req.query.limit ?? 20);
  let offset = Number(req.query.offset ?? 0);
  const errors = [];

  // Validate limit and offset
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    errors.push('limit must be integer 1..100');
  }
  if (!Number.isInteger(offset) || offset < 0) {
    errors.push('offset must be non-negative integer');
  }
  if (errors.length) {
    return res.status(400).json({ error: 'invalid_request', details: errors });
  }

  try {
    // Calculate date range (default: last 90 days)
    const now = new Date();
    const toDate = to_date
      ? new Date(to_date)
      : new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const fromDate = from_date
      ? new Date(from_date)
      : new Date(toDate.getTime() - 90 * 24 * 60 * 60 * 1000);

    const fromDateStr = fromDate.toISOString().split('T')[0];
    const toDateStr = toDate.toISOString().split('T')[0];
    const toDateEnd = new Date(toDate.getTime() + 24 * 60 * 60 * 1000).toISOString();

    // Query PM schedules
    let pmQuery = supabaseAdmin
      .from('pm_schedules')
      .select(`
        id,
        asset_id,
        plan_id,
        scheduled_date,
        status,
        completed_at,
        completed_by_name,
        actual_hours,
        notes,
        created_at,
        pm_plans(title, description, frequency_days, estimated_hours),
        assets(machine_asset_number, name_en, location)
      `)
      .gte('scheduled_date', fromDateStr)
      .lte('scheduled_date', toDateStr);

    if (asset_id) pmQuery = pmQuery.eq('asset_id', asset_id);

    const { data: pmData, error: pmError } = await pmQuery;
    if (pmError) return res.status(500).json({ error: pmError.message });

    // Query BM events
    let bmQuery = supabaseAdmin
      .from('bm_events')
      .select(`
        id,
        asset_id,
        description,
        status,
        reported_at,
        resolved_at,
        downtime_start,
        downtime_end,
        cause_code,
        priority,
        work_hours,
        created_at,
        assets(machine_asset_number, name_en, location)
      `)
      .gte('reported_at', fromDate.toISOString())
      .lte('reported_at', toDateEnd);

    if (asset_id) bmQuery = bmQuery.eq('asset_id', asset_id);
    if (status) bmQuery = bmQuery.eq('status', status);

    const { data: bmData, error: bmError } = await bmQuery;
    if (bmError) return res.status(500).json({ error: bmError.message });

    // Normalize and merge data
    const pmEvents = (pmData || []).map((pm) => ({
      type: 'PM',
      id: pm.id,
      asset_id: pm.asset_id,
      asset_number: pm.assets?.machine_asset_number,
      asset_name: pm.assets?.name_en,
      location: pm.assets?.location,
      date: pm.scheduled_date,
      timestamp: new Date(pm.scheduled_date + 'T00:00:00Z'),
      title: pm.pm_plans?.title,
      description: pm.pm_plans?.description,
      status: pm.status,
      completed_at: pm.completed_at,
      completed_by_name: pm.completed_by_name,
      actual_hours: pm.actual_hours,
      estimated_hours: pm.pm_plans?.estimated_hours,
      frequency_days: pm.pm_plans?.frequency_days,
      notes: pm.notes,
    }));

    const bmEvents = (bmData || []).map((bm) => ({
      type: 'BM',
      id: bm.id,
      asset_id: bm.asset_id,
      asset_number: bm.assets?.machine_asset_number,
      asset_name: bm.assets?.name_en,
      location: bm.assets?.location,
      date: bm.reported_at,
      timestamp: new Date(bm.reported_at),
      description: bm.description,
      status: bm.status,
      reported_at: bm.reported_at,
      resolved_at: bm.resolved_at,
      downtime_start: bm.downtime_start,
      downtime_end: bm.downtime_end,
      cause_code: bm.cause_code,
      priority: bm.priority,
      work_hours: bm.work_hours,
    }));

    // Merge and sort (newest first per sort-order rule for event logs)
    const allEvents = [...pmEvents, ...bmEvents].sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );

    // Apply pagination
    const totalCount = allEvents.length;
    const paginatedEvents = allEvents.slice(offset, offset + limit);

    return res.status(200).json({
      success: true,
      user_id: user.id,
      date_range: {
        from: fromDateStr,
        to: toDateStr,
      },
      filter: {
        asset_id: asset_id || null,
        status: status || null,
      },
      pagination: {
        total: totalCount,
        limit,
        offset,
        returned: paginatedEvents.length,
      },
      history: paginatedEvents,
    });
  } catch (e) {
    console.error('[assets/history] fatal', e);
    return res.status(500).json({ error: e?.message || 'internal_error' });
  }
}
