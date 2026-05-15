// GET /api/backup/audit/logs/validation-history — Get validation test history for review
// Retrieves audit logs from the past N days with optional filtering by validation type

import { supabaseAdmin } from '../../../../../lib/supabase-admin';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const token = (req.headers['authorization'] || '').replace(/^Bearer\s+/, '');
  const { data: user, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  try {
    const { days = 7, validation_type } = req.query;
    const daysNum = parseInt(days, 10) || 7;

    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysNum);

    // Build query
    let query = supabaseAdmin
      .from('audit_validation_logs')
      .select('id, validation_type, test_date, status, metrics, endpoint, issues')
      .gte('test_date', cutoffDate.toISOString());

    // Apply optional filter
    if (validation_type) {
      if (!['api_response_time', 'restore_test', 'storage_connectivity'].includes(validation_type)) {
        return res.status(400).json({ error: 'invalid_validation_type' });
      }
      query = query.eq('validation_type', validation_type);
    }

    const { data: logs, error: logsError } = await query.order('test_date', { ascending: false });

    if (logsError) {
      console.error('[audit/logs/validation-history] query error:', logsError);
      return res.status(500).json({ error: 'query_failed' });
    }

    // Transform logs for response
    const transformedLogs = (logs || []).map(log => ({
      id: log.id,
      validation_type: log.validation_type,
      test_date: log.test_date,
      status: log.status,
      metrics: log.metrics,
      endpoint: log.endpoint,
      issues: log.issues
    }));

    return res.status(200).json({
      success: true,
      logs: transformedLogs
    });

  } catch (error) {
    console.error('[audit/logs/validation-history] fatal:', error);
    return res.status(500).json({ error: error?.message || 'internal_error' });
  }
}
