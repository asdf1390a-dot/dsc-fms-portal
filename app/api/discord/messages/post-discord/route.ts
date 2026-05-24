// POST /api/discord/messages/post-discord
// Send a message to a Discord channel via bot token, record message_map + sync_log.
// Body: { channel_id, content, source_platform?: 'telegram'|'ctb'|'manual', source_msg_id?, telegram_msg_id?, telegram_chat_id?, author_display_name? }
import { authFromRequest, jsonError, jsonOk, logSync, DISCORD_API } from '@/lib/discord/api-helpers';

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN || '';

export async function POST(request: Request): Promise<Response> {
  const auth = await authFromRequest(request);
  if (auth instanceof Response) return auth;
  if (!BOT_TOKEN) return jsonError('DISCORD_BOT_TOKEN not configured', 500);

  let body: any;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }
  const {
    channel_id,
    content,
    source_platform = 'manual',
    source_msg_id = null,
    telegram_msg_id = null,
    telegram_chat_id = null,
    author_display_name = null,
  } = body || {};

  if (!channel_id || !content) return jsonError('channel_id and content required', 400);

  const started = Date.now();
  const res = await fetch(`${DISCORD_API}/channels/${channel_id}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${BOT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content }),
  });

  const latency = Date.now() - started;
  const dRes = await res.json().catch(() => ({}));

  if (!res.ok) {
    await logSync({
      client: auth.client,
      ownerId: auth.userId,
      source: source_platform,
      target: 'discord',
      content,
      sourceMsgId: source_msg_id,
      sourceChannelId: telegram_chat_id,
      targetChannelId: channel_id,
      status: 'error',
      errorMessage: dRes?.message || `Discord ${res.status}`,
      latencyMs: latency,
    });
    return jsonError('Discord post failed', 502, { detail: dRes });
  }

  const discordMsgId = dRes?.id ?? null;

  await Promise.all([
    auth.client.from('discord_message_maps').insert({
      owner_id: auth.userId,
      discord_msg_id: discordMsgId,
      discord_channel_id: channel_id,
      telegram_msg_id,
      telegram_chat_id,
      author_platform: source_platform === 'telegram' ? 'telegram' : (source_platform === 'ctb' ? 'ctb' : 'discord'),
      author_display_name,
      content,
    }),
    logSync({
      client: auth.client,
      ownerId: auth.userId,
      source: source_platform,
      target: 'discord',
      content,
      sourceMsgId: source_msg_id,
      sourceChannelId: telegram_chat_id,
      targetMsgId: discordMsgId,
      targetChannelId: channel_id,
      status: 'success',
      latencyMs: latency,
    }),
  ]);

  return jsonOk({ discord_msg_id: discordMsgId, channel_id, latency_ms: latency }, 201);
}
