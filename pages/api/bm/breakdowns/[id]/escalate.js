// POST /api/bm/breakdowns/[id]/escalate
// Marks a breakdown as escalated and (optionally) raises severity.
// Does NOT advance the workflow status — escalation is orthogonal.
// Required body: { reason?: string, severity?: 'major'|'line_down' }

import { supabaseAdmin } from '../../../../../lib/supabase-admin';
import { authenticate } from '../../../../../lib/bm-transition';
import {
  SEVERITY_VALUES, SEVERITY_RANK,
  validateEnum, validateLength,
} from '../../../../../lib/bm-validation';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  const { user, error } = await authenticate(req);
  if (error) return res.status(error.status).json(error.body);

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'missing_id' });

  const body = req.body || {};
  const errors = [];

  if (body.severity !== undefined) {
    const e = validateEnum('severity', body.severity, SEVERITY_VALUES);
    if (e) errors.push(e);
  }
  if (body.reason !== undefined && body.reason !== null && body.reason !== '') {
    const e = validateLength('reason', body.reason, 5, 500);
    if (e) errors.push(e);
  }
  if (errors.length > 0) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: errors },
    });
  }

  const { data: current, error: getErr } = await supabaseAdmin
    .from('breakdown_reports')
    .select('id, status, severity, escalated, deleted_at')
    .eq('id', id)
    .maybeSingle();
  if (getErr) return res.status(500).json({ error: getErr.message });
  if (!current || current.deleted_at) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: `Breakdown report not found: ${id}` } });
  }
  if (current.status === 'resolved' || current.status === 'won_fix') {
    return res.status(409).json({
      error: {
        code: 'INVALID_STATE_TRANSITION',
        message: `Cannot escalate a '${current.status}' report (locked).`,
      },
    });
  }

  const patch = {
    escalated: true,
    escalated_at: new Date().toISOString(),
    escalated_by: user.id,
  };
  // Auto-bump severity if requested or if currently below 'major'.
  const target = body.severity ||
    (SEVERITY_RANK[current.severity] < SEVERITY_RANK.major ? 'major' : current.severity);
  if (SEVERITY_RANK[target] > SEVERITY_RANK[current.severity]) {
    patch.severity = target;
  }

  const { data: updated, error: upErr } = await supabaseAdmin
    .from('breakdown_reports')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (upErr) return res.status(500).json({ error: upErr.message });

  // Best-effort history entry
  try {
    await supabaseAdmin.from('breakdown_status_history').insert({
      breakdown_id: id,
      from_status: current.status,
      to_status: current.status,
      changed_by: user.id,
      reason: body.reason || 'escalated',
      metadata: { escalated: true, severity_from: current.severity, severity_to: updated.severity },
    });
  } catch (_) { /* optional */ }

  return res.status(200).json({
    id: updated.id,
    status: updated.status,
    severity: updated.severity,
    escalated: updated.escalated,
    escalated_at: updated.escalated_at,
    escalated_by: updated.escalated_by,
    updated_at: updated.updated_at,
    record: updated,
  });
}
