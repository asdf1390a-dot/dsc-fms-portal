// GET /api/reports/monthly-performance/[year]/[month]/access-logs
//   - CEO 전용. 해당 보고에 대한 감사 로그 목록.
import { getUserFromRequest } from '../../../../../../lib/api-auth';
import { supabaseAdmin } from '../../../../../../lib/supabase-admin';
import { isCeoOrAdmin } from '../../../../../../lib/reports/monthly-performance';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });

  const { user } = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  if (!isCeoOrAdmin(user)) return res.status(403).json({ error: 'forbidden: CEO only' });

  const year = parseInt(req.query.year, 10);
  const month = parseInt(req.query.month, 10);

  const { data: r } = await supabaseAdmin
    .from('monthly_performance_reports')
    .select('id')
    .eq('year', year).eq('month', month)
    .maybeSingle();
  if (!r) return res.json({ items: [] });

  const { data, error } = await supabaseAdmin
    .from('monthly_report_access_logs')
    .select('id, user_id, user_email, action, ip_address, user_agent, created_at')
    .eq('report_id', r.id)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) return res.status(500).json({ error: error.message });

  return res.json({ items: data || [] });
}
