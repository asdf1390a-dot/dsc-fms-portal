// GET /api/discord/monitoring/logs?limit=&offset=&status=&source=&target=&since=
// Paginated discord_sync_logs for the owner.
import { authFromRequest, jsonError, jsonOk } from '@/lib/discord/api-helpers';

export async function GET(request: Request): Promise<Response> {
  const auth = await authFromRequest(request);
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), 200);
  const offset = Math.max(Number(url.searchParams.get('offset') ?? 0), 0);
  const status = url.searchParams.get('status');
  const source = url.searchParams.get('source');
  const target = url.searchParams.get('target');
  const since = url.searchParams.get('since');

  let q = auth.client
    .from('discord_sync_logs')
    .select('*', { count: 'exact' })
    .eq('owner_id', auth.userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) q = q.eq('sync_status', status);
  if (source) q = q.eq('source_platform', source);
  if (target) q = q.eq('target_platform', target);
  if (since) q = q.gte('created_at', since);

  const { data, error, count } = await q;
  if (error) return jsonError(error.message, 500);

  return jsonOk({
    rows: data ?? [],
    pagination: { limit, offset, total: count ?? 0 },
  });
}
