// GET /api/discord-links/list
// List stored Discord links

import { supabase } from '@/lib/supabaseClient';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).end();

  try {
    const { limit = 50, offset = 0, type, channel } = req.query;

    let query = supabase.from('discord_link_storage').select('*').order('created_at', { ascending: false });

    if (type) query = query.eq('type', type);
    if (channel) query = query.eq('channel_id', channel);

    const { data, error, count } = await query.range(offset, offset + limit - 1);

    if (error) throw error;

    return res.status(200).json({
      data,
      count,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (err: any) {
    console.error('[discord-links/list]', err);
    return res.status(500).json({ error: err.message });
  }
}
