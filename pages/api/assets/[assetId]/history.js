// GET /api/assets/[assetId]/history
// Fetch PM and BM history for a specific asset.
// Used by PmBmBadge component to display latest PM/BM status.
//
// Query:
//   limit?     1..100 (default 1) — page size
//   from_date? YYYY-MM-DD format (optional, defaults to 90 days ago)
//   to_date?   YYYY-MM-DD format (optional, defaults to today)
//
// Response includes pmSchedules (PM events) and bmEvents (BM events) from the asset.

import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { requireUser } from '../../../../lib/career-auth';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const { user, error: authErr } = await requireUser(req);
  if (authErr) return res.status(authErr.status).json(authErr.body);

  const { assetId } = req.query;
  const { from_date, to_date } = req.query;
  let limit = Number(req.query.limit ?? 1);

  if (!assetId) {
    return res.status(400).json({ error: 'assetId is required' });
  }

  // Validate limit
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    return res.status(400).json({ error: 'limit must be integer 1..100' });
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
    const { data: pmData, error: pmError } = await supabaseAdmin
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
      .eq('asset_id', assetId)
      .gte('scheduled_date', fromDateStr)
      .lte('scheduled_date', toDateStr)
      .order('scheduled_date', { ascending: false })
      .limit(limit);

    if (pmError) return res.status(500).json({ error: pmError.message });

    // Query BM events
    const { data: bmData, error: bmError } = await supabaseAdmin
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
      .eq('asset_id', assetId)
      .gte('reported_at', fromDate.toISOString())
      .lte('reported_at', toDateEnd)
      .order('reported_at', { ascending: false })
      .limit(limit);

    if (bmError) return res.status(500).json({ error: bmError.message });

    // Derive PM status for each schedule
    const pmSchedules = (pmData || []).map((pm) => {
      let derived_status = 'Scheduled';
      if (pm.completed_at) {
        derived_status = 'Completed';
      } else if (new Date(pm.scheduled_date) < new Date()) {
        derived_status = 'Overdue';
      }

      return {
        id: pm.id,
        asset_id: pm.asset_id,
        asset_number: pm.assets?.machine_asset_number,
        asset_name: pm.assets?.name_en,
        location: pm.assets?.location,
        schedule_date: pm.scheduled_date,
        title: pm.pm_plans?.title,
        description: pm.pm_plans?.description,
        status: pm.status,
        completed_at: pm.completed_at,
        completed_by_name: pm.completed_by_name,
        actual_hours: pm.actual_hours,
        estimated_hours: pm.pm_plans?.estimated_hours,
        frequency_days: pm.pm_plans?.frequency_days,
        notes: pm.notes,
        derived_status,
      };
    });

    const bmEvents = (bmData || []).map((bm) => ({
      id: bm.id,
      asset_id: bm.asset_id,
      asset_number: bm.assets?.machine_asset_number,
      asset_name: bm.assets?.name_en,
      location: bm.assets?.location,
      failure_date: bm.reported_at,
      description: bm.description,
      equipment_affected: bm.assets?.name_en,
      failure_description: bm.description,
      status: bm.status,
      reported_at: bm.reported_at,
      resolved_at: bm.resolved_at,
      downtime_start: bm.downtime_start,
      downtime_end: bm.downtime_end,
      cause_code: bm.cause_code,
      priority: bm.priority,
      work_hours: bm.work_hours,
    }));

    return res.status(200).json({
      success: true,
      user_id: user.id,
      asset_id: assetId,
      pmSchedules,
      bmEvents,
      meta: {
        hasMore: {
          pm: (pmData || []).length >= limit,
          bm: (bmData || []).length >= limit,
        },
      },
    });
  } catch (e) {
    console.error('[assets/[assetId]/history] fatal', e);
    return res.status(500).json({ error: e?.message || 'internal_error' });
  }
}
