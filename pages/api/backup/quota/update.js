// POST /api/backup/quota/update — admin-only quota override.
//
// Body: { user_id: uuid, plan_type?: string, max_storage_bytes?: number }
// Auth: Bearer JWT where user.app_metadata.role === 'admin' (preferred) or
//       user.user_metadata.role === 'admin' (fallback).
//
// Service-role client bypasses RLS so we enforce admin gate in code.

import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { requireUser } from '../../../../lib/career-auth';

const PLAN_TYPES = new Set(['basic', 'standard', 'premium', 'unlimited']);

function isAdmin(user) {
  const a = user?.app_metadata?.role;
  const u = user?.user_metadata?.role;
  return a === 'admin' || u === 'admin';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const { user, error: authErr } = await requireUser(req);
  if (authErr) return res.status(authErr.status).json(authErr.body);
  if (!isAdmin(user)) {
    return res.status(403).json({ error: 'forbidden_admin_only' });
  }

  const body = req.body || {};
  const errors = [];
  const target_user_id = typeof body.user_id === 'string' ? body.user_id.trim() : '';
  if (!/^[0-9a-f-]{36}$/i.test(target_user_id)) {
    errors.push('user_id must be a uuid');
  }
  const patch = { user_id: target_user_id };

  if (body.plan_type !== undefined) {
    if (typeof body.plan_type !== 'string' || !PLAN_TYPES.has(body.plan_type)) {
      errors.push('plan_type must be basic|standard|premium|unlimited');
    } else {
      patch.plan_type = body.plan_type;
    }
  }
  if (body.max_storage_bytes !== undefined && body.max_storage_bytes !== null) {
    const n = Number(body.max_storage_bytes);
    if (!Number.isFinite(n) || n < 0) {
      errors.push('max_storage_bytes must be non-negative number (or null for unlimited)');
    } else {
      patch.max_storage_bytes = n;
    }
  } else if (body.max_storage_bytes === null) {
    patch.max_storage_bytes = null; // unlimited
  }

  if (errors.length) {
    return res.status(400).json({ error: 'invalid_request', details: errors });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('backup_storage_quotas')
      .upsert(patch, { onConflict: 'user_id' })
      .select('*')
      .single();
    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({ quota: data });
  } catch (e) {
    console.error('[quota/update] fatal', e);
    return res.status(500).json({ error: e?.message || 'internal_error' });
  }
}
