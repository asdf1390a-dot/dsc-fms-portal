// DELETE /api/discord/messages/delete
// Delete a mapped message on Discord and/or Telegram, mark map row deleted.
// Body: { map_id?, discord_msg_id?, telegram_msg_id? }
import { authFromRequest, jsonError, jsonOk, logSync, DISCORD_API, TELEGRAM_API } from '@/lib/discord/api-helpers';

const DISCORD_BOT = process.env.DISCORD_BOT_TOKEN || '';
const TELEGRAM_BOT = process.env.TELEGRAM_BOT_TOKEN || '';

export async function DELETE(request: Request): Promise<Response> {
  const auth = await authFromRequest(request);
  if (auth instanceof Response) return auth;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }
  const { map_id, discord_msg_id, telegram_msg_id } = body || {};

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

  if (row.discord_msg_id && row.discord_channel_id && DISCORD_BOT) {
    const started = Date.now();
    const r = await fetch(`${DISCORD_API}/channels/${row.discord_channel_id}/messages/${row.discord_msg_id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bot ${DISCORD_BOT}` },
    });
    const latency = Date.now() - started;
    const ok = r.ok || r.status === 404;
    results.discord = { ok, status: r.status, latency_ms: latency };
    await logSync({
      client: auth.client,
      ownerId: auth.userId,
      source: 'manual',
      target: 'discord',
      content: row.content || '',
      targetMsgId: row.discord_msg_id,
      targetChannelId: row.discord_channel_id,
      status: ok ? 'success' : 'error',
      errorMessage: ok ? null : `Discord ${r.status}`,
      latencyMs: latency,
    });
  }

  if (row.telegram_msg_id && row.telegram_chat_id && TELEGRAM_BOT) {
    const started = Date.now();
    const r = await fetch(`${TELEGRAM_API}/bot${TELEGRAM_BOT}/deleteMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: row.telegram_chat_id, message_id: Number(row.telegram_msg_id) }),
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
      content: row.content || '',
      targetMsgId: row.telegram_msg_id,
      targetChannelId: row.telegram_chat_id,
      status: ok ? 'success' : 'error',
      errorMessage: ok ? null : (j?.description || `Telegram ${r.status}`),
      latencyMs: latency,
    });
  }

  await auth.client
    .from('discord_message_maps')
    .update({ is_deleted: true, deleted_at: new Date().toISOString() })
    .eq('map_id', row.map_id)
    .eq('owner_id', auth.userId);

  return jsonOk({ map_id: row.map_id, results });
}
