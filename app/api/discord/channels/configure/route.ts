// POST /api/discord/channels/configure
// Upsert one channel_settings row.
// Body: { guild_id, channel_id, channel_name?, channel_role?, language?, ignore_patterns?, mirror_direction?, rate_limit_per_min?, enabled? }
import { authFromRequest, jsonError, jsonOk } from '@/lib/discord/api-helpers';

const ROLES = ['general', 'in_progress', 'completed', 'blocker', 'team_discuss', 'custom'];
const DIRECTIONS = ['both', 'to_telegram', 'to_discord', 'none'];

export async function POST(request: Request): Promise<Response> {
  const auth = await authFromRequest(request);
  if (auth instanceof Response) return auth;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const { guild_id, channel_id, channel_name, channel_role = 'general', language = 'ko', ignore_patterns, mirror_direction = 'both', rate_limit_per_min = 30, enabled = true } = body || {};
  if (!guild_id || !channel_id) return jsonError('guild_id and channel_id required', 400);
  if (!ROLES.includes(channel_role)) return jsonError(`channel_role must be one of ${ROLES.join(',')}`, 400);
  if (!DIRECTIONS.includes(mirror_direction)) return jsonError(`mirror_direction must be one of ${DIRECTIONS.join(',')}`, 400);

  const { data: cfg, error: cfgErr } = await auth.client
    .from('discord_configs')
    .select('config_id')
    .eq('owner_id', auth.userId)
    .eq('guild_id', guild_id)
    .maybeSingle();
  if (cfgErr) return jsonError(cfgErr.message, 500);
  if (!cfg) return jsonError('Config not found for guild', 404);

  const row = {
    config_id: cfg.config_id,
    channel_id,
    channel_name: channel_name ?? null,
    channel_role,
    language,
    ignore_patterns: Array.isArray(ignore_patterns) ? ignore_patterns : undefined,
    mirror_direction,
    rate_limit_per_min,
    enabled,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await auth.client
    .from('discord_channel_settings')
    .upsert(row, { onConflict: 'config_id,channel_id' })
    .select('*')
    .single();

  if (error) return jsonError(error.message, 500);
  return jsonOk(data, 201);
}
