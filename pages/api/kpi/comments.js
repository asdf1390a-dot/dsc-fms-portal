// /api/kpi/comments — GET (read) / POST (admin)
import { supabaseAdmin } from '../../../lib/supabase-admin';
import { requireUser } from '../../../lib/career-auth';
import { requireAdmin, normMonth } from '../../../lib/kpi-auth';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { error: authErr } = await requireUser(req);
    if (authErr) return res.status(authErr.status).json(authErr.body);
    const month = normMonth(req.query.month);
    if (!month) return res.status(400).json({ error: 'month_required' });
    let q = supabaseAdmin
      .from('kpi_comments')
      .select('*')
      .eq('target_month', month)
      .order('created_at', { ascending: false });
    if (req.query.categoryId) q = q.eq('category_id', req.query.categoryId);
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ comments: data || [] });
  }

  if (req.method === 'POST') {
    const { user, error: authErr } = await requireAdmin(req);
    if (authErr) return res.status(authErr.status).json(authErr.body);

    const b = req.body || {};
    const month = normMonth(b.target_month);
    const body = String(b.body || '').trim();
    if (!month || !body) return res.status(400).json({ error: 'target_month and body required' });

    const payload = {
      target_month: month,
      category_id:  b.category_id || null,
      body,
      created_by:   user.id,
    };
    const { data, error } = await supabaseAdmin
      .from('kpi_comments')
      .insert(payload)
      .select('*')
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ comment: data });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'method_not_allowed' });
}
