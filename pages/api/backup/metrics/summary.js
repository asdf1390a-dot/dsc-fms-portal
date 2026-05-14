// GET /api/backup/metrics/summary — last 30 days aggregate for caller.
//
// Returns totals across the last 30 days (inclusive of today, UTC) by summing
// rows in backup_metrics. Average duration is a weighted average over days that
// recorded any backups.
//
// Auth: Bearer JWT (user).

import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { requireUser } from '../../../../lib/career-auth';

function dateNDaysAgoUtc(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const { user, error: authErr } = await requireUser(req);
  if (authErr) return res.status(authErr.status).json(authErr.body);

  const sinceDate = dateNDaysAgoUtc(29); // last 30 days incl today

  try {
    const { data: rows, error } = await supabaseAdmin
      .from('backup_metrics')
      .select(
        'metric_date, total_backups, successful_backups, failed_backups, skipped_backups, total_size_bytes, average_duration_seconds, max_duration_seconds',
      )
      .eq('user_id', user.id)
      .gte('metric_date', sinceDate)
      .order('metric_date', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    let total = 0;
    let success = 0;
    let failed = 0;
    let skipped = 0;
    let totalSize = 0;
    let maxDuration = 0;
    let weightedDurSum = 0;
    let weightedDurDen = 0;

    for (const r of rows || []) {
      total += r.total_backups || 0;
      success += r.successful_backups || 0;
      failed += r.failed_backups || 0;
      skipped += r.skipped_backups || 0;
      totalSize += Number(r.total_size_bytes) || 0;
      maxDuration = Math.max(maxDuration, r.max_duration_seconds || 0);
      if (r.average_duration_seconds && r.total_backups) {
        weightedDurSum += r.average_duration_seconds * r.total_backups;
        weightedDurDen += r.total_backups;
      }
    }

    const avgDuration =
      weightedDurDen > 0 ? Math.round(weightedDurSum / weightedDurDen) : 0;

    return res.status(200).json({
      user_id: user.id,
      window_days: 30,
      since_date: sinceDate,
      total_backups: total,
      successful: success,
      failed,
      skipped,
      total_size_bytes: totalSize,
      avg_duration_seconds: avgDuration,
      max_duration_seconds: maxDuration,
      days_with_activity: (rows || []).length,
    });
  } catch (e) {
    console.error('[metrics/summary] fatal', e);
    return res.status(500).json({ error: e?.message || 'internal_error' });
  }
}
