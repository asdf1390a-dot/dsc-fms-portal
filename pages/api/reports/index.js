// /api/reports
// GET  : 월별 보고 목록 (year, month, production/quality 요약, file_status)
// POST : 새 월 보고 생성 { year, month }
import { getUserFromRequest } from '../../../lib/api-auth';
import { supabaseAdmin } from '../../../lib/supabase-admin';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('management_reports')
      .select('id, year, month, production, quality, weekly_tasks, file_status, source_file, updated_at')
      .order('year', { ascending: false })
      .order('month', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ items: data || [] });
  }

  if (req.method === 'POST') {
    const { user } = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: 'unauthorized' });

    const year = parseInt(req.body?.year, 10);
    const month = parseInt(req.body?.month, 10);
    if (!year || !month || month < 1 || month > 12) {
      return res.status(400).json({ error: 'year/month required (month 1-12)' });
    }

    const { data, error } = await supabaseAdmin
      .from('management_reports')
      .upsert(
        { year, month, production: {}, quality: {}, weekly_tasks: [] },
        { onConflict: 'year,month', ignoreDuplicates: false }
      )
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ item: data });
  }

  return res.status(405).json({ error: 'method not allowed' });
}
