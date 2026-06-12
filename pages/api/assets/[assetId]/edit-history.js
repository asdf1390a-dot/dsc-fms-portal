// GET /api/assets/[assetId]/edit-history
// Phase 3-2 — Edit history for a single asset.
//
// Query:
//   field?   Filter by changed field name (exact match)
//   limit?   1..100 (default 20)
//   offset?  >= 0 (default 0)
//
// Auth: anon allowed (table RLS is select=true), but we still record requester
// when a Bearer token is present so endpoint stays consistent with the rest of
// Phase 3.
//
// Depends on: db/46_asset_master_phase3_schema.sql (asset_edit_history table).
// Gracefully degrades when the table doesn't exist yet (returns available=false).

import { supabaseAdmin } from '../../../../lib/supabase-admin';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const { assetId } = req.query;
  if (!assetId || typeof assetId !== 'string') {
    return res.status(400).json({ error: 'asset_id_required' });
  }

  const field = typeof req.query.field === 'string' ? req.query.field.trim() : '';
  let limit = Number(req.query.limit ?? 20);
  let offset = Number(req.query.offset ?? 0);

  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    return res.status(400).json({ error: 'invalid_limit', details: '1..100' });
  }
  if (!Number.isInteger(offset) || offset < 0) {
    return res.status(400).json({ error: 'invalid_offset' });
  }

  try {
    let q = supabaseAdmin
      .from('asset_edit_history')
      .select('id, asset_id, field_name, old_value, new_value, changed_by, changed_at, note', {
        count: 'exact',
      })
      .eq('asset_id', assetId)
      .order('changed_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (field) q = q.eq('field_name', field);

    const { data, count, error } = await q;

    if (error) {
      // 42P01 = undefined_table — graceful degrade if db/46 not applied
      if (error.code === '42P01') {
        return res.status(200).json({
          success: true,
          available: false,
          message:
            'asset_edit_history table missing — run db/46_asset_master_phase3_schema.sql',
          entries: [],
          pagination: { total: 0, limit, offset, returned: 0 },
        });
      }
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({
      success: true,
      available: true,
      asset_id: assetId,
      filter: { field: field || null },
      pagination: {
        total: count || 0,
        limit,
        offset,
        returned: (data || []).length,
      },
      entries: data || [],
    });
  } catch (e) {
    console.error('[assets/edit-history] fatal', e);
    return res.status(500).json({ error: e?.message || 'internal_error' });
  }
}
