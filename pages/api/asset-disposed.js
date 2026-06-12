// GET /api/asset-disposed
// Phase 3-3 — List disposed assets with summary by reason.
//
// Query:
//   date_from?  YYYY-MM-DD (inclusive, disposed_at)
//   date_to?    YYYY-MM-DD (inclusive)
//   reason?     Substring match on disposal_reason
//   limit?      1..200 (default 50)
//   offset?     >= 0 (default 0)
//
// Returns aggregated counts (by reason) plus paginated row list.
// Auth: anon read allowed (matches existing asset_disposals RLS select=true).
// Gracefully degrades when asset_disposals is missing (db/46 not applied).

import { supabaseAdmin } from '../../lib/supabase-admin';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const dateFrom = typeof req.query.date_from === 'string' ? req.query.date_from : '';
  const dateTo = typeof req.query.date_to === 'string' ? req.query.date_to : '';
  const reason = typeof req.query.reason === 'string' ? req.query.reason.trim() : '';
  let limit = Number(req.query.limit ?? 50);
  let offset = Number(req.query.offset ?? 0);

  if (dateFrom && !/^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) {
    return res.status(400).json({ error: 'invalid_date_from' });
  }
  if (dateTo && !/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
    return res.status(400).json({ error: 'invalid_date_to' });
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
    return res.status(400).json({ error: 'invalid_limit', details: '1..200' });
  }
  if (!Number.isInteger(offset) || offset < 0) {
    return res.status(400).json({ error: 'invalid_offset' });
  }

  try {
    // ── Paginated list ───────────────────────────────────────────────
    let listQ = supabaseAdmin
      .from('asset_disposals')
      .select(
        `id, asset_id, disposal_reason, disposal_price, buyer_name,
         disposed_at, disposed_by, note, disposal_certificate_url, created_at,
         assets:asset_id(machine_asset_number, name_en, location, status)`,
        { count: 'exact' },
      )
      .order('disposed_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (dateFrom) listQ = listQ.gte('disposed_at', `${dateFrom}T00:00:00Z`);
    if (dateTo) listQ = listQ.lte('disposed_at', `${dateTo}T23:59:59Z`);
    if (reason) listQ = listQ.ilike('disposal_reason', `%${reason}%`);

    const { data, count, error } = await listQ;

    if (error) {
      if (error.code === '42P01') {
        return res.status(200).json({
          success: true,
          available: false,
          message:
            'asset_disposals table missing — run db/46_asset_master_phase3_schema.sql',
          assets: [],
          summary_by_reason: {},
          pagination: { total: 0, limit, offset, returned: 0 },
        });
      }
      return res.status(500).json({ error: error.message });
    }

    // ── Summary by reason (over filtered window, ignoring limit/offset) ──
    let summaryQ = supabaseAdmin
      .from('asset_disposals')
      .select('disposal_reason');
    if (dateFrom) summaryQ = summaryQ.gte('disposed_at', `${dateFrom}T00:00:00Z`);
    if (dateTo) summaryQ = summaryQ.lte('disposed_at', `${dateTo}T23:59:59Z`);
    if (reason) summaryQ = summaryQ.ilike('disposal_reason', `%${reason}%`);

    const { data: summaryRows } = await summaryQ;
    const summary = {};
    for (const r of summaryRows || []) {
      const k = r.disposal_reason || '(unspecified)';
      summary[k] = (summary[k] || 0) + 1;
    }

    const rows = (data || []).map((r) => ({
      id: r.id,
      asset_id: r.asset_id,
      asset_number: r.assets?.machine_asset_number || null,
      asset_name: r.assets?.name_en || null,
      location: r.assets?.location || null,
      status: r.assets?.status || null,
      disposal_reason: r.disposal_reason,
      disposal_price: r.disposal_price,
      buyer_name: r.buyer_name,
      disposed_at: r.disposed_at,
      disposed_by: r.disposed_by,
      note: r.note,
      disposal_certificate_url: r.disposal_certificate_url,
      created_at: r.created_at,
    }));

    return res.status(200).json({
      success: true,
      available: true,
      filter: {
        date_from: dateFrom || null,
        date_to: dateTo || null,
        reason: reason || null,
      },
      pagination: {
        total: count || 0,
        limit,
        offset,
        returned: rows.length,
      },
      summary_by_reason: summary,
      total_disposed: Object.values(summary).reduce((a, b) => a + b, 0),
      assets: rows,
    });
  } catch (e) {
    console.error('[assets/disposed] fatal', e);
    return res.status(500).json({ error: e?.message || 'internal_error' });
  }
}
