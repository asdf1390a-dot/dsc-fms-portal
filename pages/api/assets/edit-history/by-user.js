// GET /api/assets/edit-history/by-user
// Phase 3-2 — Audit endpoint: list edit-history entries authored by a user.
//
// Query:
//   user_id     required (UUID of the editor)
//   date_from?  YYYY-MM-DD (inclusive)
//   date_to?    YYYY-MM-DD (inclusive)
//   limit?      1..200 (default 50)
//   offset?     >=0 (default 0)
//
// Returns enriched rows with asset_name/machine_asset_number for context.
// Auth: Bearer JWT required (any authenticated user; treat as audit-readonly).

import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { requireUser } from '../../../../lib/career-auth';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const { user, error: authErr } = await requireUser(req);
  if (authErr) return res.status(authErr.status).json(authErr.body);

  const userId = typeof req.query.user_id === 'string' ? req.query.user_id.trim() : '';
  if (!userId) return res.status(400).json({ error: 'user_id_required' });

  const dateFrom = typeof req.query.date_from === 'string' ? req.query.date_from : '';
  const dateTo = typeof req.query.date_to === 'string' ? req.query.date_to : '';
  let limit = Number(req.query.limit ?? 50);
  let offset = Number(req.query.offset ?? 0);

  if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
    return res.status(400).json({ error: 'invalid_limit', details: '1..200' });
  }
  if (!Number.isInteger(offset) || offset < 0) {
    return res.status(400).json({ error: 'invalid_offset' });
  }
  if (dateFrom && !/^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) {
    return res.status(400).json({ error: 'invalid_date_from' });
  }
  if (dateTo && !/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
    return res.status(400).json({ error: 'invalid_date_to' });
  }

  try {
    let q = supabaseAdmin
      .from('asset_edit_history')
      .select(
        `id, asset_id, field_name, old_value, new_value, changed_at, note,
         assets:asset_id(machine_asset_number, name_en)`,
        { count: 'exact' },
      )
      .eq('changed_by', userId)
      .order('changed_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (dateFrom) q = q.gte('changed_at', `${dateFrom}T00:00:00Z`);
    if (dateTo) q = q.lte('changed_at', `${dateTo}T23:59:59Z`);

    const { data, count, error } = await q;

    if (error) {
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

    const entries = (data || []).map((r) => ({
      id: r.id,
      asset_id: r.asset_id,
      asset_number: r.assets?.machine_asset_number || null,
      asset_name: r.assets?.name_en || null,
      field_name: r.field_name,
      old_value: r.old_value,
      new_value: r.new_value,
      changed_at: r.changed_at,
      note: r.note,
    }));

    return res.status(200).json({
      success: true,
      available: true,
      requester_id: user.id,
      user_id: userId,
      filter: { date_from: dateFrom || null, date_to: dateTo || null },
      pagination: {
        total: count || 0,
        limit,
        offset,
        returned: entries.length,
      },
      entries,
    });
  } catch (e) {
    console.error('[assets/edit-history/by-user] fatal', e);
    return res.status(500).json({ error: e?.message || 'internal_error' });
  }
}
