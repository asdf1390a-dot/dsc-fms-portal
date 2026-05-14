// POST /api/backup/create — create new backup
import { supabaseAdmin } from '../../../lib/supabase-admin';
import { requireUser } from '../../../lib/career-auth';

export default async function handler(req, res) {
  const { user, error: authErr } = await requireUser(req);
  if (authErr) return res.status(authErr.status).json(authErr.body);

  if (req.method === 'POST') {
    const body = req.body || {};

    if (!body.name) {
      return res.status(400).json({ error: 'name is required' });
    }

    const payload = {
      user_id: user.id,
      name: body.name,
      backup_type: body.backup_type || 'agent_state',
      status: body.status || 'pending',
      size_bytes: body.size_bytes || null,
      file_count: body.file_count || 0,
      storage_path: body.storage_path || null,
      metadata: body.metadata || {},
      notes: body.notes || null,
      created_by: user.id,
    };

    const { data, error } = await supabaseAdmin
      .from('backups')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(201).json({ backup: data });
  }

  res.setHeader('Allow', 'POST');
  return res.status(405).json({ error: 'method_not_allowed' });
}
