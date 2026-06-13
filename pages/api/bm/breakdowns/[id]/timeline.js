// GET /api/bm/breakdowns/[id]/timeline
// Returns the status change history for a single breakdown.
// If the breakdown_status_history table is absent, falls back to a
// synthetic timeline derived from the breakdown_reports timestamp columns.

import { supabaseAdmin } from '../../../../../lib/supabase-admin';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'missing_id' });

  const { data: report, error: rErr } = await supabaseAdmin
    .from('breakdown_reports')
    .select('id, status, reported_at, acknowledged_at, started_at, resolved_at, escalated, escalated_at, reported_by, assigned_to, resolved_by, escalated_by, deleted_at')
    .eq('id', id)
    .maybeSingle();
  if (rErr) return res.status(500).json({ error: rErr.message });
  if (!report || report.deleted_at) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: `Breakdown report not found: ${id}` } });
  }

  // Try history table first
  const { data: history, error: hErr } = await supabaseAdmin
    .from('breakdown_status_history')
    .select('id, from_status, to_status, changed_by, changed_at, reason, metadata')
    .eq('breakdown_id', id)
    .order('changed_at', { ascending: true });

  if (!hErr && Array.isArray(history) && history.length > 0) {
    return res.status(200).json({ id, events: history });
  }

  // Fallback: synthesize from timestamps
  const events = [];
  if (report.reported_at) {
    events.push({ event: 'reported', at: report.reported_at, by: report.reported_by });
  }
  if (report.acknowledged_at) {
    events.push({ event: 'acknowledged', at: report.acknowledged_at, by: report.assigned_to });
  }
  if (report.started_at) {
    events.push({ event: 'in_progress', at: report.started_at, by: report.assigned_to });
  }
  if (report.escalated && report.escalated_at) {
    events.push({ event: 'escalated', at: report.escalated_at, by: report.escalated_by });
  }
  if (report.resolved_at) {
    events.push({ event: report.status === 'won_fix' ? 'won_fix' : 'resolved', at: report.resolved_at, by: report.resolved_by });
  }

  events.sort((a, b) => new Date(a.at) - new Date(b.at));
  return res.status(200).json({ id, events, synthesized: true });
}
