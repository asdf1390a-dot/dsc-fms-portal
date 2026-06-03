// GET /api/backup/settings — fetch combined policy + quota settings
// POST /api/backup/settings — update settings (policy for user, quota for admin)

import { supabaseAdmin } from '../../../lib/supabase-admin';
import { requireUser } from '../../../lib/career-auth';
import { validatePolicyInput } from './schedule/configure';

const PLAN_TYPES = new Set(['basic', 'standard', 'premium', 'unlimited']);

function isAdmin(user) {
  const a = user?.app_metadata?.role;
  const u = user?.user_metadata?.role;
  return a === 'admin' || u === 'admin';
}

export default async function handler(req, res) {
  const { user, error: authErr } = await requireUser(req);
  if (authErr) return res.status(authErr.status).json(authErr.body);

  if (req.method === 'GET') {
    const [{ data: policy, error: policyErr }, { data: quota, error: quotaErr }] = await Promise.all([
      supabaseAdmin
        .from('backup_policies')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabaseAdmin
        .from('backup_storage_quotas')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle(),
    ]);

    if (policyErr || quotaErr) {
      return res.status(500).json({ error: policyErr?.message || quotaErr?.message });
    }

    return res.status(200).json({
      policy: policy || null,
      quota: quota || null,
    });
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const errors = [];
    const updates = {};

    if (isAdmin(user) && body.quota) {
      const quotaPatch = body.quota;
      if (quotaPatch.plan_type !== undefined) {
        if (typeof quotaPatch.plan_type !== 'string' || !PLAN_TYPES.has(quotaPatch.plan_type)) {
          errors.push('quota.plan_type must be basic|standard|premium|unlimited');
        } else {
          updates.quota_plan_type = quotaPatch.plan_type;
        }
      }
      if (quotaPatch.max_storage_bytes !== undefined) {
        const n = Number(quotaPatch.max_storage_bytes);
        if (!Number.isFinite(n) || n < 0) {
          errors.push('quota.max_storage_bytes must be non-negative number');
        } else {
          updates.quota_max_storage_bytes = n;
        }
      }
    }

    if (body.policy) {
      const { ok, errors: policyErrors, data: clean } = validatePolicyInput(body.policy);
      if (!ok) {
        errors.push(...policyErrors.map((e) => `policy: ${e}`));
      } else {
        updates.policy = clean;
      }
    }

    if (errors.length) {
      return res.status(400).json({ error: 'invalid_request', details: errors });
    }

    try {
      const policyPayload = { user_id: user.id, ...(updates.policy || {}) };
      const quotaPayload = { user_id: user.id };
      if (updates.quota_plan_type !== undefined) quotaPayload.plan_type = updates.quota_plan_type;
      if (updates.quota_max_storage_bytes !== undefined) quotaPayload.max_storage_bytes = updates.quota_max_storage_bytes;

      const results = await Promise.all([
        supabaseAdmin
          .from('backup_policies')
          .upsert(policyPayload, { onConflict: 'user_id' })
          .select('*')
          .single(),
        isAdmin(user) && Object.keys(quotaPayload).length > 1
          ? supabaseAdmin
              .from('backup_storage_quotas')
              .upsert(quotaPayload, { onConflict: 'user_id' })
              .select('*')
              .single()
          : Promise.resolve({ data: null, error: null }),
      ]);

      const [policyRes, quotaRes] = results;
      if (policyRes.error || quotaRes.error) {
        return res.status(500).json({ error: policyRes.error?.message || quotaRes.error?.message });
      }

      return res.status(200).json({
        policy: policyRes.data,
        quota: quotaRes.data || null,
      });
    } catch (e) {
      console.error('[settings] fatal', e);
      return res.status(500).json({ error: e?.message || 'internal_error' });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'method_not_allowed' });
}
