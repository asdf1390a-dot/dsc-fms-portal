// GET /api/discord/status
// Returns last 24h sync metrics from discord_sync_log + queue counts.

import { supabaseAdmin } from '../../../lib/supabase-admin';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method' });

  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [{ data: logs, error: logErr }, { data: tasks, error: taskErr }, { data: recent, error: recentErr }] =
      await Promise.all([
        supabaseAdmin
          .from('discord_sync_log')
          .select('sync_status, source_platform, target_platform, created_at')
          .gte('created_at', since)
          .limit(5000),
        supabaseAdmin
          .from('discord_task_queue')
          .select('status'),
        supabaseAdmin
          .from('discord_sync_log')
          .select('id, source_platform, target_platform, sync_status, error_msg, created_at')
          .order('created_at', { ascending: false })
          .limit(20),
      ]);

    if (logErr) throw logErr;
    if (taskErr) throw taskErr;
    if (recentErr) throw recentErr;

    const counts = { success: 0, fallback: 0, error: 0, duplicate: 0, pending: 0 };
    for (const row of logs || []) {
      counts[row.sync_status] = (counts[row.sync_status] || 0) + 1;
    }
    const totalAttempts = (counts.success || 0) + (counts.fallback || 0) + (counts.error || 0);
    const successRate = totalAttempts === 0
      ? null
      : ((counts.success || 0) / totalAttempts);

    const taskCounts = { pending: 0, in_progress: 0, completed: 0, cancelled: 0 };
    for (const t of tasks || []) {
      taskCounts[t.status] = (taskCounts[t.status] || 0) + 1;
    }

    return res.status(200).json({
      window: '24h',
      sync: { counts, total_attempts: totalAttempts, success_rate: successRate },
      tasks: taskCounts,
      recent_events: recent || [],
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[discord/status]', err);
    return res.status(500).json({ error: err.message });
  }
}
