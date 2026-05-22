// POST /api/audit/trigger-daily — daily cron that runs every enabled audit_config
// and archives audit_logs older than 90 days.
//
// For each row in audit_configs where enabled=true:
//   - compute the metric for audit_name (per-name dispatch)
//   - write an audit_logs row with status (pass|warn|fail|error)
//
// After running audits:
//   - delete audit_logs rows older than 90 days
//
// Auth: Authorization: Bearer <CRON_SECRET>
//
// Vercel cron (vercel.json):
//   { "path": "/api/audit/trigger-daily", "schedule": "0 17 * * *" }
// 17:00 UTC = 02:00 KST next day.

import { supabaseAdmin } from '../../../lib/supabase-admin';

const RETENTION_DAYS = 90;

// Compute the metric for a given audit_name + owner. Returns:
//   { measured_value, status, details }
// status: pass | warn | fail | error
async function computeAudit(auditName, ownerId, threshold) {
  switch (auditName) {
    case 'backup_success_rate': {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabaseAdmin
        .from('backups')
        .select('status')
        .eq('user_id', ownerId)
        .gte('created_at', since);
      if (error) {
        return { measured_value: null, status: 'error', details: { reason: error.message } };
      }
      const total = (data || []).length;
      if (total === 0) {
        return {
          measured_value: null,
          status: 'warn',
          details: { reason: 'no_backups_in_24h', total: 0 },
        };
      }
      const completed = (data || []).filter((r) => r.status === 'completed').length;
      const rate = (completed / total) * 100;
      const status = rate >= threshold ? 'pass' : rate >= threshold - 5 ? 'warn' : 'fail';
      return {
        measured_value: Number(rate.toFixed(2)),
        status,
        details: { window_hours: 24, total, completed },
      };
    }

    case 'api_response_time': {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabaseAdmin
        .from('audit_validation_logs')
        .select('metrics, status')
        .eq('validation_type', 'api_response_time')
        .gte('test_date', since)
        .order('test_date', { ascending: false })
        .limit(50);
      if (error) {
        return { measured_value: null, status: 'error', details: { reason: error.message } };
      }
      const samples = (data || [])
        .map((r) => Number(r?.metrics?.p99_response_ms))
        .filter((n) => Number.isFinite(n));
      if (samples.length === 0) {
        return {
          measured_value: null,
          status: 'warn',
          details: { reason: 'no_samples_in_24h' },
        };
      }
      const avgP99 = samples.reduce((a, b) => a + b, 0) / samples.length;
      const status = avgP99 <= threshold ? 'pass' : avgP99 <= threshold * 1.5 ? 'warn' : 'fail';
      return {
        measured_value: Number(avgP99.toFixed(2)),
        status,
        details: { samples: samples.length, threshold_ms: threshold },
      };
    }

    default:
      return {
        measured_value: null,
        status: 'error',
        details: { reason: 'not_implemented', audit_name: auditName },
      };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const cronSecret = (req.headers['authorization'] || '').replace(/^Bearer\s+/, '');
  if (!process.env.CRON_SECRET || cronSecret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const startedAt = new Date().toISOString();

  try {
    const { data: configs, error: cfgErr } = await supabaseAdmin
      .from('audit_configs')
      .select('config_id, owner_id, audit_name, threshold')
      .eq('enabled', true);
    if (cfgErr) return res.status(500).json({ error: cfgErr.message });

    let auditsRun = 0;
    let passed = 0;
    let warned = 0;
    let failed = 0;
    let errored = 0;
    const errors = [];

    for (const cfg of configs || []) {
      auditsRun += 1;
      try {
        const result = await computeAudit(cfg.audit_name, cfg.owner_id, Number(cfg.threshold));

        const { error: insErr } = await supabaseAdmin.from('audit_logs').insert({
          config_id: cfg.config_id,
          owner_id: cfg.owner_id,
          audit_name: cfg.audit_name,
          measured_value: result.measured_value,
          threshold: cfg.threshold,
          status: result.status,
          details: result.details || {},
        });
        if (insErr) {
          errored += 1;
          errors.push({ config_id: cfg.config_id, stage: 'insert', error: insErr.message });
          continue;
        }

        if (result.status === 'pass') passed += 1;
        else if (result.status === 'warn') warned += 1;
        else if (result.status === 'fail') failed += 1;
        else errored += 1;
      } catch (e) {
        errored += 1;
        errors.push({ config_id: cfg.config_id, error: String(e?.message || e) });
      }
    }

    // Archive (delete) audit_logs rows older than 90 days.
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
    let purged = 0;
    const { count: purgeCount, error: purgeErr } = await supabaseAdmin
      .from('audit_logs')
      .delete({ count: 'exact' })
      .lt('run_at', cutoff);
    if (purgeErr) {
      errors.push({ stage: 'purge', error: purgeErr.message });
    } else {
      purged = purgeCount || 0;
    }

    return res.status(200).json({
      success: true,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      audits_run: auditsRun,
      passed,
      warned,
      failed,
      errored,
      purged_logs: purged,
      retention_days: RETENTION_DAYS,
      errors: errors.slice(0, 50),
    });
  } catch (e) {
    console.error('[audit/trigger-daily] fatal', e);
    return res.status(500).json({ error: e?.message || 'internal_error' });
  }
}
