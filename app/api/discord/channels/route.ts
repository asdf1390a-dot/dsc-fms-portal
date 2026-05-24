// GET /api/discord/channels?guild_id=...
// List per-channel settings rows for the owner's guild config.
import { authFromRequest, jsonError, jsonOk } from '@/lib/discord/api-helpers';

export async function GET(request: Request): Promise<Response> {
  const auth = await authFromRequest(request);
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const guildId = url.searchParams.get('guild_id');
  if (!guildId) return jsonError('guild_id required', 400);

  const { data: cfg, error: cfgErr } = await auth.client
    .from('discord_configs')
    .select('config_id')
    .eq('owner_id', auth.userId)
    .eq('guild_id', guildId)
    .maybeSingle();
  if (cfgErr) return jsonError(cfgErr.message, 500);
  if (!cfg) return jsonError('Config not found for guild', 404);

  const { data, error } = await auth.client
    .from('discord_channel_settings')
    .select('*')
    .eq('config_id', cfg.config_id)
    .order('channel_role', { ascending: true });

  if (error) return jsonError(error.message, 500);
  return jsonOk(data ?? []);
}
