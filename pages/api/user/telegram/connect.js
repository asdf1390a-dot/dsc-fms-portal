// POST /api/user/telegram/connect — Connect or update Telegram account for backup notifications
// Auth: Bearer token
// Request: { telegram_chat_id, telegram_username? }
// Response: { success, telegram: { chat_id, username, connected_at, is_active } }

import { supabaseAdmin } from '../../../../lib/supabase-admin';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { authorization } = req.headers;
  if (!authorization) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authorization.replace('Bearer ', '');
  const { data: user, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  try {
    const { telegram_chat_id, telegram_username } = req.body;

    if (!telegram_chat_id || telegram_chat_id.toString().trim() === '') {
      return res.status(400).json({ error: 'telegram_chat_id is required' });
    }

    // Upsert Telegram connection
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .upsert(
        {
          id: user.id,
          telegram_chat_id: telegram_chat_id.toString(),
          telegram_username: telegram_username || null,
          telegram_connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        { onConflict: 'id' }
      )
      .select()
      .single();

    if (error) throw error;

    return res.status(200).json({
      success: true,
      telegram: {
        chat_id: profile.telegram_chat_id,
        username: profile.telegram_username,
        connected_at: profile.telegram_connected_at,
        is_active: !!profile.telegram_chat_id
      }
    });

  } catch (error) {
    console.error('Telegram connect error:', error);
    return res.status(500).json({ error: error.message });
  }
}
