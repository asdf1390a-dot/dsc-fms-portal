// GET /api/assets/stats
// Aggregated PM/BM statistics for assets.
// Calculates: compliance rate, MTTR, MTBF, uptime %, last service dates.
//
// Query:
//   asset_id?  Filter by specific asset UUID (optional)
//   from_date? YYYY-MM-DD format (optional, defaults to 90 days ago)
//   to_date?   YYYY-MM-DD format (optional, defaults to today)
//
// Response includes aggregated KPIs per asset.
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

  const { asset_id, from_date, to_date } = req.query;

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

    // Get all assets (or filtered asset)
    let assetsQuery = supabaseAdmin
      .from('assets')
      .select('id, machine_asset_number, name_en, location');

    if (asset_id) assetsQuery = assetsQuery.eq('id', asset_id);

    const { data: assets, error: assetsError } = await assetsQuery;
    if (assetsError) return res.status(500).json({ error: assetsError.message });

    // Query PM schedules in date range
    let pmQuery = supabaseAdmin
      .from('pm_schedules')
      .select('asset_id, status, scheduled_date, completed_at, pm_plans(frequency_days, estimated_hours)')
      .gte('scheduled_date', fromDateStr)
      .lte('scheduled_date', toDateStr);

    if (asset_id) pmQuery = pmQuery.eq('asset_id', asset_id);

    const { data: pmData, error: pmError } = await pmQuery;
    if (pmError) return res.status(500).json({ error: pmError.message });

    // Query BM events in date range
    let bmQuery = supabaseAdmin
      .from('bm_events')
      .select('asset_id, status, reported_at, resolved_at, downtime_start, downtime_end, work_hours')
      .gte('reported_at', fromDate.toISOString())
      .lte('reported_at', toDateEnd);

    if (asset_id) bmQuery = bmQuery.eq('asset_id', asset_id);

    const { data: bmData, error: bmError } = await bmQuery;
    if (bmError) return res.status(500).json({ error: bmError.message });

    // Calculate stats per asset
    const stats = assets.map((asset) => {
      // Filter data for this asset
      const assetPM = pmData.filter((pm) => pm.asset_id === asset.id) || [];
      const assetBM = bmData.filter((bm) => bm.asset_id === asset.id) || [];

      // --- PM Compliance Rate ---
      const pmScheduled = assetPM.length;
      const pmCompleted = assetPM.filter((pm) => pm.status === 'completed').length;
      const pmComplianceRate =
        pmScheduled > 0 ? ((pmCompleted / pmScheduled) * 100).toFixed(1) : null;

      // --- Last PM Date ---
      const lastPM = assetPM
        .sort((a, b) => new Date(b.scheduled_date) - new Date(a.scheduled_date))
        .find((pm) => pm.status === 'completed');
      const lastPMDate = lastPM?.completed_at ? lastPM.completed_at.split('T')[0] : null;

      // --- Last BM Date ---
      const lastBM = assetBM.sort((a, b) => new Date(b.reported_at) - new Date(a.reported_at))[0];
      const lastBMDate = lastBM?.reported_at ? lastBM.reported_at.split('T')[0] : null;

      // --- MTTR (Mean Time To Repair) in minutes ---
      const resolvedBM = assetBM.filter((bm) => bm.status === 'resolved');
      let mttrMinutes = null;
      if (resolvedBM.length > 0) {
        const totalRepairTimeMs = resolvedBM.reduce((sum, bm) => {
          // Use actual downtime if available, else use reported→resolved
          const startTime = new Date(bm.downtime_start || bm.reported_at);
          const endTime = new Date(bm.downtime_end || bm.resolved_at);
          return sum + (endTime - startTime);
        }, 0);
        mttrMinutes = (totalRepairTimeMs / 1000 / 60 / resolvedBM.length).toFixed(2);
      }

      // --- MTBF (Mean Time Between Failures) in hours ---
      // MTBF = (Total operating hours in period) / (Number of failures)
      // Approximation: assume 24h/day operating, calculate from date range
      const periodDays = (toDate - fromDate) / (1000 * 60 * 60 * 24);
      const totalOperatingHours = periodDays * 24;
      let mtbfHours = null;
      if (assetBM.length > 0) {
        mtbfHours = (totalOperatingHours / assetBM.length).toFixed(2);
      }

      // --- Uptime Percentage ---
      // Approximation: (Total Hours - Total Downtime Hours) / Total Hours * 100
      let uptimePercent = null;
      if (assetBM.length > 0) {
        let totalDowntimeMs = 0;
        assetBM.forEach((bm) => {
          const startTime = new Date(bm.downtime_start || bm.reported_at);
          const endTime = new Date(bm.downtime_end || bm.resolved_at);
          totalDowntimeMs += endTime - startTime;
        });
        const totalDowntimeHours = totalDowntimeMs / 1000 / 60 / 60;
        uptimePercent = ((1 - totalDowntimeHours / totalOperatingHours) * 100).toFixed(2);
        // Clamp to 0-100
        uptimePercent = Math.max(0, Math.min(100, parseFloat(uptimePercent))).toFixed(2);
      } else {
        // No breakdowns = 100% uptime
        uptimePercent = '100.00';
      }

      // --- BM Event Count by Status ---
      const bmByStatus = {
        open: assetBM.filter((bm) => bm.status === 'open').length,
        in_progress: assetBM.filter((bm) => bm.status === 'in_progress').length,
        pending_parts: assetBM.filter((bm) => bm.status === 'pending_parts').length,
        resolved: assetBM.filter((bm) => bm.status === 'resolved').length,
        cancelled: assetBM.filter((bm) => bm.status === 'cancelled').length,
      };
      const totalBMEvents = assetBM.length;

      return {
        asset_id: asset.id,
        asset_number: asset.machine_asset_number,
        asset_name: asset.name_en,
        location: asset.location,
        pm: {
          scheduled: pmScheduled,
          completed: pmCompleted,
          compliance_rate_percent: pmComplianceRate,
          last_pm_date: lastPMDate,
        },
        bm: {
          total_events: totalBMEvents,
          events_by_status: bmByStatus,
          last_bm_date: lastBMDate,
        },
        kpi: {
          mttr_minutes: mttrMinutes,
          mtbf_hours: mtbfHours,
          uptime_percent: uptimePercent,
        },
      };
    });

    return res.status(200).json({
      success: true,
      user_id: user.id,
      date_range: {
        from: fromDateStr,
        to: toDateStr,
      },
      filter: {
        asset_id: asset_id || null,
      },
      stats,
    });
  } catch (e) {
    console.error('[assets/stats] fatal', e);
    return res.status(500).json({ error: e?.message || 'internal_error' });
  }
}
