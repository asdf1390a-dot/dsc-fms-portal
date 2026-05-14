// POST /api/backup/cleanup/manual — caller-initiated delete of one backup.
//
// Body: { backup_id: uuid }
// Auth: Bearer JWT (user). The backup must belong to the caller.
//
// Steps:
//   1. Verify ownership via backups.user_id.
//   2. Purge Supabase Storage objects under backups/{user_id}/{backup_id}/ (best-effort).
//   3. Delete backups row (cascade clears backup_files).
//   4. Insert a deletion_scheduled notification.

import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { requireUser } from '../../../../lib/career-auth';

const STORAGE_BUCKET = 'backups';

async function purgeBackupObjects(userId, backupId) {
  const prefix = `${userId}/${backupId}`;
  const { data: entries, error: listErr } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .list(prefix, { limit: 1000 });
  if (listErr) throw new Error(`storage list failed: ${listErr.message}`);
  if (!entries || entries.length === 0) return 0;
  const paths = entries.map((e) => `${prefix}/${e.name}`);
  const { error: rmErr } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .remove(paths);
  if (rmErr) throw new Error(`storage remove failed: ${rmErr.message}`);
  return paths.length;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const { user, error: authErr } = await requireUser(req);
  if (authErr) return res.status(authErr.status).json(authErr.body);

  const body = req.body || {};
  const backup_id = typeof body.backup_id === 'string' ? body.backup_id.trim() : '';
  if (!/^[0-9a-f-]{36}$/i.test(backup_id)) {
    return res.status(400).json({ error: 'invalid_request', details: ['backup_id must be uuid'] });
  }

  try {
    // 1. Ownership check
    const { data: backup, error: getErr } = await supabaseAdmin
      .from('backups')
      .select('id, user_id, name, size_bytes')
      .eq('id', backup_id)
      .maybeSingle();
    if (getErr) return res.status(500).json({ error: getErr.message });
    if (!backup) return res.status(404).json({ error: 'backup_not_found' });
    if (backup.user_id !== user.id) {
      return res.status(403).json({ error: 'forbidden_not_owner' });
    }

    // 2. Storage purge (best-effort; we still delete DB row if storage fails).
    let storageWarning = null;
    try {
      await purgeBackupObjects(user.id, backup_id);
    } catch (e) {
      storageWarning = String(e?.message || e);
      console.warn('[cleanup/manual] storage purge warning', backup_id, storageWarning);
    }

    // 3. DB delete
    const { error: delErr } = await supabaseAdmin
      .from('backups')
      .delete()
      .eq('id', backup_id)
      .eq('user_id', user.id);
    if (delErr) return res.status(500).json({ error: delErr.message });

    // 4. Notification (non-fatal)
    await supabaseAdmin.from('backup_notifications').insert({
      user_id: user.id,
      backup_id: null,
      notification_type: 'deletion_scheduled',
      notification_channel: 'in_app',
      message: `Manually deleted backup "${backup.name}".`,
    });

    return res.status(200).json({
      success: true,
      backup_id,
      freed_bytes: Number(backup.size_bytes) || 0,
      storage_warning: storageWarning,
    });
  } catch (e) {
    console.error('[cleanup/manual] fatal', e);
    return res.status(500).json({ error: e?.message || 'internal_error' });
  }
}
