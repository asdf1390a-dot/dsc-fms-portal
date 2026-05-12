// /api/reports/[year]/[month]
// GET    : 단월 전체 데이터
// PATCH  : production / quality / weekly_tasks / file_status / source_file 부분 업데이트 (merge)
// DELETE : 단월 삭제
import { getUserFromRequest } from '../../../../../lib/api-auth';
import { supabaseAdmin } from '../../../../../lib/supabase-admin';

const FIELDS = ['production', 'quality', 'weekly_tasks', 'file_status', 'source_file'];

export default async function handler(req, res) {
  const year = parseInt(req.query.year, 10);
  const month = parseInt(req.query.month, 10);
  if (!year || !month) return res.status(400).json({ error: 'invalid year/month' });

  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('management_reports')
      .select('*')
      .eq('year', year).eq('month', month)
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'not found' });
    return res.json({ item: data });
  }

  if (req.method === 'PATCH') {
    const { user } = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: 'unauthorized' });

    // 기존 row 조회 → merge → upsert (jsonb 부분 업데이트)
    const { data: existing } = await supabaseAdmin
      .from('management_reports')
      .select('*')
      .eq('year', year).eq('month', month)
      .maybeSingle();

    const patch = {};
    for (const f of FIELDS) {
      if (req.body?.[f] === undefined) continue;
      if (f === 'weekly_tasks') {
        // 배열은 통째 교체
        patch[f] = req.body[f];
      } else if (req.body[f] === null) {
        patch[f] = null;
      } else {
        const prev = existing?.[f] && typeof existing[f] === 'object' ? existing[f] : {};
        patch[f] = { ...prev, ...req.body[f] };
      }
    }

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: 'no valid fields' });
    }

    const row = { year, month, ...patch };
    const { data, error } = await supabaseAdmin
      .from('management_reports')
      .upsert(row, { onConflict: 'year,month' })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ item: data });
  }

  if (req.method === 'DELETE') {
    const { user } = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: 'unauthorized' });
    const { error } = await supabaseAdmin
      .from('management_reports')
      .delete().eq('year', year).eq('month', month);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: 'method not allowed' });
}
