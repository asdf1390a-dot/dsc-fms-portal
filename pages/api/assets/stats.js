// GET /api/assets/stats?assetId=<uuid>&months=3
// PM compliance + BM MTTR/MTBF/uptime + priority distribution for one asset.
//
// Response:
//   {
//     pmRate: { totalScheduled, totalCompleted, complianceRate, overdueCount },
//     bm: {
//       mttrMin, mtbfMin, uptimePct,
//       breakdownCount, totalDowntimeMin,
//       openCount, resolvedCount,
//     },
//     failuresByPriority: [{ priority, count }],
//     monthlyCompliance: [{ ym, scheduled, completed, rate }],
//     windowMonths
//   }
import { supabaseAdmin } from '../../../lib/supabase-admin';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });
  const assetId = (req.query.assetId || '').toString().trim();
  if (!assetId) return res.status(400).json({ error: 'assetId required' });

  const months = Math.min(Math.max(parseInt(req.query.months, 10) || 3, 1), 12);

  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  const fromIso = from.toISOString();
  const fromDate = from.toISOString().slice(0, 10);

  const [pmRes, bmRes] = await Promise.all([
    supabaseAdmin
      .from('pm_schedules')
      .select('id, scheduled_date, status')
      .eq('asset_id', assetId)
      .gte('scheduled_date', fromDate),
    supabaseAdmin
      .from('bm_events')
      .select('id, status, priority, reported_at, resolved_at, downtime_start, downtime_end')
      .eq('asset_id', assetId)
      .gte('reported_at', fromIso),
  ]);

  if (pmRes.error) return res.status(500).json({ error: 'pm: ' + pmRes.error.message });
  if (bmRes.error) return res.status(500).json({ error: 'bm: ' + bmRes.error.message });

  // ─── PM compliance ───
  const todayStr = now.toISOString().slice(0, 10);
  const pmRows = pmRes.data || [];
  const totalScheduled = pmRows.length;
  const totalCompleted = pmRows.filter(r => r.status === 'completed').length;
  const overdueCount   = pmRows.filter(r => r.status === 'pending' && r.scheduled_date < todayStr).length;
  const complianceRate = totalScheduled > 0
    ? Math.round((totalCompleted / totalScheduled) * 1000) / 10
    : null;

  // Monthly bucketing
  const monthlyMap = new Map();
  for (const r of pmRows) {
    const ym = (r.scheduled_date || '').slice(0, 7);
    if (!ym) continue;
    if (!monthlyMap.has(ym)) monthlyMap.set(ym, { scheduled: 0, completed: 0 });
    const m = monthlyMap.get(ym);
    m.scheduled += 1;
    if (r.status === 'completed') m.completed += 1;
  }
  const monthlyCompliance = [...monthlyMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([ym, m]) => ({
      ym,
      scheduled: m.scheduled,
      completed: m.completed,
      rate: m.scheduled > 0 ? Math.round((m.completed / m.scheduled) * 1000) / 10 : null,
    }));

  // ─── BM MTTR / MTBF / uptime ───
  const bmRows = bmRes.data || [];
  const resolved = bmRows.filter(r => r.status === 'resolved');
  let totalDowntimeMin = 0;
  let downtimeSamples = 0;
  for (const r of resolved) {
    const start = r.downtime_start || r.reported_at;
    const end   = r.downtime_end   || r.resolved_at;
    if (!start || !end) continue;
    const dt = (new Date(end).getTime() - new Date(start).getTime()) / 60000;
    if (Number.isFinite(dt) && dt >= 0) {
      totalDowntimeMin += dt;
      downtimeSamples += 1;
    }
  }
  const mttrMin = downtimeSamples > 0 ? Math.round((totalDowntimeMin / downtimeSamples) * 10) / 10 : null;

  // Window total minutes (best-effort: months * 30 days * 24 h * 60 min)
  const windowMin = months * 30 * 24 * 60;
  const uptimePct = windowMin > 0
    ? Math.round((1 - totalDowntimeMin / windowMin) * 1000) / 10
    : null;
  const breakdownCount = resolved.length;
  const mtbfMin = breakdownCount > 0
    ? Math.round(((windowMin - totalDowntimeMin) / breakdownCount) * 10) / 10
    : null;

  // Priority histogram (all BM events in window)
  const priCount = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const r of bmRows) {
    const p = r.priority || 'medium';
    if (priCount[p] != null) priCount[p] += 1;
  }
  const failuresByPriority = ['critical', 'high', 'medium', 'low']
    .map(p => ({ priority: p, count: priCount[p] }));

  return res.status(200).json({
    pmRate: {
      totalScheduled,
      totalCompleted,
      complianceRate,
      overdueCount,
    },
    bm: {
      mttrMin,
      mtbfMin,
      uptimePct,
      breakdownCount,
      totalDowntimeMin: Math.round(totalDowntimeMin * 10) / 10,
      openCount: bmRows.filter(r => ['open', 'in_progress', 'pending_parts'].includes(r.status)).length,
      resolvedCount: resolved.length,
    },
    failuresByPriority,
    monthlyCompliance,
    windowMonths: months,
  });
}
