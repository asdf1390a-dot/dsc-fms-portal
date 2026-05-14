// GET /api/backup/quota/status — current storage usage and quota for caller.
//
// Joins backup_storage_quotas + backup_policies + live sum of backups.size_bytes
// (only status='completed') so the response always reflects reality even if the
// daily usage-update cron hasn't run yet.
//
// Auth: Bearer JWT (user). Service-role used server-side to bypass RLS.

import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { requireUser } from '../../../../lib/career-auth';

const DEFAULT_PLAN_TYPE = 'standard';
const DEFAULT_MAX_BYTES = 10737418240; // 10 GB
const DEFAULT_WARNING_THRESHOLD = 80;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const { user, error: authErr } = await requireUser(req);
  if (authErr) return res.status(authErr.status).json(authErr.body);

  try {
    // 1. Quota row (may not exist for fresh users; we'll synthesize defaults)
    const { data: quotaRow, error: quotaErr } = await supabaseAdmin
      .from('backup_storage_quotas')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    if (quotaErr) return res.status(500).json({ error: quotaErr.message });

    // 2. Policy row to pull warning_threshold_percent (Phase 2 stores it there).
    const { data: policy, error: polErr } = await supabaseAdmin
      .from('backup_policies')
      .select('warning_threshold_percent, max_storage_bytes')
      .eq('user_id', user.id)
      .maybeSingle();
    if (polErr) return res.status(500).json({ error: polErr.message });

    // 3. Live usage — sum size_bytes of completed backups.
    //    Use rpc-free pagination-safe aggregation via .select with head=true won't return sum,
    //    so we do a regular select of size_bytes and reduce in JS (cheap; <1000 rows typical).
    const { data: rows, error: sumErr } = await supabaseAdmin
      .from('backups')
      .select('size_bytes')
      .eq('user_id', user.id)
      .eq('status', 'completed');
    if (sumErr) return res.status(500).json({ error: sumErr.message });

    const currentUsageBytes = (rows || []).reduce(
      (acc, r) => acc + (Number(r.size_bytes) || 0),
      0,
    );

    const planType = quotaRow?.plan_type || DEFAULT_PLAN_TYPE;
    const maxStorageBytes =
      quotaRow?.max_storage_bytes ??
      policy?.max_storage_bytes ??
      DEFAULT_MAX_BYTES;
    const warningThresholdPercent =
      policy?.warning_threshold_percent ?? DEFAULT_WARNING_THRESHOLD;

    const usagePercent =
      maxStorageBytes && maxStorageBytes > 0
        ? Math.round((currentUsageBytes / maxStorageBytes) * 10000) / 100 // 2 decimal
        : null; // unlimited

    const warning =
      usagePercent !== null && usagePercent >= warningThresholdPercent;
    const exceeded = usagePercent !== null && usagePercent >= 100;

    return res.status(200).json({
      user_id: user.id,
      plan_type: planType,
      max_storage_bytes: maxStorageBytes,
      current_usage_bytes: currentUsageBytes,
      usage_percent: usagePercent,
      warning_threshold_percent: warningThresholdPercent,
      warning,
      exceeded,
      last_calculated_at: quotaRow?.last_calculated_at || null,
    });
  } catch (e) {
    console.error('[quota/status] fatal', e);
    return res.status(500).json({ error: e?.message || 'internal_error' });
  }
}
