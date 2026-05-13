// GET /api/reports/quality/download?id=<uuid>&type=excel|ppt
// Returns a 10-minute signed URL for the requested artifact.

import { supabaseAdmin } from '../../../../lib/supabase-admin';

const BUCKET = 'quality-reports';

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

  const { id, type } = req.query;
  if (!id || !type || (type !== 'excel' && type !== 'ppt')) {
    return res.status(400).json({ error: 'bad_params' });
  }

  const { data: row, error } = await supabaseAdmin
    .from('quality_report_history')
    .select('output_excel_path, output_ppt_path, output_excel_name, output_ppt_name, status')
    .eq('id', id)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!row)  return res.status(404).json({ error: 'not_found' });
  if (row.status !== 'done') return res.status(409).json({ error: 'not_ready', status: row.status });

  const path = type === 'excel' ? row.output_excel_path : row.output_ppt_path;
  const name = type === 'excel' ? row.output_excel_name : row.output_ppt_name;
  if (!path) return res.status(404).json({ error: 'no_artifact' });

  const { data: signed, error: sErr } = await supabaseAdmin.storage
    .from(BUCKET).createSignedUrl(path, 600, { download: name });
  if (sErr) return res.status(500).json({ error: sErr.message });

  return res.status(200).json({ url: signed.signedUrl, filename: name });
}
