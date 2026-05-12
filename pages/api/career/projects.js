// /api/career/projects — list (?companyId) + create
import { supabaseAdmin } from '../../../lib/supabase-admin';
import { requireUser } from '../../../lib/career-auth';

export default async function handler(req, res) {
  const { user, error: authErr } = await requireUser(req);
  if (authErr) return res.status(authErr.status).json(authErr.body);

  if (req.method === 'GET') {
    const { companyId } = req.query;
    let q = supabaseAdmin
      .from('career_projects')
      .select('*')
      .eq('user_id', user.id)
      .order('start_date', { ascending: false, nullsFirst: false });
    if (companyId) q = q.eq('company_id', companyId);
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ projects: data });
  }

  if (req.method === 'POST') {
    const b = req.body || {};
    if (!b.title || !b.company_id) {
      return res.status(400).json({ error: 'title and company_id required' });
    }
    const payload = {
      user_id:      user.id,
      company_id:   b.company_id,
      title:        b.title,
      summary:      b.summary || null,
      description:  b.description || null,
      role:         b.role || null,
      start_date:   b.start_date || null,
      end_date:     b.end_date || null,
      is_ongoing:   !!b.is_ongoing,
      category:     b.category || 'improvement',
      tags:         Array.isArray(b.tags) ? b.tags : [],
      kpi_label:    b.kpi_label || null,
      kpi_value:    b.kpi_value || null,
      kpi_detail:   b.kpi_detail || null,
      is_public:    !!b.is_public,
      is_featured:  !!b.is_featured,
      fms_ref_type: b.fms_ref_type || null,
      fms_ref_ids:  Array.isArray(b.fms_ref_ids) ? b.fms_ref_ids : [],
      sort_order:   b.sort_order ?? 0,
    };
    const { data, error } = await supabaseAdmin
      .from('career_projects')
      .insert(payload)
      .select('*')
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ project: data });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'method_not_allowed' });
}
