// GET /api/discord/sync/status
// Returns queue depth, recent errors, and last successful sync timestamp for the owner.
import { authFromRequest, jsonError, jsonOk } from '@/lib/discord/api-helpers';

export async function GET(request: Request): Promise<Response> {
  const auth = await authFromRequest(request);
  if (auth instanceof Response) return auth;

  const [pending, errored, lastSuccess, totals] = await Promise.all([
    auth.client
      .from('discord_sync_logs')
      .select('log_id', { count: 'exact', head: true })
      .eq('owner_id', auth.userId)
      .eq('sync_status', 'pending'),
    auth.client
      .from('discord_sync_logs')
      .select('log_id, error_message, created_at, source_platform, target_platform')
      .eq('owner_id', auth.userId)
      .eq('sync_status', 'error')
      .order('created_at', { ascending: false })
      .limit(10),
    auth.client
      .from('discord_sync_logs')
      .select('synced_at')
      .eq('owner_id', auth.userId)
      .eq('sync_status', 'success')
      .order('synced_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    auth.client
      .from('discord_sync_logs')
      .select('sync_status')
      .eq('owner_id', auth.userId)
      .gte('created_at', new Date(Date.now() - 24 * 3600_000).toISOString()),
  ]);

  if (pending.error) return jsonError(pending.error.message, 500);

  const counts24h = (totals.data || []).reduce<Record<string, number>>((acc, row: any) => {
    acc[row.sync_status] = (acc[row.sync_status] || 0) + 1;
    return acc;
  }, {});

  return jsonOk({
    pending_count: pending.count ?? 0,
    last_success_at: lastSuccess.data?.synced_at ?? null,
    recent_errors: errored.data ?? [],
    counts_last_24h: counts24h,
  });
}
