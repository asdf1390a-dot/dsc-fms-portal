// /api/career/achievements/[id] — PATCH / DELETE
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { requireUser } from '../../../../lib/career-auth';

const ALLOWED = [
  'company_id','project_id','title','detail','achieved_at','achievement_type',
  'metric_label','metric_before','metric_after','is_public','sort_order',
];

export default async function handler(req, res) {
  const { user, error: authErr } = await requireUser(req);
  if (authErr) return res.status(authErr.status).json(authErr.body);

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'id required' });

  if (req.method === 'PATCH') {
    const b = req.body || {};
    const patch = {};
    for (const k of ALLOWED) if (k in b) patch[k] = b[k];
    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: 'no_fields' });
    }
    const { data, error } = await supabaseAdmin
      .from('career_achievements')
      .update(patch)
      .eq('id', id)
      .eq('user_id', user.id)
      .select('*')
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ achievement: data });
  }

  if (req.method === 'DELETE') {
    const { error } = await supabaseAdmin
      .from('career_achievements')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(204).end();
  }

  res.setHeader('Allow', 'PATCH, DELETE');
  return res.status(405).json({ error: 'method_not_allowed' });
}
