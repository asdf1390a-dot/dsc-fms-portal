// POST /api/backup/audit/validate/storage-connectivity — Test Supabase Storage connectivity
// Verifies that backups storage bucket is accessible and responsive
//
// Auth: Bearer CRON_SECRET
// Request: {} (empty)
// Response: Metrics + status (passed/warning/failed)

import { supabaseAdmin } from '../../../../../lib/supabase-admin';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const cronSecret = (req.headers['authorization'] || '').replace(/^Bearer\s+/, '');
  if (!process.env.CRON_SECRET || cronSecret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  try {
    const startTime = Date.now();

    // Test 1: Connectivity - list root directory (minimal operation)
    const { data: files, error: listErr } = await supabaseAdmin.storage
      .from('backups')
      .list('', { limit: 1 });

    const connectionTime = Date.now() - startTime;

    // Test 2: Check if any backups exist (sanity check)
    let hasBackups = false;
    if (!listErr && files && files.length > 0) {
      hasBackups = true;
    }

    const issues = [];
    let status = 'passed';

    if (listErr) {
      issues.push(`Storage list error: ${listErr.message}`);
      status = 'failed';
    }

    if (!hasBackups) {
      issues.push('No backups exist in storage');
      // This is warning level, not failure
      if (status === 'passed') status = 'warning';
    }

    // Timeout threshold: 2 seconds = 2000ms
    const slaTarget = 2000;
    if (connectionTime > slaTarget) {
      issues.push(`Connection time ${connectionTime}ms exceeds SLA target ${slaTarget}ms`);
      if (status === 'passed') status = 'warning';
    }

    const metrics = {
      connection_time_ms: connectionTime,
      bucket_accessible: !listErr,
      files_in_storage: files?.length || 0,
      response_status: listErr ? 'error' : 'ok'
    };

    // Log validation result
    const { error: insertErr } = await supabaseAdmin
      .from('audit_validation_logs')
      .insert({
        user_id: '00000000-0000-0000-0000-000000000000', // System user for cron tests
        validation_type: 'storage_connectivity',
        metrics: metrics,
        status: status,
        test_date: new Date().toISOString(),
        issues: issues.length > 0 ? issues : null
      });

    if (insertErr) {
      console.error('[audit/validate/storage-connectivity] insert error:', insertErr);
    }

    return res.status(200).json({
      success: true,
      test_date: new Date().toISOString(),
      metrics,
      status,
      sla_target_ms: slaTarget,
      sla_compliance: connectionTime <= slaTarget,
      issues
    });

  } catch (error) {
    console.error('[audit/validate/storage-connectivity] fatal:', error);
    return res.status(500).json({ error: error?.message || 'internal_error' });
  }
}
