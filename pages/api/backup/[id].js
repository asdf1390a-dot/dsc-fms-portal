// GET /api/backup/[id] — get single backup
// DELETE /api/backup/[id] — delete backup
import { supabaseAdmin } from '../../../lib/supabase-admin';
import { requireUser } from '../../../lib/career-auth';

export default async function handler(req, res) {
  const { user, error: authErr } = await requireUser(req);
  if (authErr) return res.status(authErr.status).json(authErr.body);

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'id is required' });

  if (req.method === 'GET') {
    const { data: backup, error } = await supabaseAdmin
      .from('backups')
      .select(`
        *,
        backup_files (*)
      `)
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error) {
      return res.status(404).json({ error: 'backup_not_found' });
    }

    return res.status(200).json({ backup });
  }

  if (req.method === 'DELETE') {
    // Verify ownership
    const { data: backup, error: fetchErr } = await supabaseAdmin
      .from('backups')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (fetchErr) {
      return res.status(404).json({ error: 'backup_not_found' });
    }

    const { error: deleteErr } = await supabaseAdmin
      .from('backups')
      .delete()
      .eq('id', id);

    if (deleteErr) {
      return res.status(500).json({ error: deleteErr.message });
    }

    return res.status(200).json({ success: true });
  }

  res.setHeader('Allow', 'GET, DELETE');
  return res.status(405).json({ error: 'method_not_allowed' });
}
