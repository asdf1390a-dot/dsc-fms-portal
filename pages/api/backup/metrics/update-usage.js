// POST /api/backup/metrics/update-usage — daily cron to refresh
// backup_storage_quotas.current_usage_bytes for every user.
//
// Source of truth: sum(backups.size_bytes) where status='completed'.
//
// Auth: Authorization: Bearer <CRON_SECRET>
//
// Vercel cron (vercel.json):
//   { "path": "/api/backup/metrics/update-usage", "schedule": "5 17 * * *" }
// 17:05 UTC = 02:05 KST next day.

import { supabaseAdmin } from '../../../../lib/supabase-admin';
import {
  sendBackupNotification,
  buildQuotaWarningMessage,
  buildQuotaExceededMessage,
} from '../../../../lib/backup-notifications';

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
    // 1. Collect distinct user_ids from either quotas or backups.
    const userIds = new Set();

    const { data: quotaUsers, error: qErr } = await supabaseAdmin
      .from('backup_storage_quotas')
      .select('user_id');
    if (qErr) return res.status(500).json({ error: qErr.message });
    for (const r of quotaUsers || []) if (r.user_id) userIds.add(r.user_id);

    const { data: backupUsers, error: bErr } = await supabaseAdmin
      .from('backups')
      .select('user_id')
      .eq('status', 'completed');
    if (bErr) return res.status(500).json({ error: bErr.message });
    for (const r of backupUsers || []) if (r.user_id) userIds.add(r.user_id);

    let updated = 0;
    const errors = [];
    const nowIso = new Date().toISOString();

    for (const uid of userIds) {
      try {
        const { data: rows, error: sumErr } = await supabaseAdmin
          .from('backups')
          .select('size_bytes')
          .eq('user_id', uid)
          .eq('status', 'completed');
        if (sumErr) {
          errors.push({ user_id: uid, error: sumErr.message });
          continue;
        }
        const usage = (rows || []).reduce(
          (acc, r) => acc + (Number(r.size_bytes) || 0),
          0,
        );

        const { error: upErr } = await supabaseAdmin
          .from('backup_storage_quotas')
          .upsert(
            {
              user_id: uid,
              current_usage_bytes: usage,
              last_calculated_at: nowIso,
            },
            { onConflict: 'user_id' },
          );
        if (upErr) {
          errors.push({ user_id: uid, error: upErr.message });
          continue;
        }
        updated += 1;

        // Threshold-based quota notifications.
        // Look up max_storage_bytes from quota row to compute usage_percent.
        // NULL max = unlimited plan, no notification.
        try {
          const { data: qrow } = await supabaseAdmin
            .from('backup_storage_quotas')
            .select('max_storage_bytes')
            .eq('user_id', uid)
            .maybeSingle();
          const max = qrow?.max_storage_bytes;
          if (max && Number(max) > 0) {
            const pct = (usage / Number(max)) * 100;
            if (pct >= 100) {
              await sendBackupNotification({
                userId: uid,
                type: 'quota_exceeded',
                message: buildQuotaExceededMessage(),
                metadata: { used: usage, max, usage_percent: pct },
              });
            } else if (pct >= 80) {
              await sendBackupNotification({
                userId: uid,
                type: 'quota_warning',
                message: buildQuotaWarningMessage({ used: usage, max }),
                metadata: { used: usage, max, usage_percent: pct },
              });
            }
          }
        } catch (e) {
          console.error('[update-usage] quota notification dispatch', uid, e?.message);
        }
      } catch (e) {
        errors.push({ user_id: uid, error: String(e?.message || e) });
      }
    }

    return res.status(200).json({
      success: true,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      scanned_users: userIds.size,
      updated_users: updated,
      errors: errors.slice(0, 20),
    });
  } catch (e) {
    console.error('[metrics/update-usage] fatal', e);
    return res.status(500).json({ error: e?.message || 'internal_error' });
  }
}
