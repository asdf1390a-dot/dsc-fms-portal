// POST /api/audit/config — upsert user audit configuration
// GET  /api/audit/config — list audit configs for current user
//
// Phase 1: audit_configs table (see db/33_audit_system_phase1.sql).
// Auth: Bearer JWT (user); service-role used server-side to bypass RLS.

import { supabaseAdmin } from '../../../lib/supabase-admin';
import { requireUser } from '../../../lib/career-auth';

const ALLOWED_FIELDS = ['audit_name', 'description', 'threshold', 'enabled'];

export function validateConfigInput(body) {
  const errors = [];
  const out = {};

  for (const key of ALLOWED_FIELDS) {
    if (body[key] === undefined || body[key] === null) continue;
    out[key] = body[key];
  }

  if (!out.audit_name || typeof out.audit_name !== 'string' || out.audit_name.trim().length === 0) {
    errors.push('audit_name is required and must be a non-empty string');
  } else if (out.audit_name.length > 100) {
    errors.push('audit_name must be 100 characters or less');
  }

  if (out.description !== undefined && typeof out.description !== 'string') {
    errors.push('description must be a string');
  }

  if (out.threshold !== undefined) {
    const n = Number(out.threshold);
    if (!Number.isFinite(n)) {
      errors.push('threshold must be a finite number');
    } else {
      out.threshold = n;
    }
  }

  if (out.enabled !== undefined && typeof out.enabled !== 'boolean') {
    errors.push('enabled must be boolean');
  }

  return { ok: errors.length === 0, errors, data: out };
}

export default async function handler(req, res) {
  const { user, error: authErr } = await requireUser(req);
  if (authErr) return res.status(authErr.status).json(authErr.body);

  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('audit_configs')
      .select('*')
      .eq('owner_id', user.id)
      .order('audit_name', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ configs: data || [] });
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const { ok, errors, data: clean } = validateConfigInput(body);
    if (!ok) return res.status(400).json({ error: 'invalid_request', details: errors });

    const payload = { owner_id: user.id, ...clean };

    const { data, error } = await supabaseAdmin
      .from('audit_configs')
      .upsert(payload, { onConflict: 'owner_id,audit_name' })
      .select('*')
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ config: data });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'method_not_allowed' });
}
