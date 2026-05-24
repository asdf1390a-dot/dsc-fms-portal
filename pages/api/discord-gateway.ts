// Discord Bot Gateway Handler
// POST /api/discord-gateway
// Receives Discord interactions and message events
// Validates signature using Ed25519

import { verifyKey } from 'discord-interactions';
import { supabase } from '@/lib/supabaseClient';

const DISCORD_BOT_PUBLIC_KEY = process.env.DISCORD_BOT_PUBLIC_KEY || '';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).end();

  // Verify Discord signature
  const signature = req.headers['x-signature-ed25519'];
  const timestamp = req.headers['x-signature-timestamp'];
  const body = JSON.stringify(req.body);

  if (!signature || !timestamp) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const isValidRequest = verifyKey(body, signature, timestamp, DISCORD_BOT_PUBLIC_KEY);
  if (!isValidRequest) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const { type, data, member, channel_id, message } = req.body;

  // Type 1: PING
  if (type === 1) {
    return res.status(200).json({ type: 1 });
  }

  // Type 2: APPLICATION_COMMAND
  // Type 3: MESSAGE_COMPONENT
  // Type 4: MODAL_SUBMIT
  // Type 5: APPLICATION_COMMAND_AUTOCOMPLETE

  // Message event handling (for incoming messages)
  if (type === 0) {
    // This is not a Discord interaction, but a raw message event
    // We'll handle it differently
    return handleMessageEvent(req.body, res);
  }

  return res.status(200).json({ type: 1 });
}

async function handleMessageEvent(payload: any, res: any) {
  try {
    const { message, channel_id } = payload;
    if (!message || !message.content) return res.status(200).json({ ok: true });

    // Extract URLs from message content
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = message.content.match(urlRegex) || [];

    if (urls.length === 0) {
      return res.status(200).json({ ok: true });
    }

    // Process each URL
    for (const url of urls) {
      try {
        await processLink(url, channel_id, message.id);
      } catch (err) {
        console.error(`[discord-gateway] Error processing link ${url}:`, err);
      }
    }

    return res.status(200).json({ ok: true, processed: urls.length });
  } catch (err) {
    console.error('[discord-gateway] Error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
}

async function processLink(url: string, channelId: string, messageId: string) {
  // Analyze link and store metadata
  const metadata = await analyzeLink(url);
  if (!metadata) return;

  // Store in database
  const { data, error } = await supabase.from('discord_link_storage').insert([
    {
      url,
      channel_id: channelId,
      message_id: messageId,
      title: metadata.title,
      description: metadata.description,
      metadata: metadata,
      created_at: new Date().toISOString(),
    },
  ]);

  if (error) {
    console.error('[discord-gateway] Storage error:', error);
    throw error;
  }

  return data;
}

async function analyzeLink(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) return null;

    const html = await response.text();
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i);

    return {
      title: titleMatch ? titleMatch[1] : null,
      description: descMatch ? descMatch[1] : null,
      type: detectLinkType(url),
      fetched_at: new Date().toISOString(),
    };
  } catch (err) {
    console.error('[analyzeLink] Error fetching:', err);
    return null;
  }
}

function detectLinkType(url: string) {
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  if (url.includes('github.com')) return 'github';
  if (url.includes('twitter.com') || url.includes('x.com')) return 'twitter';
  return 'generic';
}
