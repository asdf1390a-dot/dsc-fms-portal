// PATCH /api/discord/messages/edit
// Edit a message on Discord and/or Telegram by looking up message_maps.
// Body: { map_id?, discord_msg_id?, discord_channel_id?, telegram_msg_id?, telegram_chat_id?, new_content }
import { authFromRequest, jsonError, jsonOk, logSync, DISCORD_API, TELEGRAM_API } from '@/lib/discord/api-helpers';

const DISCORD_BOT = process.env.DISCORD_BOT_TOKEN || '';
const TELEGRAM_BOT = process.env.TELEGRAM_BOT_TOKEN || '';

export async function PATCH(request: Request): Promise<Response> {
  const auth = await authFromRequest(request);
  if (auth instanceof Response) return auth;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }
  const { map_id, discord_msg_id, discord_channel_id, telegram_msg_id, telegram_chat_id, new_content } = body || {};
  if (!new_content) return jsonError('new_content required', 400);

  let q = auth.client.from('discord_message_maps').select('*').eq('owner_id', auth.userId).limit(1);
  if (map_id) q = q.eq('map_id', map_id);
  else if (discord_msg_id) q = q.eq('discord_msg_id', discord_msg_id);
  else if (telegram_msg_id) q = q.eq('telegram_msg_id', telegram_msg_id);
  else return jsonError('map_id, discord_msg_id, or telegram_msg_id required', 400);

  const { data: rows, error: lookupErr } = await q;
  if (lookupErr) return jsonError(lookupErr.message, 500);
  const row = rows?.[0];
  if (!row) return jsonError('Message map not found', 404);

  const results: Record<string, any> = {};

  const dChannel = discord_channel_id || row.discord_channel_id;
  const dMsg = row.discord_msg_id;
  if (dChannel && dMsg && DISCORD_BOT) {
    const started = Date.now();
    const r = await fetch(`${DISCORD_API}/channels/${dChannel}/messages/${dMsg}`, {
      method: 'PATCH',
      headers: { Authorization: `Bot ${DISCORD_BOT}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: new_content }),
    });
    const latency = Date.now() - started;
    const j = await r.json().catch(() => ({}));
    results.discord = { ok: r.ok, status: r.status, latency_ms: latency };
    await logSync({
      client: auth.client,
      ownerId: auth.userId,
      source: 'manual',
      target: 'discord',
      content: new_content,
      targetMsgId: dMsg,
      targetChannelId: dChannel,
      status: r.ok ? 'success' : 'error',
      errorMessage: r.ok ? null : (j?.message || `Discord ${r.status}`),
      latencyMs: latency,
    });
  }

  const tChat = telegram_chat_id || row.telegram_chat_id;
  const tMsg = row.telegram_msg_id;
  if (tChat && tMsg && TELEGRAM_BOT) {
    const started = Date.now();
    const r = await fetch(`${TELEGRAM_API}/bot${TELEGRAM_BOT}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: tChat, message_id: Number(tMsg), text: new_content }),
    });
    const latency = Date.now() - started;
    const j = await r.json().catch(() => ({}));
    const ok = r.ok && j?.ok !== false;
    results.telegram = { ok, status: r.status, latency_ms: latency };
    await logSync({
      client: auth.client,
      ownerId: auth.userId,
      source: 'manual',
      target: 'telegram',
      content: new_content,
      targetMsgId: tMsg,
      targetChannelId: tChat,
      status: ok ? 'success' : 'error',
      errorMessage: ok ? null : (j?.description || `Telegram ${r.status}`),
      latencyMs: latency,
    });
  }

  await auth.client
    .from('discord_message_maps')
    .update({ content: new_content, updated_at: new Date().toISOString() })
    .eq('map_id', row.map_id)
    .eq('owner_id', auth.userId);

  return jsonOk({ map_id: row.map_id, results });
}
