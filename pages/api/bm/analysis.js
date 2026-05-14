import { supabaseAdmin } from '../../../lib/supabase-admin';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const month = req.query.month; // YYYY-MM format
    const assetId = req.query.asset_id;

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: 'month query parameter required (YYYY-MM format)' });
    }

    // Get the start and end of the month
    const [year, monthNum] = month.split('-').map(Number);
    const startOfMonth = new Date(year, monthNum - 1, 1).toISOString();
    const endOfMonth = new Date(year, monthNum, 0, 23, 59, 59).toISOString();

    // Base query for the month
    let q = supabaseAdmin
      .from('bm_events')
      .select('id, asset_id, reported_at, resolved_at, severity, priority, status, downtime_start, downtime_end, work_hours, assets(id, machine_asset_number, name_en)')
      .gte('reported_at', startOfMonth)
      .lte('reported_at', endOfMonth);

    if (assetId) {
      q = q.eq('asset_id', assetId);
    }

    const { data: events, error } = await q;

    if (error) return res.status(500).json({ error: error.message });

    // Aggregate statistics
    const stats = {
      month,
      totalBreakdowns: events.length,
      resolvedCount: events.filter(e => e.status === 'resolved').length,
      openCount: events.filter(e => e.status === 'open').length,
      inProgressCount: events.filter(e => e.status === 'in_progress').length,
      pendingPartsCount: events.filter(e => e.status === 'pending_parts').length,
      bySeverity: {
        critical: events.filter(e => e.severity === 'line_down').length,
        high: events.filter(e => e.severity === 'major').length,
        medium: events.filter(e => e.severity === 'normal').length,
        low: events.filter(e => e.severity === 'minor').length,
      },
      byPriority: {
        critical: events.filter(e => e.priority === 'critical').length,
        high: events.filter(e => e.priority === 'high').length,
        medium: events.filter(e => e.priority === 'medium').length,
        low: events.filter(e => e.priority === 'low').length,
      },
      averageDowntimeMinutes: 0,
      totalDowntimeMinutes: 0,
      averageWorkHours: 0,
      totalWorkHours: 0,
      byAsset: {},
    };

    // Calculate downtime and work hours
    let downtimeSum = 0;
    let downtimeCount = 0;
    let workHoursSum = 0;
    let workHoursCount = 0;

    events.forEach(evt => {
      // Calculate downtime if both start and end are available
      if (evt.downtime_start && evt.downtime_end) {
        const downtime = (new Date(evt.downtime_end) - new Date(evt.downtime_start)) / (1000 * 60);
        downtimeSum += downtime;
        downtimeCount += 1;
      } else if (evt.reported_at && evt.resolved_at) {
        // Fallback: use reported→resolved time
        const downtime = (new Date(evt.resolved_at) - new Date(evt.reported_at)) / (1000 * 60);
        downtimeSum += downtime;
        downtimeCount += 1;
      }

      // Sum work hours
      if (evt.work_hours) {
        workHoursSum += evt.work_hours;
        workHoursCount += 1;
      }

      // Group by asset
      if (evt.asset_id) {
        if (!stats.byAsset[evt.asset_id]) {
          stats.byAsset[evt.asset_id] = {
            assetNumber: evt.assets?.machine_asset_number,
            assetName: evt.assets?.name_en,
            count: 0,
            resolved: 0,
            open: 0,
          };
        }
        stats.byAsset[evt.asset_id].count += 1;
        if (evt.status === 'resolved') stats.byAsset[evt.asset_id].resolved += 1;
        if (evt.status === 'open') stats.byAsset[evt.asset_id].open += 1;
      }
    });

    if (downtimeCount > 0) {
      stats.averageDowntimeMinutes = Math.round(downtimeSum / downtimeCount);
    }
    stats.totalDowntimeMinutes = Math.round(downtimeSum);

    if (workHoursCount > 0) {
      stats.averageWorkHours = Math.round((workHoursSum / workHoursCount) * 100) / 100;
    }
    stats.totalWorkHours = Math.round(workHoursSum * 100) / 100;

    return res.json(stats);
  }

  return res.status(405).json({ error: 'method not allowed' });
}
