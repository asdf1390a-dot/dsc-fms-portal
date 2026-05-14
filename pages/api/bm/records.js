import { supabaseAdmin } from '../../../lib/supabase-admin';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const date = req.query.date; // YYYY-MM-DD format
    const assetId = req.query.asset_id;
    const status = req.query.status;
    const limit = req.query.limit ? parseInt(req.query.limit) : 100;

    let q = supabaseAdmin
      .from('bm_events')
      .select('*, assets(id, machine_asset_number, name_en, location)')
      .order('reported_at', { ascending: false });

    // Filter by date if provided
    if (date) {
      const startOfDay = `${date}T00:00:00.000Z`;
      const endOfDay = `${date}T23:59:59.999Z`;
      q = q.gte('reported_at', startOfDay).lte('reported_at', endOfDay);
    }

    // Filter by asset if provided
    if (assetId) {
      q = q.eq('asset_id', assetId);
    }

    // Filter by status if provided
    if (status) {
      q = q.eq('status', status);
    }

    const { data, error } = await q.limit(limit);

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ items: data || [], count: data?.length || 0 });
  }

  return res.status(405).json({ error: 'method not allowed' });
}
