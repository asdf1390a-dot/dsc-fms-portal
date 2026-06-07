// /api/assets/import/batches/[id]
//   GET    — Batch detail + aggregated stats
//   DELETE — Cancel batch (mark failed; items kept for forensic review)
//
// Auth: Bearer JWT.
// Asset Master v2 Phase 2 — batch detail endpoints.

import { supabaseAdmin } from '../../../../../lib/supabase-admin';
import { requireUser } from '../../../../../lib/career-auth';

export default async function handler(req, res) {
  if (req.method === 'GET') return handleGet(req, res);
  if (req.method === 'DELETE') return handleDelete(req, res);
  res.setHeader('Allow', 'GET, DELETE');
  return res.status(405).json({ error: 'method_not_allowed' });
}

async function handleGet(req, res) {
  const { error: authErr } = await requireUser(req);
  if (authErr) return res.status(authErr.status).json(authErr.body);

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'batch_id_required' });

  try {
    const { data: batch, error } = await supabaseAdmin
      .from('asset_import_batches')
      .select(
        'id, batch_name, batch_date, file_name, file_size_bytes, file_hash, status, total_rows, processed_count, success_count, error_count, import_result, org_id, created_at, created_by, updated_at, updated_by'
      )
      .eq('id', id)
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    if (!batch) return res.status(404).json({ error: 'batch_not_found' });

    // Aggregated stats from items (live snapshot)
    const { data: itemStats, error: statsErr } = await supabaseAdmin
      .from('asset_import_items')
      .select('status')
      .eq('batch_id', id);

    if (statsErr) {
      return res.status(200).json({ ...batch, item_stats: null, item_stats_error: statsErr.message });
    }

    const stats = (itemStats || []).reduce(
      (acc, it) => {
        acc.total += 1;
        acc[it.status] = (acc[it.status] || 0) + 1;
        return acc;
      },
      { total: 0 }
    );

    return res.status(200).json({
      ...batch,
      item_stats: stats,
    });
  } catch (e) {
    return res.status(500).json({ error: 'get_failed', message: e.message });
  }
}

async function handleDelete(req, res) {
  const { user, error: authErr } = await requireUser(req);
  if (authErr) return res.status(authErr.status).json(authErr.body);

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'batch_id_required' });

  try {
    const { data: batch, error: getErr } = await supabaseAdmin
      .from('asset_import_batches')
      .select('id, status')
      .eq('id', id)
      .maybeSingle();

    if (getErr) return res.status(500).json({ error: getErr.message });
    if (!batch) return res.status(404).json({ error: 'batch_not_found' });

    if (batch.status === 'completed') {
      return res.status(409).json({
        error: 'cannot_cancel_completed',
        message: 'completed 상태의 배치는 취소할 수 없습니다',
      });
    }
    if (batch.status === 'processing') {
      return res.status(409).json({
        error: 'cannot_cancel_processing',
        message: 'processing 중인 배치는 취소할 수 없습니다',
      });
    }

    const { error: updErr } = await supabaseAdmin
      .from('asset_import_batches')
      .update({
        status: 'failed',
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq('id', id);

    if (updErr) return res.status(500).json({ error: updErr.message });

    return res.status(200).json({
      success: true,
      message: 'batch_cancelled',
      batch_id: id,
    });
  } catch (e) {
    return res.status(500).json({ error: 'delete_failed', message: e.message });
  }
}
