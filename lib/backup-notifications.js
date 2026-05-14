// lib/backup-notifications.js
// Centralized notification sender for the JEEPNEY Backup module (Phase 2).
//
// Channels:
//   - in_app   : insert row into public.backup_notifications (always)
//   - email    : SendGrid REST API if SENDGRID_API_KEY is set; else logged + skipped
//   - telegram : Bot API sendMessage to TELEGRAM_BACKUP_CHANNEL_ID
//                using TELEGRAM_BOT_TOKEN
//
// Per-channel failure does NOT abort the others. Errors are logged + collected
// and returned to the caller.
//
// Env vars consulted (all optional except where noted):
//   SENDGRID_API_KEY              — enables email channel
//   SENDGRID_FROM_EMAIL           — default sender, falls back to noreply@dsc-fms.local
//   TELEGRAM_BOT_TOKEN            — enables telegram channel
//   TELEGRAM_BACKUP_CHANNEL_ID    — destination chat ID
//
// Usage:
//   import { sendBackupNotification } from '../../../../lib/backup-notifications';
//   await sendBackupNotification({
//     userId, type: 'success', message: '...',
//     backupId, metadata: { backup_name, size_bytes }
//   });

import { supabaseAdmin } from './supabase-admin';

const VALID_TYPES = new Set([
  'success',
  'failure',
  'quota_warning',
  'quota_exceeded',
  'deletion_scheduled',
]);

// ---------- helpers ----------------------------------------------------------

