// POST /api/reports/monthly-performance/generate
//   body: { year, month, kpi? }  (kpi 미제공 시 management_reports에서 자동 추출)
//   - CEO/admin 수동 호출 가능
//   - 또는 cron 헤더 (x-vercel-cron 또는 ?secret=CRON_SECRET)
//   - upsert (year,month)
import { getUserFromRequest } from '../../../../lib/api-auth';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import {
  isCeoOrAdmin, logAccess, buildInsights, fetchHistory, autoExtractKpi,
} from '../../../../lib/reports/monthly-performance';

function isCronRequest(req) {
  if (req.headers['x-vercel-cron']) return true;
  const secret = process.env.CRON_SECRET;
  if (secret && req.query?.secret === secret) return true;
  return false;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const cron = isCronRequest(req);
  let user = null;
  if (!cron) {
    const r = await getUserFromRequest(req);
    user = r.user;
    if (!user) return res.status(401).json({ error: 'unauthorized' });
    if (!isCeoOrAdmin(user)) return res.status(403).json({ error: 'forbidden: CEO only' });
  }

  let { year, month, kpi } = req.body || {};
  // cron: 전월 자동 (매월 1일 호출 → 직전 달 보고 생성)
  if (cron && (!year || !month)) {
    const now = new Date();
    const t = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    year = t.getFullYear();
    month = t.getMonth() + 1;
  }
  year = parseInt(year, 10);
  month = parseInt(month, 10);
  if (!year || !month || month < 1 || month > 12) {
    return res.status(400).json({ error: 'invalid year/month' });
  }

  // KPI: 직접 제공 우선, 없으면 자동 추출
  let finalKpi = kpi && typeof kpi === 'object' ? kpi : await autoExtractKpi(year, month);

  // 트렌드 산출 (현재 record 저장 전에 과거만 조회 → OK)
  const history = await fetchHistory(year, month, 6);
  const insights = buildInsights(finalKpi, history);

  const payload = {
    year, month,
    kpi: finalKpi,
    insights,
    generated_by: user?.id || null,
    generated_at: new Date().toISOString(),
    is_auto: cron,
    status: 'published',
  };

  const { data, error } = await supabaseAdmin
    .from('monthly_performance_reports')
    .upsert(payload, { onConflict: 'year,month' })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });

  await logAccess({ reportId: data.id, user, action: 'generate', req });

  return res.json({ item: data });
}
