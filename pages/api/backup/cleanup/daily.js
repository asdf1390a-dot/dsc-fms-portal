// POST /api/backup/cleanup/daily — daily cron to purge expired backups.
//
// For each user with a backup_policies row where auto_delete_enabled=true:
//   - call get_expired_backups(user_id, retention_days)
//   - delete files in Supabase Storage at backups/{user_id}/{backup_id}/*
//   - delete the backups row (cascades backup_files)
//   - insert a backup_notifications row (type='deletion_scheduled')
//
// Auth: Authorization: Bearer <CRON_SECRET>
//
// Vercel cron (vercel.json):
//   { "path": "/api/backup/cleanup/daily", "schedule": "0 18 * * *" }
// 18:00 UTC = 03:00 KST next day.

import { supabaseAdmin } from '../../../../lib/supabase-admin';
import {
  sendBackupNotification,
  buildDeletionScheduledMessage,
} from '../../../../lib/backup-notifications';

const STORAGE_BUCKET = 'backups';

// List + remove every object under `backups/{user_id}/{backup_id}/`.
// Returns number of objects removed.
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

  const cronSecret = (req.headers['authorization'] || '').replace(/^Bearer\s+/, '');
  if (!process.env.CRON_SECRET || cronSecret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const startedAt = new Date().toISOString();

  try {
    const { data: policies, error: polErr } = await supabaseAdmin
      .from('backup_policies')
      .select('user_id, retention_days, auto_delete_enabled')
      .eq('auto_delete_enabled', true);
    if (polErr) return res.status(500).json({ error: polErr.message });

    let deletedBackups = 0;
    let freedBytes = 0;
    let processedUsers = 0;
    const errors = [];

    for (const p of policies || []) {
      processedUsers += 1;
      try {
        const { data: expired, error: expErr } = await supabaseAdmin.rpc(
          'get_expired_backups',
          {
            user_id_param: p.user_id,
            retention_days: p.retention_days || 90,
          },
        );
        if (expErr) {
          errors.push({ user_id: p.user_id, error: expErr.message });
          continue;
        }

        for (const row of expired || []) {
          try {
            // Best-effort storage cleanup; row delete proceeds even if files missing.
            try {
              await purgeBackupObjects(p.user_id, row.backup_id);
            } catch (e) {
              errors.push({
                user_id: p.user_id,
                backup_id: row.backup_id,
                stage: 'storage',
                error: String(e?.message || e),
              });
            }

            const { error: delErr } = await supabaseAdmin
              .from('backups')
              .delete()
              .eq('id', row.backup_id)
              .eq('user_id', p.user_id);
            if (delErr) {
              errors.push({
                user_id: p.user_id,
                backup_id: row.backup_id,
                stage: 'db',
                error: delErr.message,
              });
              continue;
            }

            deletedBackups += 1;
            freedBytes += Number(row.size_bytes) || 0;

            // Dispatch via centralized sender so email/telegram channels also
            // fire (configured per backup_policies.notification_channel).
            // in_app row is always persisted.
            try {
              await sendBackupNotification({
                userId: p.user_id,
                type: 'deletion_scheduled',
                backupId: null, // backup row is gone; FK is set null
                message: buildDeletionScheduledMessage({
                  backup_name: row.backup_name,
                  date: new Date().toISOString().slice(0, 10),
                  retention_days: p.retention_days || 90,
                }),
                metadata: {
                  backup_name: row.backup_name,
                  retention_days: p.retention_days || 90,
                  size_bytes: row.size_bytes || 0,
                },
              });
            } catch (e) {
              console.error('[cleanup/daily] notification dispatch', e?.message);
            }
          } catch (e) {
            errors.push({
              user_id: p.user_id,
              backup_id: row.backup_id,
              error: String(e?.message || e),
            });
          }
        }
      } catch (e) {
        errors.push({ user_id: p.user_id, error: String(e?.message || e) });
      }
    }

    return res.status(200).json({
      success: true,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      processed_users: processedUsers,
      deleted_backups: deletedBackups,
      freed_storage_bytes: freedBytes,
      errors: errors.slice(0, 50),
    });
  } catch (e) {
    console.error('[cleanup/daily] fatal', e);
    return res.status(500).json({ error: e?.message || 'internal_error' });
  }
}
