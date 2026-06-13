// GET /api/bm/stats
// Monthly KPI roll-up across breakdown_reports.
// Query params:
//   month=YYYY-MM   (defaults to current month UTC)
//
// Response:
// {
//   month,
//   resolved_count,
//   open_count,
//   total_count,
//   avg_mttr_minutes,
//   avg_mtbf_hours,
//   severity_distribution: { minor, normal, major, line_down },
//   escalated_count
// }

import { supabaseAdmin } from '../../../lib/supabase-admin';

function monthRange(monthStr) {
  let year, month;
  if (monthStr && /^\d{4}-\d{2}$/.test(monthStr)) {
    [year, month] = monthStr.split('-').map(Number);
  } else {
    const d = new Date();
    year = d.getUTCFullYear();
    month = d.getUTCMonth() + 1;
  }
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return {
    start: start.toISOString(),
    end: end.toISOString(),
    label: `${year}-${String(month).padStart(2, '0')}`,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const { start, end, label } = monthRange(req.query.month);

  const { data, error } = await supabaseAdmin
    .from('breakdown_reports')
    .select('id, status, severity, duration_minutes, reported_at, escalated, deleted_at')
    .is('deleted_at', null)
    .gte('reported_at', start)
    .lt('reported_at', end);

  if (error) return res.status(500).json({ error: error.message });

  const rows = data || [];
  let resolvedCount = 0, openCount = 0, escalatedCount = 0;
  let mttrSum = 0, mttrN = 0;
  const sev = { minor: 0, normal: 0, major: 0, line_down: 0 };
  const reportedTimes = [];

  for (const r of rows) {
    if (r.status === 'resolved') resolvedCount++; else openCount++;
    if (r.escalated) escalatedCount++;
    if (r.severity && sev[r.severity] !== undefined) sev[r.severity]++;
    if (r.duration_minutes != null && r.status === 'resolved') {
      mttrSum += r.duration_minutes;
      mttrN += 1;
    }
    if (r.reported_at) reportedTimes.push(new Date(r.reported_at).getTime());
  }

  // Avg MTBF (hours) within the month: average interval between consecutive reports
  let mtbfHours = null;
  if (reportedTimes.length > 1) {
    reportedTimes.sort((a, b) => a - b);
    let gapSum = 0;
    for (let i = 1; i < reportedTimes.length; i++) {
      gapSum += reportedTimes[i] - reportedTimes[i - 1];
    }
    const avgMs = gapSum / (reportedTimes.length - 1);
    mtbfHours = Math.round(avgMs / 1000 / 60 / 60);
  }

  return res.status(200).json({
    month: label,
    resolved_count: resolvedCount,
    open_count: openCount,
    total_count: rows.length,
    avg_mttr_minutes: mttrN > 0 ? Math.round(mttrSum / mttrN) : null,
    avg_mtbf_hours: mtbfHours,
    severity_distribution: sev,
    escalated_count: escalatedCount,
  });
}
