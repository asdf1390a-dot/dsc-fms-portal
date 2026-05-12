import { getUserFromRequest } from '../../../lib/api-auth';
import { supabaseAdmin } from '../../../lib/supabase-admin';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  const { user } = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'unauthorized' });

  const month = (req.body?.month || req.query?.month || '').toString();
  const target = /^\d{4}-\d{2}$/.test(month) ? `${month}-01` : null;

  const { error } = await supabaseAdmin.rpc('kpi_auto_sync', target ? { target_month: target } : {});
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ ok: true, month: target });
}
