// POST /api/backup/schedule/configure — upsert user backup policy
// GET  /api/backup/schedule/configure — fetch current user policy
//
// Phase 2: backup_policies table (see db/23_backup_module_phase2.sql).
// Auth: Bearer JWT (user); service-role used server-side to bypass RLS.

import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { requireUser } from '../../../../lib/career-auth';

// Allow-list of fields we accept from the client (prevents user_id spoofing etc.)
const ALLOWED_FIELDS = [
  'backup_enabled',
  'backup_time',
  'backup_interval',
  'retention_days',
  'auto_delete_enabled',
  'max_storage_bytes',
  'warning_threshold_percent',
];

const INTERVALS = new Set(['daily', 'weekly', 'monthly']);

export function validatePolicyInput(body) {
  const errors = [];
  const out = {};

  for (const key of ALLOWED_FIELDS) {
    if (body[key] === undefined || body[key] === null) continue;
    out[key] = body[key];
  }

  if (out.backup_enabled !== undefined && typeof out.backup_enabled !== 'boolean') {
    errors.push('backup_enabled must be boolean');
  }
  if (out.auto_delete_enabled !== undefined && typeof out.auto_delete_enabled !== 'boolean') {
    errors.push('auto_delete_enabled must be boolean');
  }
  if (out.backup_time !== undefined) {
    if (typeof out.backup_time !== 'string' || !/^([0-1][0-9]|2[0-3]):([0-5][0-9])(:([0-5][0-9]))?$/.test(out.backup_time)) {
      errors.push('backup_time must match HH:MM or HH:MM:SS (00:00-23:59)');
    }
  }
  if (out.backup_interval !== undefined && !INTERVALS.has(out.backup_interval)) {
    errors.push('backup_interval must be daily|weekly|monthly');
  }
  if (out.retention_days !== undefined) {
    const n = Number(out.retention_days);
    if (!Number.isInteger(n) || n < 7 || n > 3650) {
      errors.push('retention_days must be integer 7..3650');
    } else {
      out.retention_days = n;
    }
  }
  if (out.max_storage_bytes !== undefined) {
    const n = Number(out.max_storage_bytes);
    if (!Number.isFinite(n) || n < 1) {
      errors.push('max_storage_bytes must be positive number');
    } else {
      out.max_storage_bytes = n;
    }
  }
  if (out.warning_threshold_percent !== undefined) {
    const n = Number(out.warning_threshold_percent);
    if (!Number.isInteger(n) || n < 1 || n > 100) {
      errors.push('warning_threshold_percent must be integer 1..100');
    } else {
      out.warning_threshold_percent = n;
    }
  }

  return { ok: errors.length === 0, errors, data: out };
}

export default async function handler(req, res) {
  const { user, error: authErr } = await requireUser(req);
  if (authErr) return res.status(authErr.status).json(authErr.body);

  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('backup_policies')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ policy: data || null });
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const { ok, errors, data: clean } = validatePolicyInput(body);
    if (!ok) return res.status(400).json({ error: 'invalid_request', details: errors });

    const payload = { user_id: user.id, ...clean };

    const { data, error } = await supabaseAdmin
      .from('backup_policies')
      .upsert(payload, { onConflict: 'user_id' })
      .select('*')
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ policy: data });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'method_not_allowed' });
}
