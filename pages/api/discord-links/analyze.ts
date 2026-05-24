// POST /api/discord-links/analyze
// Analyze a single link and store it

import { fetchLinkMetadata, storeLinkMetadata } from '@/lib/discord/link-processor';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { url, channel_id, message_id, author_id } = req.body;

    if (!url) return res.status(400).json({ error: 'URL required' });

    // Fetch and analyze
    const metadata = await fetchLinkMetadata(url);
    if (!metadata) {
      return res.status(400).json({ error: 'Could not fetch link' });
    }

    // Store
    const record = await storeLinkMetadata({
      url,
      ...metadata,
      channel_id: channel_id || 'manual',
      message_id: message_id || null,
      author_id: author_id || null,
    });

    return res.status(200).json({ ok: true, data: record });
  } catch (err: any) {
    console.error('[discord-links/analyze]', err);
    return res.status(500).json({ error: err.message });
  }
}
