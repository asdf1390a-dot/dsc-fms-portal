// POST /api/discord/task
// body: { assigned_to, task_description, priority?, deadline?, platform_origin }
// Creates a row in discord_task_queue. Used by the bot or by direct callers
// (e.g. Telegram bridge) to enqueue work without round-tripping Discord.

import { supabaseAdmin } from '../../../lib/supabase-admin';

const VALID_ASSIGNEES = new Set([
  '웹개발자', '플레너', '평가자', '감시자', 'CEO',
  'webdev', 'planner', 'evaluator', 'auditor', 'ceo',
]);

export default async function handler(req, res) {
  if (req.method === 'GET') {
    // Convenience listing endpoint for the portal
    try {
      const { data, error } = await supabaseAdmin
        .from('discord_task_queue')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return res.status(200).json({ items: data || [] });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });

  const secret = process.env.DISCORD_API_SHARED_SECRET;
  if (secret && req.headers['x-bot-secret'] !== secret) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const {
    assigned_to,
    task_description,
    priority = 'P1',
    deadline = null,
    platform_origin = 'discord',
  } = req.body || {};

  if (!assigned_to || !task_description) {
    return res.status(400).json({ error: 'assigned_to and task_description required' });
  }
  if (!VALID_ASSIGNEES.has(assigned_to)) {
    return res.status(400).json({
      error: `invalid assignee`,
      valid: Array.from(VALID_ASSIGNEES),
    });
  }
  if (task_description.length < 5 || task_description.length > 500) {
    return res.status(400).json({ error: 'task_description must be 5..500 chars' });
  }
  if (!['P0', 'P1', 'P2'].includes(priority)) {
    return res.status(400).json({ error: 'priority must be P0|P1|P2' });
  }
  if (!['discord', 'telegram'].includes(platform_origin)) {
    return res.status(400).json({ error: 'platform_origin must be discord|telegram' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('discord_task_queue')
      .insert({
        assigned_to,
        task_description,
        priority,
        deadline,
        platform_origin,
        status: 'pending',
      })
      .select()
      .single();
    if (error) throw error;

    await supabaseAdmin.from('discord_notifications').insert({
      notify_type: 'task_assigned',
      content: `@${assigned_to} ${task_description}`,
      platform: 'both',
    });

    return res.status(200).json({ ok: true, task: data });
  } catch (err) {
    console.error('[discord/task]', err);
    return res.status(500).json({ error: err.message });
  }
}
