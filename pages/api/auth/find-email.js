// POST /api/auth/find-email
// body: { employee_id: "KNA001" }
// returns: { email } or 404

import { supabaseAdmin } from '../../../lib/supabase-admin';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  const { employee_id } = req.body || {};
  if (!employee_id || typeof employee_id !== 'string') {
    return res.status(400).json({ error: 'employee_id required' });
  }

  // Admin list users — Supabase doesn't support metadata filter, so paginate.
  // 1000 users is fine for SMB plant; revisit if larger.
  let page = 1;
  const perPage = 200;
  while (page <= 5) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) return res.status(500).json({ error: error.message });
    const match = (data.users || []).find(u => u.user_metadata?.employee_id === employee_id);
    if (match) return res.status(200).json({ email: match.email });
    if (!data.users?.length || data.users.length < perPage) break;
    page++;
  }
  return res.status(404).json({ error: 'not_found' });
}
