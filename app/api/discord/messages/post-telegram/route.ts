// POST /api/discord/messages/post-telegram
// Send a message to Telegram via bot token, record message_map + sync_log.
// Body: { chat_id, text, thread_id?, source_platform?: 'discord'|'ctb'|'manual', source_msg_id?, discord_msg_id?, discord_channel_id?, author_display_name?, parse_mode? }
import { authFromRequest, jsonError, jsonOk, logSync, TELEGRAM_API } from '@/lib/discord/api-helpers';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';

export async function POST(request: Request): Promise<Response> {
  const auth = await authFromRequest(request);
  if (auth instanceof Response) return auth;
  if (!BOT_TOKEN) return jsonError('TELEGRAM_BOT_TOKEN not configured', 500);

  let body: any;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }
  const {
    chat_id,
    text,
    thread_id = null,
    source_platform = 'manual',
    source_msg_id = null,
    discord_msg_id = null,
    discord_channel_id = null,
    author_display_name = null,
    parse_mode,
  } = body || {};

  if (!chat_id || !text) return jsonError('chat_id and text required', 400);

  const payload: Record<string, any> = { chat_id, text };
  if (thread_id) payload.message_thread_id = thread_id;
  if (parse_mode) payload.parse_mode = parse_mode;

  const started = Date.now();
  const res = await fetch(`${TELEGRAM_API}/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const latency = Date.now() - started;
  const tRes = await res.json().catch(() => ({}));

  if (!res.ok || tRes?.ok === false) {
    await logSync({
      client: auth.client,
      ownerId: auth.userId,
      source: source_platform,
      target: 'telegram',
      content: text,
      sourceMsgId: source_msg_id,
      sourceChannelId: discord_channel_id,
      targetChannelId: String(chat_id),
      status: 'error',
      errorMessage: tRes?.description || `Telegram ${res.status}`,
      latencyMs: latency,
    });
    return jsonError('Telegram post failed', 502, { detail: tRes });
  }

  const telegramMsgId = tRes?.result?.message_id ? String(tRes.result.message_id) : null;

  await Promise.all([
    auth.client.from('discord_message_maps').insert({
      owner_id: auth.userId,
      discord_msg_id,
      discord_channel_id,
      telegram_msg_id: telegramMsgId,
      telegram_chat_id: String(chat_id),
      author_platform: source_platform === 'discord' ? 'discord' : (source_platform === 'ctb' ? 'ctb' : 'telegram'),
      author_display_name,
      content: text,
    }),
    logSync({
      client: auth.client,
      ownerId: auth.userId,
      source: source_platform,
      target: 'telegram',
      content: text,
      sourceMsgId: source_msg_id,
      sourceChannelId: discord_channel_id,
      targetMsgId: telegramMsgId,
      targetChannelId: String(chat_id),
      status: 'success',
      latencyMs: latency,
    }),
  ]);

  return jsonOk({ telegram_msg_id: telegramMsgId, chat_id: String(chat_id), latency_ms: latency }, 201);
}
