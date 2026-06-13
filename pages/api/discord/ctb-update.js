// POST /api/discord/ctb-update
// Triggered by Vercel Cron (every 5 minutes) OR by the bot itself.
// body: { changes: [{ task_name, old_status, new_status, assignee, eta, time_delta }] }
//
// Posts a Discord embed via webhook for each change and logs to discord_sync_log.

import { supabaseAdmin } from '../../../lib/supabase-admin';

const COLOR = {
  IN_PROGRESS: 0xF59E0B,
  COMPLETED:   0x22C55E,
  BLOCKED:     0xEF4444,
  PENDING:     0x94A3B8,
};

const LABEL = {
  IN_PROGRESS: '【진행중】',
  COMPLETED:   '【완료】',
  BLOCKED:     '【블로커】',
  PENDING:     '【대기】',
};

function webhookForStatus(status) {
  switch (status) {
    case 'IN_PROGRESS': return process.env.DISCORD_WEBHOOK_INPROGRESS;
    case 'COMPLETED':   return process.env.DISCORD_WEBHOOK_COMPLETED;
    case 'BLOCKED':     return process.env.DISCORD_WEBHOOK_ISSUES;
    default:            return process.env.DISCORD_WEBHOOK_URL;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });

  const secret = process.env.DISCORD_API_SHARED_SECRET;
  const cronHeader = req.headers['x-vercel-cron'];
  if (secret && !cronHeader && req.headers['x-bot-secret'] !== secret) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const changes = Array.isArray(req.body?.changes) ? req.body.changes : [];
  if (changes.length === 0) {
    return res.status(200).json({ ok: true, posted: 0 });
  }

  let posted = 0;
  const errors = [];

  for (const c of changes) {
    const status = c.new_status;
    const webhook = webhookForStatus(status);
    if (!webhook) {
      errors.push({ task: c.task_name, error: 'no webhook configured' });
      continue;
    }

    const fields = [
      { name: '담당자', value: String(c.assignee || '-'), inline: true },
      { name: 'ETA',    value: String(c.eta || '-'),       inline: true },
    ];
    if (c.time_delta) fields.push({ name: 'Time Delta', value: String(c.time_delta), inline: true });
    fields.push({
      name: '상태 변화',
      value: `${c.old_status || '?'} → ${status}`,
      inline: false,
    });

    const payload = {
      embeds: [{
        title: `${LABEL[status] || ''} ${c.task_name}`,
        color: COLOR[status] || 0x94A3B8,
        fields,
        timestamp: new Date().toISOString(),
        footer: { text: 'DSC FMS · CTB sync' },
      }],
    };

    try {
      const r = await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error(`discord webhook ${r.status}`);
      posted += 1;

      await supabaseAdmin.from('discord_sync_log').insert({
        source_platform: 'ctb',
        target_platform: 'discord',
        sync_status: 'success',
        synced_at: new Date().toISOString(),
      });
      await supabaseAdmin.from('discord_notifications').insert({
        notify_type: 'ctb_update',
        content: `${LABEL[status] || ''} ${c.task_name}`,
        platform: 'discord',
      });
    } catch (err) {
      errors.push({ task: c.task_name, error: err.message });
      await supabaseAdmin.from('discord_sync_log').insert({
        source_platform: 'ctb',
        target_platform: 'discord',
        sync_status: 'error',
        error_msg: err.message,
      });
    }
  }

  return res.status(200).json({ ok: true, posted, errors });
}
