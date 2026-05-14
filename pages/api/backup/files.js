// GET /api/backup/files?backup_id=<id> — list files in backup
// POST /api/backup/files — add file to backup
import { supabaseAdmin } from '../../../lib/supabase-admin';
import { requireUser } from '../../../lib/career-auth';

export default async function handler(req, res) {
  const { user, error: authErr } = await requireUser(req);
  if (authErr) return res.status(authErr.status).json(authErr.body);

  const { backup_id } = req.query;

  if (req.method === 'GET') {
    if (!backup_id) {
      return res.status(400).json({ error: 'backup_id is required' });
    }

    // Verify ownership of backup
    const { data: backup, error: backupErr } = await supabaseAdmin
      .from('backups')
      .select('id')
      .eq('id', backup_id)
      .eq('user_id', user.id)
      .single();

    if (backupErr) {
      return res.status(404).json({ error: 'backup_not_found' });
    }

    const { data: files, error } = await supabaseAdmin
      .from('backup_files')
      .select('*')
      .eq('backup_id', backup_id)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ files: files || [] });
  }

  if (req.method === 'POST') {
    if (!backup_id) {
      return res.status(400).json({ error: 'backup_id is required' });
    }

    const body = req.body || {};
    if (!body.file_path) {
      return res.status(400).json({ error: 'file_path is required' });
    }

    // Verify ownership
    const { data: backup } = await supabaseAdmin
      .from('backups')
      .select('id')
      .eq('id', backup_id)
      .eq('user_id', user.id)
      .single();

    if (!backup) {
      return res.status(404).json({ error: 'backup_not_found' });
    }

    const payload = {
      backup_id,
      file_path: body.file_path,
      file_type: body.file_type || null,
      file_size: body.file_size || null,
      storage_url: body.storage_url || null,
      checksum: body.checksum || null,
    };

    const { data, error } = await supabaseAdmin
      .from('backup_files')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(201).json({ file: data });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'method_not_allowed' });
}
