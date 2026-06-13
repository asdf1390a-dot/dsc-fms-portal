// POST /api/discord/webhook
// Receives forwarded Discord message events from the standalone bot
// (or Discord Interactions endpoint) and persists into discord_messages +
// discord_sync_log.
//
// Auth: x-bot-secret header must match DISCORD_API_SHARED_SECRET.

import crypto from 'crypto';
import { supabaseAdmin } from '../../../lib/supabase-admin';

function sha256(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });

  const secret = process.env.DISCORD_API_SHARED_SECRET;
  if (secret && req.headers['x-bot-secret'] !== secret) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const {
    discord_msg_id,
    user_id,
    user_name,
    channel_id,
    channel_name,
    content,
    is_command = false,
  } = req.body || {};

  if (!discord_msg_id || !user_id || !channel_id) {
    return res.status(400).json({ error: 'discord_msg_id, user_id, channel_id required' });
  }

  const content_hash = sha256(`${discord_msg_id}:${content || ''}`);

  try {
    // Dedup check
    const dup = await supabaseAdmin
      .from('discord_sync_log')
      .select('id')
      .eq('content_hash', content_hash)
      .in('sync_status', ['success', 'fallback'])
      .limit(1);

    if (dup.data && dup.data.length > 0) {
      await supabaseAdmin.from('discord_sync_log').insert({
        source_platform: 'discord',
        source_msg_id: discord_msg_id,
        target_platform: 'telegram',
        content_hash,
        sync_status: 'duplicate',
      });
      return res.status(200).json({ duplicate: true });
    }

    await supabaseAdmin.from('discord_messages').upsert(
      {
        discord_msg_id,
        user_id,
        user_name,
        channel_id,
        channel_name,
        content,
        is_command,
      },
      { onConflict: 'discord_msg_id' }
    );

    await supabaseAdmin.from('discord_sync_log').insert({
      source_platform: 'discord',
      source_msg_id: discord_msg_id,
      target_platform: 'telegram',
      content_hash,
      sync_status: 'pending',
    });

    return res.status(200).json({ ok: true, content_hash });
  } catch (err) {
    console.error('[discord/webhook]', err);
    return res.status(500).json({ error: err.message });
  }
}
