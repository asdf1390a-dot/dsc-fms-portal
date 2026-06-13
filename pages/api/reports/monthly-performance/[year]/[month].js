// GET  /api/reports/monthly-performance/[year]/[month]  → 상세 (CEO 전용)
// 응답: { item, history, insights_live }
import { getUserFromRequest } from '../../../../../lib/api-auth';
import { supabaseAdmin } from '../../../../../lib/supabase-admin';
import {
  isCeoOrAdmin, logAccess, buildInsights, fetchHistory,
} from '../../../../../lib/reports/monthly-performance';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });

  const { user } = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  if (!isCeoOrAdmin(user)) return res.status(403).json({ error: 'forbidden: CEO only' });

  const year = parseInt(req.query.year, 10);
  const month = parseInt(req.query.month, 10);
  if (!year || !month || month < 1 || month > 12) {
    return res.status(400).json({ error: 'invalid year/month' });
  }

  const { data: item, error } = await supabaseAdmin
    .from('monthly_performance_reports')
    .select('*')
    .eq('year', year).eq('month', month)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!item) return res.status(404).json({ error: 'not found' });

  const history = await fetchHistory(year, month, 6);
  const insightsLive = buildInsights(item.kpi || {}, history);

  await logAccess({ reportId: item.id, user, action: 'view', req });

  return res.json({ item, history, insights_live: insightsLive });
}
