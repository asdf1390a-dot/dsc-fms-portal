// PATCH /api/assets/[assetId]/restore
// Phase 3-3 — Restore a previously-disposed asset (admin / authenticated only).
//
// Body:
//   reason?: string (≤ 500 chars) — restoration rationale
//
// Side effects:
//   1) assets.status set back to 'active', disposal_reason / disposed_at cleared
//   2) Writes asset_edit_history row (status: sold|scrapped|disposed → active)
//   3) Writes a note onto the latest asset_disposals row (best-effort)
//
// Auth: Bearer JWT required. We don't have a hard 'admin' role on user_metadata
// yet, so we accept any authenticated user and record changed_by — this matches
// the existing dispose endpoint pattern.

import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { requireUser } from '../../../../lib/career-auth';

const DISPOSED_STATUSES = new Set(['sold', 'scrapped', 'disposed']);

export default async function handler(req, res) {
  if (req.method !== 'PATCH') {
    res.setHeader('Allow', 'PATCH');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const { user, error: authErr } = await requireUser(req);
  if (authErr) return res.status(authErr.status).json(authErr.body);

  const { assetId } = req.query;
  if (!assetId || typeof assetId !== 'string') {
    return res.status(400).json({ error: 'asset_id_required' });
  }

  let body = {};
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  } catch {
    return res.status(400).json({ error: 'invalid_json_body' });
  }

  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (reason.length > 500) {
    return res.status(400).json({ error: 'reason_too_long', details: 'max 500 chars' });
  }

  try {
    // 1) Load asset
    const { data: asset, error: loadErr } = await supabaseAdmin
      .from('assets')
      .select('id, status, disposal_reason, disposed_at')
      .eq('id', assetId)
      .single();

    if (loadErr || !asset) {
      return res.status(404).json({ error: 'asset_not_found' });
    }
    if (!DISPOSED_STATUSES.has(asset.status)) {
      return res.status(409).json({
        error: 'asset_not_disposed',
        details: `current status: ${asset.status}`,
      });
    }

    const previousStatus = asset.status;
    const nowIso = new Date().toISOString();

    // 2) Restore asset row
    const { data: updated, error: updErr } = await supabaseAdmin
      .from('assets')
      .update({
        status: 'active',
        disposal_reason: null,
        disposed_at: null,
        updated_by: user.id,
        updated_at: nowIso,
      })
      .eq('id', assetId)
      .select()
      .single();

    if (updErr) {
      console.error('[assets/restore] update failed', updErr);
      return res.status(500).json({ error: 'restore_update_failed' });
    }

    // 3) Best-effort: write edit_history entry
    let historyLogged = false;
    let historyWarning = null;
    try {
      const { error: histErr } = await supabaseAdmin
        .from('asset_edit_history')
        .insert({
          asset_id: assetId,
          field_name: 'status',
          old_value: previousStatus,
          new_value: 'active',
          changed_by: user.id,
          note: reason ? `restore: ${reason}` : 'restore',
        });
      if (histErr) {
        if (histErr.code === '42P01') {
          historyWarning =
            'asset_edit_history table missing — restore not logged (run db/46)';
        } else {
          historyWarning = `edit_history insert failed: ${histErr.message}`;
        }
        console.warn('[assets/restore] history warn', historyWarning);
      } else {
        historyLogged = true;
      }
    } catch (e) {
      historyWarning = e instanceof Error ? e.message : 'history insert exception';
    }

    // 4) Best-effort: stamp the latest asset_disposals row with a restore note
    let disposalNoted = false;
    try {
      const { data: latestDisposal } = await supabaseAdmin
        .from('asset_disposals')
        .select('id, note')
        .eq('asset_id', assetId)
        .order('disposed_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestDisposal?.id) {
        const stamp = `[restored ${nowIso} by ${user.id}]${reason ? ` ${reason}` : ''}`;
        const newNote = latestDisposal.note
          ? `${latestDisposal.note}\n${stamp}`
          : stamp;
        const { error: noteErr } = await supabaseAdmin
          .from('asset_disposals')
          .update({ note: newNote })
          .eq('id', latestDisposal.id);
        if (!noteErr) disposalNoted = true;
      }
    } catch (e) {
      console.warn('[assets/restore] disposal note skip', e?.message || e);
    }

    return res.status(200).json({
      success: true,
      asset: updated,
      previous_status: previousStatus,
      restored_at: nowIso,
      restored_by: user.id,
      reason: reason || null,
      history_logged: historyLogged,
      history_warning: historyWarning,
      disposal_record_annotated: disposalNoted,
    });
  } catch (e) {
    console.error('[assets/restore] fatal', e);
    return res.status(500).json({ error: e?.message || 'internal_error' });
  }
}
