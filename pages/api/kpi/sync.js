// /api/kpi/sync — POST → bm_kpi → kpi_actuals(mttr/mtbf) 자동 동기화
import { supabaseAdmin } from '../../../lib/supabase-admin';
import { requireAdmin, normMonth } from '../../../lib/kpi-auth';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  const { error: authErr } = await requireAdmin(req);
  if (authErr) return res.status(authErr.status).json(authErr.body);

  const month = normMonth(req.body?.target_month);
  if (!month) return res.status(400).json({ error: 'target_month_required' });

  const { data, error } = await supabaseAdmin.rpc('kpi_auto_sync', { target_month: month });
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ month, synced: data || [] });
}
