// POST /api/user/telegram/disconnect — Disconnect Telegram account
// Auth: Bearer token
// Response: { success, message }

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
    // Clear Telegram settings
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({
        telegram_chat_id: null,
        telegram_username: null,
        telegram_connected_at: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (error) throw error;

    return res.status(200).json({
      success: true,
      message: 'Telegram account disconnected'
    });

  } catch (error) {
    console.error('Telegram disconnect error:', error);
    return res.status(500).json({ error: error.message });
  }
}
