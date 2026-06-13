// GET /api/reports/monthly-performance/[year]/[month]/download
//   - CEO 전용. 첨부된 원본 파일 signed URL 반환
//   - 감사 로그 기록 (action='download')
import { getUserFromRequest } from '../../../../../../lib/api-auth';
import { supabaseAdmin } from '../../../../../../lib/supabase-admin';
import { isCeoOrAdmin, logAccess } from '../../../../../../lib/reports/monthly-performance';

const BUCKET = process.env.MPR_BUCKET || 'monthly-reports';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });

  const { user } = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  if (!isCeoOrAdmin(user)) return res.status(403).json({ error: 'forbidden: CEO only' });

  const year = parseInt(req.query.year, 10);
  const month = parseInt(req.query.month, 10);

  const { data: item, error } = await supabaseAdmin
    .from('monthly_performance_reports')
    .select('id, source_file_path, source_file_name')
    .eq('year', year).eq('month', month)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!item) return res.status(404).json({ error: 'not found' });
  if (!item.source_file_path) return res.status(404).json({ error: 'no file attached' });

  const { data: signed, error: sErr } = await supabaseAdmin
    .storage.from(BUCKET)
    .createSignedUrl(item.source_file_path, 60 * 5);
  if (sErr) return res.status(500).json({ error: sErr.message });

  await logAccess({ reportId: item.id, user, action: 'download', req });

  return res.json({
    url: signed.signedUrl,
    file_name: item.source_file_name || item.source_file_path.split('/').pop(),
  });
}
