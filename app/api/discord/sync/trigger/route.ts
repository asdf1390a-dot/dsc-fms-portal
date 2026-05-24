// POST /api/discord/sync/trigger
// Enqueue a manual sync record. The Python bot worker picks up `pending` rows and dispatches them.
// Body: { source: 'telegram'|'discord'|'ctb'|'manual', target: 'telegram'|'discord', content, source_channel_id, target_channel_id, source_msg_id?, source_user_id? }
import { authFromRequest, jsonError, jsonOk, logSync } from '@/lib/discord/api-helpers';

export async function POST(request: Request): Promise<Response> {
  const auth = await authFromRequest(request);
  if (auth instanceof Response) return auth;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const {
    source = 'manual',
    target,
    content,
    source_channel_id,
    target_channel_id,
    source_msg_id,
    source_user_id,
  } = body || {};

  if (!target || !['telegram', 'discord'].includes(target)) {
    return jsonError("target must be 'telegram' or 'discord'", 400);
  }
  if (!content || typeof content !== 'string') {
    return jsonError('content (string) required', 400);
  }

  const { data, error } = await logSync({
    client: auth.client,
    ownerId: auth.userId,
    source,
    target,
    content,
    sourceChannelId: source_channel_id ?? null,
    targetChannelId: target_channel_id ?? null,
    sourceMsgId: source_msg_id ?? null,
    sourceUserId: source_user_id ?? null,
    status: 'pending',
  });

  if (error) return jsonError(error.message, 500);
  return jsonOk(data, 201);
}
