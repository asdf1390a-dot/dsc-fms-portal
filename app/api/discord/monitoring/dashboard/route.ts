// GET /api/discord/monitoring/dashboard
// Combined snapshot: configs, recent logs, last 7d metrics, current queue.
import { authFromRequest, jsonError, jsonOk } from '@/lib/discord/api-helpers';

export async function GET(request: Request): Promise<Response> {
  const auth = await authFromRequest(request);
  if (auth instanceof Response) return auth;

  const since7 = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);

  const [configs, recent, pending, metrics, lastSuccess] = await Promise.all([
    auth.client
      .from('discord_configs')
      .select('config_id, guild_id, guild_name, enabled, telegram_chat_id, telegram_thread_id, channel_general, channel_in_progress, channel_completed, channel_blocker, channel_team_discuss, updated_at')
      .eq('owner_id', auth.userId),
    auth.client
      .from('discord_sync_logs')
      .select('log_id, source_platform, target_platform, sync_status, error_message, latency_ms, created_at')
      .eq('owner_id', auth.userId)
      .order('created_at', { ascending: false })
      .limit(20),
    auth.client
      .from('discord_sync_logs')
      .select('log_id', { count: 'exact', head: true })
      .eq('owner_id', auth.userId)
      .eq('sync_status', 'pending'),
    auth.client
      .from('discord_metrics_daily')
      .select('*')
      .eq('owner_id', auth.userId)
      .gte('day', since7)
      .order('day', { ascending: false }),
    auth.client
      .from('discord_sync_logs')
      .select('synced_at')
      .eq('owner_id', auth.userId)
      .eq('sync_status', 'success')
      .order('synced_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (configs.error) return jsonError(configs.error.message, 500);

  const daily = metrics.data ?? [];
  const totals = daily.reduce(
    (acc: any, r: any) => {
      acc.total += Number(r.total ?? 0);
      acc.success += Number(r.success ?? 0);
      acc.error += Number(r.error ?? 0);
      acc.pending += Number(r.pending ?? 0);
      return acc;
    },
    { total: 0, success: 0, error: 0, pending: 0 }
  );

  return jsonOk({
    configs: configs.data ?? [],
    pending_count: pending.count ?? 0,
    last_success_at: lastSuccess.data?.synced_at ?? null,
    recent_logs: recent.data ?? [],
    metrics_7d: { totals, daily },
  });
}
