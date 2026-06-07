// POST /api/assets/import/batches/[id]/execute
// Trigger bulk_insert_assets RPC for a validated batch.
//
// Body: { confirm: true }
// Auth: Bearer JWT.

import { supabaseAdmin } from '../../../../../../lib/supabase-admin';
import { requireUser } from '../../../../../../lib/career-auth';

const RPC_TIMEOUT_MS = 60_000;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const { user, error: authErr } = await requireUser(req);
  if (authErr) return res.status(authErr.status).json(authErr.body);

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'batch_id_required' });

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  if (body.confirm !== true) {
    return res.status(400).json({
      error: 'confirm_required',
      message: 'POST { confirm: true } 으로 명시적 확인이 필요합니다',
    });
  }

  try {
    const { data: batch, error: bErr } = await supabaseAdmin
      .from('asset_import_batches')
      .select('id, status, total_rows, error_count')
      .eq('id', id)
      .maybeSingle();

    if (bErr) return res.status(500).json({ error: bErr.message });
    if (!batch) return res.status(404).json({ error: 'batch_not_found' });

    if (batch.status !== 'pending') {
      return res.status(409).json({
        error: 'invalid_state',
        message: `pending 상태만 실행 가능 (현재: ${batch.status})`,
      });
    }

    // Build items payload from valid items (status=pending)
    const { data: items, error: itemErr } = await supabaseAdmin
      .from('asset_import_items')
      .select('id, row_number, raw_data')
      .eq('batch_id', id)
      .eq('status', 'pending');

    if (itemErr) return res.status(500).json({ error: itemErr.message });
    if (!items || items.length === 0) {
      return res.status(400).json({
        error: 'no_valid_items',
        message: '실행할 유효한 행이 없습니다',
      });
    }

    const itemsPayload = items.map((it) => ({
      item_id: it.id,
      row_number: it.row_number,
      machine_asset_number: it.raw_data?.machine_asset_number,
      name_en: it.raw_data?.name_en,
      name_ta: it.raw_data?.name_ta,
      asset_class_code: it.raw_data?.asset_class_code,
      location: it.raw_data?.location,
      status: it.raw_data?.status,
      model: it.raw_data?.model,
      make: it.raw_data?.make,
      serial_no: it.raw_data?.serial_no,
      year_of_manufacture: it.raw_data?.year_of_manufacture,
      remark: it.raw_data?.remark,
    }));

    // RPC with timeout guard
    const rpcCall = supabaseAdmin.rpc('bulk_insert_assets', {
      p_batch_id: id,
      p_items_data: itemsPayload,
    });

    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('rpc_timeout')), RPC_TIMEOUT_MS)
    );

    let rpcRes;
    try {
      rpcRes = await Promise.race([rpcCall, timeout]);
    } catch (e) {
      // Mark batch failed on timeout
      await supabaseAdmin
        .from('asset_import_batches')
        .update({ status: 'failed', updated_at: new Date().toISOString(), updated_by: user.id })
        .eq('id', id);
      return res.status(504).json({ error: 'rpc_timeout', message: e.message });
    }

    if (rpcRes.error) {
      return res.status(500).json({ error: 'rpc_failed', message: rpcRes.error.message });
    }

    const result = rpcRes.data || {};
    const affected = (result.success || 0) + (result.errors || 0);

    return res.status(200).json({
      success: true,
      batch_id: id,
      affected_rows: affected,
      inserted: result.success || 0,
      errors: result.errors || 0,
      details: result.details || [],
    });
  } catch (e) {
    return res.status(500).json({ error: 'execute_failed', message: e.message });
  }
}
