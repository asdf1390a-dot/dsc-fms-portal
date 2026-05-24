// GET /api/discord/monitoring/metrics?days=7
// Daily aggregates from discord_metrics_daily for the owner.
import { authFromRequest, jsonError, jsonOk } from '@/lib/discord/api-helpers';

export async function GET(request: Request): Promise<Response> {
  const auth = await authFromRequest(request);
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const days = Math.min(Math.max(Number(url.searchParams.get('days') ?? 7), 1), 90);
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

  const { data, error } = await auth.client
    .from('discord_metrics_daily')
    .select('*')
    .eq('owner_id', auth.userId)
    .gte('day', since)
    .order('day', { ascending: false });

  if (error) return jsonError(error.message, 500);

  const rows = data ?? [];
  const totals = rows.reduce(
    (acc: any, r: any) => {
      acc.total += Number(r.total ?? 0);
      acc.success += Number(r.success ?? 0);
      acc.error += Number(r.error ?? 0);
      acc.pending += Number(r.pending ?? 0);
      return acc;
    },
    { total: 0, success: 0, error: 0, pending: 0 }
  );
  const successRate = totals.total > 0 ? Math.round((totals.success / totals.total) * 1000) / 10 : null;

  return jsonOk({ days, totals, success_rate_pct: successRate, daily: rows });
}
