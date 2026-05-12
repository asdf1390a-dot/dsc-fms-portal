import { getUserFromRequest } from '../../../lib/api-auth';
import { supabaseAdmin } from '../../../lib/supabase-admin';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  const { user } = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'unauthorized' });

  const b = req.body || {};
  if (!b.plan_id || !b.start_date) return res.status(400).json({ error: 'plan_id and start_date required' });
  const count = Math.min(60, parseInt(b.count, 10) || 12);

  const { data, error } = await supabaseAdmin.rpc('pm_generate_schedules', {
    p_plan_id: b.plan_id,
    p_start_date: b.start_date,
    p_count: count,
  });
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ inserted: data });
}
