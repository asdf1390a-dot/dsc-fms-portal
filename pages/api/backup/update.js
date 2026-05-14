// PUT /api/backup/update?id=<id> — update backup metadata
import { supabaseAdmin } from '../../../lib/supabase-admin';
import { requireUser } from '../../../lib/career-auth';

export default async function handler(req, res) {
  const { user, error: authErr } = await requireUser(req);
  if (authErr) return res.status(authErr.status).json(authErr.body);

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'id is required' });

  if (req.method === 'PUT') {
    const body = req.body || {};

    // Verify ownership
    const { data: backup } = await supabaseAdmin
      .from('backups')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (!backup) {
      return res.status(404).json({ error: 'backup_not_found' });
    }

    const updates = {};
    if ('status' in body) updates.status = body.status;
    if ('size_bytes' in body) updates.size_bytes = body.size_bytes;
    if ('file_count' in body) updates.file_count = body.file_count;
    if ('completed_at' in body) updates.completed_at = body.completed_at;
    if ('metadata' in body) updates.metadata = body.metadata;
    if ('notes' in body) updates.notes = body.notes;

    const { data, error } = await supabaseAdmin
      .from('backups')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ backup: data });
  }

  res.setHeader('Allow', 'PUT');
  return res.status(405).json({ error: 'method_not_allowed' });
}
