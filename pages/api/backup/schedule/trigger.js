// POST /api/backup/schedule/trigger — start an immediate backup for the caller.
// Concurrency guard: skip if a pending/in_progress backup already exists.

import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { requireUser } from '../../../../lib/career-auth';
import {
  sendBackupNotification,
  buildSuccessMessage,
  buildFailureMessage,
} from '../../../../lib/backup-notifications';

// Internal helper, also used by daily-cron.
// Returns { skipped: true, reason } if a backup is already running,
// or { backup } when a new row was created.
export async function createUserBackup({ userId, name, metadata = {}, notes = null }) {
  // 1. Concurrency check
  const { data: running, error: checkErr } = await supabaseAdmin
    .from('backups')
    .select('id, status, created_at')
    .eq('user_id', userId)
    .in('status', ['pending', 'in_progress'])
    .limit(1);

  if (checkErr) {
    return { error: { status: 500, body: { error: checkErr.message } } };
  }
  if (running && running.length > 0) {
    return {
      skipped: true,
      reason: 'backup_in_progress',
      existing_backup_id: running[0].id,
    };
  }

  // 2. Insert new backup row (status=pending; downstream worker promotes it)
  const backupName =
    name && typeof name === 'string'
      ? name
      : `Auto Backup ${new Date().toISOString().slice(0, 19).replace('T', ' ')}`;

  const payload = {
    user_id: userId,
    name: backupName,
    backup_type: 'agent_state',
    status: 'pending',
    file_count: 0,
    metadata,
    notes,
    created_by: userId,
  };

  const { data, error } = await supabaseAdmin
    .from('backups')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    return { error: { status: 500, body: { error: error.message } } };
  }

  // Fire-and-await terminal-state notifications.
  // The trigger endpoint normally returns status=pending (a worker promotes it),
  // but if a synchronous backup implementation lands later that completes
  // inline, this branch will deliver the notification immediately.
  try {
    if (data?.status === 'completed') {
      await sendBackupNotification({
        userId,
        type: 'success',
        backupId: data.id,
        message: buildSuccessMessage({
          backup_name: data.name,
          size_bytes: data.size_bytes,
        }),
        metadata: { backup_name: data.name, size_bytes: data.size_bytes },
      });
    } else if (data?.status === 'failed') {
      await sendBackupNotification({
        userId,
        type: 'failure',
        backupId: data.id,
        message: buildFailureMessage({ error_message: data.error_message }),
        metadata: { backup_name: data.name, error: data.error_message },
      });
    }
  } catch (e) {
    console.error('[trigger] notification dispatch failed', e?.message);
  }

  return { backup: data };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const { user, error: authErr } = await requireUser(req);
  if (authErr) return res.status(authErr.status).json(authErr.body);

  const body = req.body || {};
  const name = typeof body.name === 'string' ? body.name.slice(0, 255) : undefined;

  const result = await createUserBackup({
    userId: user.id,
    name,
    metadata: { trigger: 'manual' },
    notes: 'Manually triggered via /api/backup/schedule/trigger',
  });

  if (result.error) {
    return res.status(result.error.status).json(result.error.body);
  }
  if (result.skipped) {
    return res.status(202).json({
      skipped: true,
      reason: result.reason,
      existing_backup_id: result.existing_backup_id,
    });
  }
  return res.status(201).json({ backup: result.backup });
}
