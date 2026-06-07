// GET /api/assets/import/batches/[id]/items
// List items for a batch. Filter by status, paginated.
//
// Query: status, limit (max 200, default 50), offset (default 0)
// Auth: Bearer JWT.

import { supabaseAdmin } from '../../../../../../lib/supabase-admin';
import { requireUser } from '../../../../../../lib/career-auth';

const VALID_STATUSES = ['pending', 'validating', 'success', 'error', 'skipped'];

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const { error: authErr } = await requireUser(req);
  if (authErr) return res.status(authErr.status).json(authErr.body);

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'batch_id_required' });

  const status = req.query.status;
  const limit = Math.min(200, Math.max(1, Number(req.query.limit ?? 50) || 50));
  const offset = Math.max(0, Number(req.query.offset ?? 0) || 0);

  if (status && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({
      error: 'invalid_status',
      message: `status must be one of ${VALID_STATUSES.join(', ')}`,
    });
  }

  try {
    // Confirm batch exists (and surface 404 instead of empty list)
    const { data: batch, error: bErr } = await supabaseAdmin
      .from('asset_import_batches')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (bErr) return res.status(500).json({ error: bErr.message });
    if (!batch) return res.status(404).json({ error: 'batch_not_found' });

    let q = supabaseAdmin
      .from('asset_import_items')
      .select(
        'id, batch_id, row_number, status, raw_data, validation_errors, validation_warnings, asset_id, action, created_at, processed_at',
        { count: 'exact' }
      )
      .eq('batch_id', id)
      .order('row_number', { ascending: true })
      .range(offset, offset + limit - 1);

    if (status) q = q.eq('status', status);

    const { data, error, count } = await q;
    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({
      batch_id: id,
      items: data || [],
      total: count ?? 0,
      limit,
      offset,
    });
  } catch (e) {
    return res.status(500).json({ error: 'list_failed', message: e.message });
  }
}
