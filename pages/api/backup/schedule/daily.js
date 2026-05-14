// POST /api/backup/schedule/daily — Vercel Cron entrypoint (02:00 KST = 10:30 UTC the prior day at +5:30 IST; configured in vercel.json).
// Iterates every user with backup_enabled=true and creates a backup row.
// Also upserts backup_metrics for today (UTC date).
//
// Auth: requires header `Authorization: Bearer <CRON_SECRET>`.
// Vercel sets this automatically for cron jobs; manual invocation must supply it.

import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { createUserBackup } from './trigger';
import {
  sendBackupNotification,
  buildSuccessMessage,
  buildFailureMessage,
} from '../../../../lib/backup-notifications';

function todayUtcDate() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

async function upsertDailyMetrics({ userId, success, skipped, failed }) {
  const metric_date = todayUtcDate();

  // Read existing row (if any)
  const { data: existing } = await supabaseAdmin
    .from('backup_metrics')
    .select('*')
    .eq('user_id', userId)
    .eq('metric_date', metric_date)
    .maybeSingle();

  const row = {
    user_id: userId,
    metric_date,
    total_backups: (existing?.total_backups || 0) + 1,
    successful_backups: (existing?.successful_backups || 0) + (success ? 1 : 0),
    failed_backups: (existing?.failed_backups || 0) + (failed ? 1 : 0),
    skipped_backups: (existing?.skipped_backups || 0) + (skipped ? 1 : 0),
  };

  const { error } = await supabaseAdmin
    .from('backup_metrics')
    .upsert(row, { onConflict: 'user_id,metric_date' });

  if (error) {
    // Non-fatal — log and move on.
    console.error('[daily-cron] metrics upsert failed', userId, error.message);
  }
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
    // Fetch all enabled policies.
    const { data: policies, error: polErr } = await supabaseAdmin
      .from('backup_policies')
      .select('user_id, backup_enabled, backup_interval')
      .eq('backup_enabled', true);

    if (polErr) {
      return res.status(500).json({ error: polErr.message });
    }

    let processed = 0;
    let created = 0;
    let skipped = 0;
    let failed = 0;
    const errors = [];

    for (const p of policies || []) {
      processed += 1;
      try {
        const result = await createUserBackup({
          userId: p.user_id,
          name: `Daily Auto Backup ${todayUtcDate()}`,
          metadata: { trigger: 'cron', interval: p.backup_interval || 'daily' },
          notes: 'Created by /api/backup/schedule/daily',
        });

        if (result.error) {
          failed += 1;
          errors.push({ user_id: p.user_id, error: result.error.body });
          await upsertDailyMetrics({
            userId: p.user_id,
            success: false,
            skipped: false,
            failed: true,
          });
          // Failure notification — fire-and-forget (per-user errors must not
          // poison the cron run).
          try {
            await sendBackupNotification({
              userId: p.user_id,
              type: 'failure',
              message: buildFailureMessage({
                error_message:
                  (result.error.body && result.error.body.error) || 'cron failure',
              }),
              metadata: { error: result.error.body, trigger: 'cron' },
            });
          } catch (e) {
            console.error('[daily-cron] failure notification dispatch', e?.message);
          }
        } else if (result.skipped) {
          skipped += 1;
          await upsertDailyMetrics({
            userId: p.user_id,
            success: false,
            skipped: true,
            failed: false,
          });
          // No notification for skipped (concurrency guard) — would be noisy.
        } else {
          created += 1;
          await upsertDailyMetrics({
            userId: p.user_id,
            success: true,
            skipped: false,
            failed: false,
          });
          // Success notification. Note: the backup row was created in pending
          // state; the worker will deliver the *final* completion notification.
          // Here we only confirm the cron successfully queued a backup.
          try {
            const b = result.backup || {};
            await sendBackupNotification({
              userId: p.user_id,
              type: 'success',
              backupId: b.id || null,
              message: buildSuccessMessage({
                backup_name: b.name,
                size_bytes: b.size_bytes || 0,
              }),
              metadata: {
                backup_name: b.name,
                size_bytes: b.size_bytes || 0,
                trigger: 'cron',
              },
            });
          } catch (e) {
            console.error('[daily-cron] success notification dispatch', e?.message);
          }
        }
      } catch (e) {
        failed += 1;
        errors.push({ user_id: p.user_id, error: String(e?.message || e) });
      }
    }

    return res.status(200).json({
      success: true,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      processed_users: processed,
      created_backups: created,
      skipped_backups: skipped,
      failed_backups: failed,
      errors: errors.slice(0, 20),
    });
  } catch (e) {
    console.error('[daily-cron] fatal', e);
    return res.status(500).json({
      error: e?.message || 'internal_error',
      timestamp: new Date().toISOString(),
    });
  }
}

// Vercel cron config (vercel.json):
// {
//   "crons": [
//     { "path": "/api/backup/schedule/daily", "schedule": "0 17 * * *" }
//   ]
// }
// 02:00 KST (UTC+9) = 17:00 UTC the previous calendar day. Cron schedule above
// runs at 17:00 UTC daily, which corresponds to 02:00 KST the next day.
