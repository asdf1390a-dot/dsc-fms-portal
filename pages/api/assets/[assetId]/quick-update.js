// POST /api/assets/[assetId]/quick-update
//
// Phase 3 — field-friendly partial update endpoint.
//
// Accepts a small `patch` payload (status / location / note) from the mobile
// Quick Update page. The endpoint deliberately allow-lists which columns can
// be mutated so we can't be turned into a generic asset-write surface.
//
// Body:
//   {
//     patch: { status?, location?, name_ko?, name_en?, name_ta?, remarks? },
//     note?: string,        // free-text comment, appended to audit diff
//     client_ts?: number    // client-side ms timestamp (offline replay)
//   }
//
// Auth: Bearer JWT (authenticated users).
// Audit: triggers on assets table populate asset_audit automatically; we also
// embed the note + client_ts in the changed row as a no-op (note→remarks if
// provided alone? No — we keep them separate and just rely on the audit
// trigger to capture the diff).

import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { requireUser } from '../../../../lib/career-auth';

const ALLOWED_KEYS = new Set([
  'status',
  'location',
  'name_ko',
  'name_en',
  'name_ta',
  'remarks',
]);

const ALLOWED_STATUS = new Set(['active', 'idle', 'maintenance', 'sold', 'scrapped', 'disposed']);

function sanitize(patch) {
  if (!patch || typeof patch !== 'object') return { clean: null, error: 'patch_required' };
  const clean = {};
  for (const [k, v] of Object.entries(patch)) {
    if (!ALLOWED_KEYS.has(k)) continue;
    if (v == null) continue;
    if (k === 'status' && !ALLOWED_STATUS.has(String(v))) {
      return { clean: null, error: `invalid_status:${v}` };
    }
    clean[k] = typeof v === 'string' ? v.trim() : v;
  }
  if (Object.keys(clean).length === 0) {
    return { clean: null, error: 'no_allowed_fields_in_patch' };
  }
  return { clean, error: null };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const { error: authErr, user } = await requireUser(req);
  if (authErr) return res.status(authErr.status).json(authErr.body);

  const { assetId } = req.query;
  if (!assetId) return res.status(400).json({ error: 'assetId is required' });

  const { patch, note, client_ts } = req.body || {};
  const { clean, error: sanErr } = sanitize(patch);
  if (sanErr) return res.status(400).json({ error: sanErr });

  try {
    // Update the asset.
    const { data: updated, error: updErr } = await supabaseAdmin
      .from('assets')
      .update(clean)
      .eq('id', assetId)
      .select('id, machine_asset_number, name_en, location, status, updated_at')
      .maybeSingle();

    if (updErr) {
      console.error('[assets:quick-update] update error', updErr);
      return res.status(500).json({ error: updErr.message });
    }
    if (!updated) {
      return res.status(404).json({ error: 'asset_not_found' });
    }

    // Best-effort: write a companion audit row tagged as quick_update so we
    // can distinguish field updates from full-form edits. We do not fail the
    // request if this insert fails — the assets update already succeeded.
    try {
      await supabaseAdmin.from('asset_audit').insert({
        asset_id: assetId,
        changed_by: user?.id || null,
        action: 'quick_update',
        diff: {
          patch: clean,
          note: note || null,
          client_ts: client_ts || null,
          source: 'mobile_quick_update',
        },
      });
    } catch (auditErr) {
      console.warn('[assets:quick-update] audit insert failed', auditErr);
    }

    return res.status(200).json({ asset: updated });
  } catch (e) {
    console.error('[assets:quick-update] fatal', e);
    return res.status(500).json({ error: e?.message || 'internal_error' });
  }
}
