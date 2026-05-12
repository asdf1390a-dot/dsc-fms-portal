import { getUserFromRequest, userScopedClient } from '../../../lib/api-auth';
import { supabaseAdmin } from '../../../lib/supabase-admin';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const month = (req.query.month || '').toString();
    if (!/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ error: 'month must be YYYY-MM' });
    let q = supabaseAdmin.from('kpi_actuals').select('*').eq('target_month', `${month}-01`);
    if (!req.query.weekly) q = q.is('week_number', null);
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ items: data || [] });
  }

  if (req.method === 'POST') {
    const { user, token } = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: 'unauthorized' });
    const sb = userScopedClient(token);
    const body = req.body || {};
    const rows = Array.isArray(body.items) ? body.items : [body];
    const payload = rows
      .filter(r => r && r.category_id && r.target_month && r.actual_value != null && r.actual_value !== '')
      .map(r => ({
        category_id: r.category_id,
        target_month: r.target_month,
        week_number: r.week_number ?? null,
        actual_value: Number(r.actual_value),
        is_auto: !!r.is_auto,
        source_note: r.source_note || null,
        note: r.note || null,
        created_by: user.id,
      }));
    if (payload.length === 0) return res.status(400).json({ error: 'no valid rows' });

    const { data, error } = await sb
      .from('kpi_actuals')
      .upsert(payload, { onConflict: 'category_id,target_month,week_number' })
      .select();
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ items: data });
  }

  return res.status(405).json({ error: 'method not allowed' });
}
