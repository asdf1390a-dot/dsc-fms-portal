// GET /api/assets/analytics/edit-patterns
// Phase 3-4 — Edit-pattern analytics derived from asset_edit_history.
//
// Query:
//   time_range?  'week' | 'month' | 'quarter' | 'year' (default: 'month')
//
// Returns:
//   - period_start / period_end (ISO)
//   - edit_velocity: edits_per_day_avg, peak_day_of_week, peak_hour
//   - field_volatility: per-field change counts + common transitions (top 5)
//   - top_editors: top-10 user_ids by edit count
//
// Gracefully degrades when asset_edit_history is missing (db/46 not applied).

import { supabaseAdmin } from '../../../../lib/supabase-admin';

const RANGES = {
  week: 7,
  month: 30,
  quarter: 90,
  year: 365,
};

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const tr = typeof req.query.time_range === 'string' ? req.query.time_range : 'month';
  const days = RANGES[tr] || RANGES.month;

  const now = new Date();
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  try {
    const { data, error } = await supabaseAdmin
      .from('asset_edit_history')
      .select('field_name, old_value, new_value, changed_by, changed_at')
      .gte('changed_at', from.toISOString())
      .lte('changed_at', now.toISOString())
      .limit(10000);

    if (error) {
      if (error.code === '42P01') {
        return res.status(200).json({
          success: true,
          available: false,
          message:
            'asset_edit_history table missing — run db/46_asset_master_phase3_schema.sql',
          time_range: tr,
          period_start: from.toISOString(),
          period_end: now.toISOString(),
        });
      }
      return res.status(500).json({ error: error.message });
    }

    const rows = data || [];
    const totalEdits = rows.length;
    const editsPerDayAvg = days > 0 ? Number((totalEdits / days).toFixed(2)) : 0;

    // Day-of-week + hour-of-day distribution.
    const dowCounts = new Array(7).fill(0);
    const hourCounts = new Array(24).fill(0);
    const fieldMap = new Map(); // field_name → { count, transitions: Map }
    const editorCounts = new Map();

    for (const r of rows) {
      const t = new Date(r.changed_at);
      if (!Number.isNaN(t.getTime())) {
        dowCounts[t.getUTCDay()] += 1;
        hourCounts[t.getUTCHours()] += 1;
      }

      const field = r.field_name || '(unknown)';
      let entry = fieldMap.get(field);
      if (!entry) {
        entry = { count: 0, transitions: new Map() };
        fieldMap.set(field, entry);
      }
      entry.count += 1;
      const trKey = `${r.old_value ?? '∅'} → ${r.new_value ?? '∅'}`;
      entry.transitions.set(trKey, (entry.transitions.get(trKey) || 0) + 1);

      if (r.changed_by) {
        editorCounts.set(r.changed_by, (editorCounts.get(r.changed_by) || 0) + 1);
      }
    }

    const peakDowIdx = dowCounts.indexOf(Math.max(...dowCounts));
    const peakHourIdx = hourCounts.indexOf(Math.max(...hourCounts));

    const fieldVolatility = Array.from(fieldMap.entries())
      .map(([field, entry]) => ({
        field_name: field,
        change_frequency: entry.count,
        common_transitions: Array.from(entry.transitions.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([transition, count]) => ({ transition, count })),
      }))
      .sort((a, b) => b.change_frequency - a.change_frequency);

    const topEditors = Array.from(editorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([userId, count]) => ({ user_id: userId, edit_count: count }));

    return res.status(200).json({
      success: true,
      available: true,
      time_range: tr,
      period_start: from.toISOString(),
      period_end: now.toISOString(),
      total_edits: totalEdits,
      edit_velocity: {
        edits_per_day_avg: editsPerDayAvg,
        peak_day_of_week: totalEdits > 0 ? DAY_LABELS[peakDowIdx] : null,
        peak_hour_utc: totalEdits > 0 ? peakHourIdx : null,
        day_of_week_distribution: DAY_LABELS.map((label, i) => ({
          day: label,
          count: dowCounts[i],
        })),
        hour_distribution: hourCounts.map((count, hour) => ({ hour, count })),
      },
      field_volatility: fieldVolatility,
      top_editors: topEditors,
    });
  } catch (e) {
    console.error('[assets/analytics/edit-patterns] fatal', e);
    return res.status(500).json({ error: e?.message || 'internal_error' });
  }
}
