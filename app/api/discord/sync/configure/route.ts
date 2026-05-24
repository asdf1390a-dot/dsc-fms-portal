// POST /api/discord/sync/configure
// Update top-level routing (semantic channels + Telegram chat) on the owner's discord_configs row.
// Body: { guild_id, channel_general?, channel_in_progress?, channel_completed?, channel_blocker?, channel_team_discuss?, telegram_chat_id?, telegram_thread_id?, enabled? }
import { authFromRequest, jsonError, jsonOk } from '@/lib/discord/api-helpers';

const FIELDS = [
  'channel_general',
  'channel_in_progress',
  'channel_completed',
  'channel_blocker',
  'channel_team_discuss',
  'telegram_chat_id',
  'telegram_thread_id',
  'enabled',
] as const;

export async function POST(request: Request): Promise<Response> {
  const auth = await authFromRequest(request);
  if (auth instanceof Response) return auth;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }
  const { guild_id } = body || {};
  if (!guild_id) return jsonError('guild_id required', 400);

  const patch: Record<string, any> = { updated_at: new Date().toISOString() };
  for (const f of FIELDS) {
    if (f in body) patch[f] = body[f];
  }

  const { data, error } = await auth.client
    .from('discord_configs')
    .update(patch)
    .eq('owner_id', auth.userId)
    .eq('guild_id', guild_id)
    .select('config_id, guild_id, channel_general, channel_in_progress, channel_completed, channel_blocker, channel_team_discuss, telegram_chat_id, telegram_thread_id, enabled')
    .single();

  if (error) return jsonError(error.message, 500);
  return jsonOk(data);
}
