// /api/kpi/actuals/[id] — PATCH / DELETE (admin)
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { requireAdmin } from '../../../../lib/kpi-auth';

const ALLOWED = ['actual_value', 'source_note', 'is_auto'];

export default async function handler(req, res) {
  const { error: authErr } = await requireAdmin(req);
  if (authErr) return res.status(authErr.status).json(authErr.body);

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'id_required' });

  if (req.method === 'PATCH') {
    const body = req.body || {};
    const patch = {};
    for (const k of ALLOWED) if (k in body) patch[k] = body[k];
    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: 'no_fields' });
    }
    const { data, error } = await supabaseAdmin
      .from('kpi_actuals')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ actual: data });
  }

  if (req.method === 'DELETE') {
    const { error } = await supabaseAdmin
      .from('kpi_actuals')
      .delete()
      .eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(204).end();
  }

  res.setHeader('Allow', 'PATCH, DELETE');
  return res.status(405).json({ error: 'method_not_allowed' });
}
