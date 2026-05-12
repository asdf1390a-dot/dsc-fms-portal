// /api/kpi/targets — GET (read) / POST (admin upsert)
import { supabaseAdmin } from '../../../lib/supabase-admin';
import { requireUser } from '../../../lib/career-auth';
import { requireAdmin, normMonth } from '../../../lib/kpi-auth';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { error: authErr } = await requireUser(req);
    if (authErr) return res.status(authErr.status).json(authErr.body);
    const month = normMonth(req.query.month);
    if (!month) return res.status(400).json({ error: 'month_required' });
    const { data, error } = await supabaseAdmin
      .from('kpi_targets')
      .select('*')
      .eq('target_month', month);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ targets: data || [] });
  }

  if (req.method === 'POST') {
    const { user, error: authErr } = await requireAdmin(req);
    if (authErr) return res.status(authErr.status).json(authErr.body);

    const b = req.body || {};
    const month = normMonth(b.target_month);
    const categoryId = String(b.category_id || '').trim();
    if (!month || !categoryId) {
      return res.status(400).json({ error: 'category_id and target_month required' });
    }
    if (b.target_value == null || isNaN(Number(b.target_value))) {
      return res.status(400).json({ error: 'target_value required' });
    }
    const payload = {
      category_id:  categoryId,
      target_month: month,
      target_value: Number(b.target_value),
      note:         b.note || null,
      created_by:   user.id,
    };
    const { data, error } = await supabaseAdmin
      .from('kpi_targets')
      .upsert(payload, { onConflict: 'category_id,target_month' })
      .select('*')
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ target: data });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'method_not_allowed' });
}
