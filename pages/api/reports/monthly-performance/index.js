// GET  /api/reports/monthly-performance  → CEO 전용 목록
// 응답: { items: [{ id, year, month, status, generated_at, has_file }] }
import { getUserFromRequest } from '../../../../lib/api-auth';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { isCeoOrAdmin, logAccess } from '../../../../lib/reports/monthly-performance';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'method not allowed' });
  }
  const { user } = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  if (!isCeoOrAdmin(user)) return res.status(403).json({ error: 'forbidden: CEO only' });

  const { data, error } = await supabaseAdmin
    .from('monthly_performance_reports')
    .select('id, year, month, status, generated_at, source_file_path, is_auto, updated_at')
    .order('year', { ascending: false })
    .order('month', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  await logAccess({ user, action: 'view', req });

  return res.json({
    items: (data || []).map((r) => ({
      ...r,
      has_file: !!r.source_file_path,
    })),
  });
}
