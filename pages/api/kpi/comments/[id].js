// /api/kpi/comments/[id] — DELETE (admin)
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { requireAdmin } from '../../../../lib/kpi-auth';

export default async function handler(req, res) {
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', 'DELETE');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  const { error: authErr } = await requireAdmin(req);
  if (authErr) return res.status(authErr.status).json(authErr.body);

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'id_required' });

  const { error } = await supabaseAdmin
    .from('kpi_comments')
    .delete()
    .eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  return res.status(204).end();
}
