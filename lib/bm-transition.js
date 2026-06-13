// Server-side helper that performs a status transition against breakdown_reports.
// Uses service_role so that we can also write to breakdown_status_history,
// independent of the caller's RLS UPDATE policy.
//
// Returns:
//   { status: 200, body: { ... } }            on success
//   { status: 400|401|404|409, body: {error}} on failure

import { supabaseAdmin } from './supabase-admin';
import { validateTransition } from './bm-validation';

export async function authenticate(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return { user: null, error: { status: 401, body: { error: 'missing_token' } } };
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return { user: null, error: { status: 401, body: { error: 'invalid_token' } } };
  return { user: data.user, error: null };
}

export async function performTransition({ id, targetStatus, body, user }) {
  // Fetch existing
  const { data: current, error: getErr } = await supabaseAdmin
    .from('breakdown_reports')
    .select('id, status, reported_at, started_at, resolved_at, asset_id, deleted_at')
    .eq('id', id)
    .maybeSingle();

  if (getErr) return { status: 500, body: { error: getErr.message } };
  if (!current || current.deleted_at) {
    return { status: 404, body: { error: { code: 'NOT_FOUND', message: `Breakdown report not found: ${id}` } } };
  }

  const { errors, patch } = validateTransition(current, targetStatus, body || {});
  if (errors.length > 0) {
    // Distinguish state-transition error vs validation
    const tErr = errors.find(e => e.code === 'INVALID_STATE_TRANSITION');
    if (tErr) {
      return {
        status: 409,
        body: { error: { code: 'INVALID_STATE_TRANSITION', message: tErr.message, details: [] } },
      };
    }
    return {
      status: 400,
      body: { error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: errors } },
    };
  }

  // Record resolver/escalation actor where appropriate
  if (targetStatus === 'resolved' || targetStatus === 'won_fix') {
    patch.resolved_by = user.id;
  }

  const { data: updated, error: upErr } = await supabaseAdmin
    .from('breakdown_reports')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (upErr) return { status: 500, body: { error: upErr.message } };

  // Append history (best-effort; ignore failure if table missing)
  try {
    await supabaseAdmin.from('breakdown_status_history').insert({
      breakdown_id: id,
      from_status: current.status,
      to_status: targetStatus,
      changed_by: user.id,
      reason: body?.reason || null,
      metadata: { patch },
    });
  } catch (_) { /* history table optional */ }

  const changed = Object.keys(patch);
  return {
    status: 200,
    body: {
      id: updated.id,
      status: updated.status,
      updated_at: updated.updated_at,
      duration_minutes: updated.duration_minutes ?? null,
      changed_fields: changed,
      record: updated,
    },
  };
}
