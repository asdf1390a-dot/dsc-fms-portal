// GET /api/assets/[assetId]/audit
// Asset audit history (from asset_audit table — INSERT/UPDATE/DELETE/status_change diffs).
// Phase 2 — Asset Master v2.
//
// Distinct from /api/assets/[assetId]/history (PM/BM events).
//
// Query:
//   page=1, per_page=50 (max 100)
//
// Auth: Bearer JWT.

import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { requireUser } from '../../../../lib/career-auth';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const { error: authErr } = await requireUser(req);
  if (authErr) return res.status(authErr.status).json(authErr.body);

  const { assetId } = req.query;
  if (!assetId) return res.status(400).json({ error: 'assetId is required' });

  const page = Math.max(1, Number(req.query.page ?? 1) || 1);
  const perPage = Math.min(100, Math.max(1, Number(req.query.per_page ?? 50) || 50));
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  try {
    const { data, error, count } = await supabaseAdmin
      .from('asset_audit')
      .select('id, asset_id, changed_at, changed_by, action, diff', { count: 'exact' })
      .eq('asset_id', assetId)
      .order('changed_at', { ascending: false })
      .range(from, to);

    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({
      data: data || [],
      total: count || 0,
      page,
      per_page: perPage,
    });
  } catch (e) {
    console.error('[assets:audit] fatal', e);
    return res.status(500).json({ error: e?.message || 'internal_error' });
  }
}
