// /api/career/companies/[id] — GET / PATCH / DELETE
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { requireUser } from '../../../../lib/career-auth';

const ALLOWED = [
  'name','name_short','country','city','industry','logo_url',
  'department','title','employment_type','start_date','end_date',
  'is_current','is_public','sort_order',
];

export default async function handler(req, res) {
  const { user, error: authErr } = await requireUser(req);
  if (authErr) return res.status(authErr.status).json(authErr.body);

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'id required' });

  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('career_companies')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data)  return res.status(404).json({ error: 'not_found' });
    return res.status(200).json({ company: data });
  }

  if (req.method === 'PATCH') {
    const body = req.body || {};
    const patch = {};
    for (const k of ALLOWED) if (k in body) patch[k] = body[k];
    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: 'no_fields' });
    }
    const { data, error } = await supabaseAdmin
      .from('career_companies')
      .update(patch)
      .eq('id', id)
      .eq('user_id', user.id)
      .select('*')
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ company: data });
  }

  if (req.method === 'DELETE') {
    const { error } = await supabaseAdmin
      .from('career_companies')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(204).end();
  }

  res.setHeader('Allow', 'GET, PATCH, DELETE');
  return res.status(405).json({ error: 'method_not_allowed' });
}
