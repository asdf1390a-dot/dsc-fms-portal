// /api/career/achievements — list (?companyId) + create
import { supabaseAdmin } from '../../../lib/supabase-admin';
import { requireUser } from '../../../lib/career-auth';

export default async function handler(req, res) {
  const { user, error: authErr } = await requireUser(req);
  if (authErr) return res.status(authErr.status).json(authErr.body);

  if (req.method === 'GET') {
    const { companyId } = req.query;
    let q = supabaseAdmin
      .from('career_achievements')
      .select('*')
      .eq('user_id', user.id)
      .order('achieved_at', { ascending: false, nullsFirst: false });
    if (companyId) q = q.eq('company_id', companyId);
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ achievements: data });
  }

  if (req.method === 'POST') {
    const b = req.body || {};
    if (!b.title || !b.company_id) {
      return res.status(400).json({ error: 'title and company_id required' });
    }
    const payload = {
      user_id:          user.id,
      company_id:       b.company_id,
      project_id:       b.project_id || null,
      title:            b.title,
      detail:           b.detail || null,
      achieved_at:      b.achieved_at || null,
      achievement_type: b.achievement_type || 'improvement',
      metric_label:     b.metric_label || null,
      metric_before:    b.metric_before || null,
      metric_after:     b.metric_after || null,
      is_public:        !!b.is_public,
      sort_order:       b.sort_order ?? 0,
    };
    const { data, error } = await supabaseAdmin
      .from('career_achievements')
      .insert(payload)
      .select('*')
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ achievement: data });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'method_not_allowed' });
}
