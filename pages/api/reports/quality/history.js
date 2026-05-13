// GET /api/reports/quality/history
// Returns the latest 12 months of generation history.

import { supabaseAdmin } from '../../../../lib/supabase-admin';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'missing_token' });
  const { data: who, error: whoErr } = await supabaseAdmin.auth.getUser(token);
  if (whoErr || !who?.user) return res.status(401).json({ error: 'invalid_token' });

  const { data, error } = await supabaseAdmin
    .from('quality_report_history')
    .select('id, target_month, status, error_msg, output_excel_name, output_ppt_name, created_at, created_by')
    .order('created_at', { ascending: false })
    .limit(24);
  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ items: data || [] });
}
