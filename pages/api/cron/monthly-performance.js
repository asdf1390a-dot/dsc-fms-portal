// /api/cron/monthly-performance
// 매월 1일 05:00 KST = 20:00 UTC (전일) 실행
// vercel.json 의 schedule: "0 20 1 * *"  (1일 KST 05:00 ≈ 매월 1일 UTC 20:00은 KST 2일이므로
//  정확히 1일 05:00 KST 를 원할 경우 schedule을 "0 20 L * *" 또는 "0 20 * * *" 등 조정 필요)
// 여기서는 "매월 1일 KST 05:00 = 매월 1일 20:00 UTC 의 전날"이라서
// 실제로는 schedule: "0 20 1 * *" 가 KST 2일 05:00 이 됩니다.
// → 정확히 KST 1일 05:00 을 맞추려면 UTC 기준 매월 마지막 날 20:00 이어야 하나
//   Vercel cron 은 "L" 미지원. 대안: 매일 새벽 호출 후 내부에서 1일만 처리.
import { autoExtractKpi, buildInsights, fetchHistory } from '../../../lib/reports/monthly-performance';
import { supabaseAdmin } from '../../../lib/supabase-admin';

export default async function handler(req, res) {
  // Vercel cron 헤더 확인
  if (!req.headers['x-vercel-cron'] && req.query?.secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  // KST 기준 오늘이 1일인지 확인 (매일 호출 + 1일만 처리 방식)
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const isFirst = kst.getUTCDate() === 1;
  if (!isFirst && req.query?.force !== '1') {
    return res.json({ skipped: true, reason: 'not the 1st of month (KST)' });
  }

  // 직전 달 산출
  const t = new Date(kst.getUTCFullYear(), kst.getUTCMonth() - 1, 1);
  const year = t.getFullYear();
  const month = t.getMonth() + 1;

  const kpi = await autoExtractKpi(year, month);
  const history = await fetchHistory(year, month, 6);
  const insights = buildInsights(kpi, history);

  const { data, error } = await supabaseAdmin
    .from('monthly_performance_reports')
    .upsert({
      year, month, kpi, insights,
      is_auto: true, status: 'published',
      generated_at: new Date().toISOString(),
    }, { onConflict: 'year,month' })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  await supabaseAdmin.from('monthly_report_access_logs').insert({
    report_id: data.id, user_email: 'system@cron', action: 'generate',
  });

  return res.json({ ok: true, item: data });
}
