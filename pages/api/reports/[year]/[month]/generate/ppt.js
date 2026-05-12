// /api/reports/[year]/[month]/generate/ppt
// 플레이스홀더: 서버사이드 Python 작업 큐로 처리 예정.
// 현 단계는 JSON으로 상태와 데이터 페이로드만 반환.
import { supabaseAdmin } from '../../../../../../lib/supabase-admin';

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'method not allowed' });
  }
  const year = parseInt(req.query.year, 10);
  const month = parseInt(req.query.month, 10);
  if (!year || !month) return res.status(400).json({ error: 'invalid year/month' });

  const { data: row, error } = await supabaseAdmin
    .from('management_reports')
    .select('*').eq('year', year).eq('month', month).maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!row) return res.status(404).json({ error: 'report not found' });

  // 상태 기록 (pending)
  await supabaseAdmin
    .from('management_reports')
    .update({
      file_status: {
        ...(row.file_status || {}),
        ppt: { status: 'pending', requested_at: new Date().toISOString() },
      },
    })
    .eq('year', year).eq('month', month);

  return res.json({
    status: 'pending',
    message: 'PPT 생성은 서버 작업으로 처리됩니다',
    payload: {
      year, month,
      production: row.production || {},
      quality: row.quality || {},
      weekly_tasks: row.weekly_tasks || [],
    },
  });
}