function fmtBytes(n) {
  const x = Number(n);
  if (!Number.isFinite(x) || x <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let v = x;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function buildSubject(type, meta = {}) {
  switch (type) {
    case 'success':
      return `[JEEPNEY Backup] Backup completed: ${meta.backup_name || 'backup'}`;
    case 'failure':
      return `[JEEPNEY Backup] Backup FAILED: ${meta.backup_name || 'backup'}`;
    case 'quota_warning':
      return '[JEEPNEY Backup] Storage 80% full';
    case 'quota_exceeded':
      return '[JEEPNEY Backup] Storage quota exceeded';
    case 'deletion_scheduled':
      return '[JEEPNEY Backup] Backup scheduled for deletion';
    default:
      return '[JEEPNEY Backup] Notification';
  }
}

function buildEmailHtml(type, message, meta = {}) {
  const rows = [];
  if (meta.backup_name) rows.push(['Backup', meta.backup_name]);
  if (meta.size_bytes != null) rows.push(['Size', fmtBytes(meta.size_bytes)]);
  if (meta.used != null && meta.max != null) {
    rows.push(['Usage', `${fmtBytes(meta.used)} / ${fmtBytes(meta.max)}`]);
  }
  if (meta.retention_days != null) {
    rows.push(['Retention', `${meta.retention_days} days`]);
  }
  if (meta.error) rows.push(['Error', String(meta.error)]);

  const table = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#666;">${k}</td><td style="padding:4px 0;">${v}</td></tr>`,
    )
    .join('');

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;color:#222;max-width:560px;">
      <h2 style="margin:0 0 12px 0;font-size:16px;">${buildSubject(type, meta)}</h2>
      <p style="margin:0 0 16px 0;line-height:1.5;">${message}</p>
      ${table ? `<table style="border-collapse:collapse;margin-bottom:16px;">${table}</table>` : ''}
      <p style="color:#888;font-size:12px;margin-top:24px;">
        JEEPNEY Backup &middot; ${new Date().toISOString()}
      </p>
    </div>
  `;
}

function buildTelegramText(type, message, userEmail, meta = {}) {
  const status = type.toUpperCase();
  const name = meta.backup_name ? ` - ${meta.backup_name}` : '';
  const who = userEmail ? ` (${userEmail})` : '';
  let extra = '';
  if (meta.size_bytes != null) extra += `\nSize: ${fmtBytes(meta.size_bytes)}`;
  if (meta.used != null && meta.max != null) {
    extra += `\nUsage: ${fmtBytes(meta.used)} / ${fmtBytes(meta.max)}`;
  }
  if (meta.error) extra += `\nError: ${String(meta.error).slice(0, 200)}`;
  return `[JEEPNEY Backup] ${status}${name}${who}\n${message}${extra}`;
}

// ---------- channel: in_app --------------------------------------------------

async function deliverInApp({ userId, type, message, backupId }) {
  const row = {
    user_id: userId,
    backup_id: backupId || null,
    notification_type: type,
    notification_channel: 'in_app',
    message: String(message).slice(0, 2000),
  };
  const { data, error } = await supabaseAdmin
    .from('backup_notifications')
    .insert(row)
    .select('id, sent_at')
    .single();
  if (error) throw new Error(`in_app insert failed: ${error.message}`);
  return data;
}

// ---------- channel: email ---------------------------------------------------

async function resolveUserEmail(userId) {
  // Supabase admin: getUserById returns auth.users row.
  try {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (error || !data?.user?.email) return null;
    return data.user.email;
  } catch {
    return null;
  }
}

async function deliverEmail({ userId, type, message, metadata }) {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    return { skipped: true, reason: 'no_sendgrid_key' };
  }
  const to = await resolveUserEmail(userId);
  if (!to) {
    return { skipped: true, reason: 'no_user_email' };
  }
  const from = process.env.SENDGRID_FROM_EMAIL || 'noreply@dsc-fms.local';
  const subject = buildSubject(type, metadata);
  const html = buildEmailHtml(type, message, metadata);

  const payload = {
    personalizations: [{ to: [{ email: to }] }],
    from: { email: from, name: 'JEEPNEY Backup' },
    subject,
    content: [
      { type: 'text/plain', value: message },
      { type: 'text/html', value: html },
    ],
  };

  const resp = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!resp.ok && resp.status !== 202) {
    const body = await resp.text().catch(() => '');
    throw new Error(`sendgrid ${resp.status}: ${body.slice(0, 200)}`);
  }
  return { delivered: true, to };
}

// ---------- channel: telegram ------------------------------------------------

async function deliverTelegram({ userId, type, message, metadata }) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_BACKUP_CHANNEL_ID;
  if (!token || !chatId) {
    return { skipped: true, reason: 'no_telegram_config' };
  }
  const userEmail = await resolveUserEmail(userId).catch(() => null);
  const text = buildTelegramText(type, message, userEmail, metadata);

  const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`telegram ${resp.status}: ${body.slice(0, 200)}`);
  }
  return { delivered: true };
}

// ---------- channel resolution ----------------------------------------------

// backup_policies.notification_channel is currently a single text column with
// CHECK ('email','telegram','in_app'). We treat it as the user's PRIMARY channel.
// in_app is ALWAYS delivered regardless.
async function resolveChannelsForUser(userId, explicit) {
  if (Array.isArray(explicit) && explicit.length) {
    return Array.from(new Set(explicit.concat(['in_app'])));
  }
  let primary = 'in_app';
  try {
    const { data } = await supabaseAdmin
      .from('backup_policies')
      .select('notification_channel')
      .eq('user_id', userId)
      .maybeSingle();
    if (data?.notification_channel) primary = data.notification_channel;
  } catch {
    /* ignore — default to in_app only */
  }
  return Array.from(new Set([primary, 'in_app']));
}

// ---------- public entrypoint ------------------------------------------------

/**
 * Send a backup notification. Per-channel failures are non-fatal.
 *
 * @param {Object} opts
 * @param {string} opts.userId    Target user UUID. Required.
 * @param {string} opts.type      One of VALID_TYPES.
 * @param {string} opts.message   Human-readable message text.
 * @param {string} [opts.backupId]
 * @param {string[]} [opts.channels] Override channel selection. Otherwise reads
 *                                   backup_policies.notification_channel.
 * @param {Object} [opts.metadata]
 * @returns {Promise<{ok:boolean, results:Object, errors:Array}>}
 */
export async function sendBackupNotification(opts) {
  const {
    userId,
    type,
    message,
    backupId = null,
    channels: explicitChannels = null,
    metadata = {},
  } = opts || {};

  if (!userId || typeof userId !== 'string') {
    return { ok: false, results: {}, errors: [{ stage: 'validate', error: 'userId required' }] };
  }
  if (!VALID_TYPES.has(type)) {
    return {
      ok: false,
      results: {},
      errors: [{ stage: 'validate', error: `invalid type: ${type}` }],
    };
  }
  if (!message || typeof message !== 'string') {
    return {
      ok: false,
      results: {},
      errors: [{ stage: 'validate', error: 'message required' }],
    };
  }

  const channels = await resolveChannelsForUser(userId, explicitChannels);
  const results = {};
  const errors = [];

  // in_app first so we always have a persistent record.
  if (channels.includes('in_app')) {
    try {
      results.in_app = await deliverInApp({ userId, type, message, backupId });
    } catch (e) {
      errors.push({ channel: 'in_app', error: String(e?.message || e) });
      console.error('[backup-notif] in_app failed', userId, e?.message);
    }
  }

  if (channels.includes('email')) {
    try {
      results.email = await deliverEmail({ userId, type, message, metadata });
    } catch (e) {
      errors.push({ channel: 'email', error: String(e?.message || e) });
      console.error('[backup-notif] email failed', userId, e?.message);
    }
  }

  if (channels.includes('telegram')) {
    try {
      results.telegram = await deliverTelegram({ userId, type, message, metadata });
    } catch (e) {
      errors.push({ channel: 'telegram', error: String(e?.message || e) });
      console.error('[backup-notif] telegram failed', userId, e?.message);
    }
  }

  return { ok: errors.length === 0, results, errors };
}

// Convenience builders so callers stay declarative.

export function buildSuccessMessage({ backup_name, size_bytes }) {
  return `Your backup completed: ${backup_name || 'backup'} (${fmtBytes(size_bytes)})`;
}
export function buildFailureMessage({ error_message }) {
  return `Your backup failed: ${error_message || 'unknown error'}`;
}
export function buildQuotaWarningMessage({ used, max }) {
  return `Storage 80% full. ${fmtBytes(used)} / ${fmtBytes(max)}`;
}
export function buildQuotaExceededMessage() {
  return 'Storage exceeded! Please delete backups or upgrade your plan.';
}
export function buildDeletionScheduledMessage({ backup_name, date, retention_days }) {
  return `Backup "${backup_name}" will be deleted on ${date} (retention policy: ${retention_days} days).`;
}
