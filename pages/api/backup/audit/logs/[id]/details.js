// GET /api/backup/audit/logs/[id]/details — Get detailed information for a specific validation test

import { supabaseAdmin } from '../../../../../../lib/supabase-admin';

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
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'invalid_log_id' });
    }

    // Fetch the specific log
    const { data: log, error: logError } = await supabaseAdmin
      .from('audit_validation_logs')
      .select('*')
      .eq('id', id)
      .single();

    if (logError) {
      if (logError.code === 'PGRST116') {
        return res.status(404).json({ error: 'log_not_found' });
      }
      console.error('[audit/logs/details] query error:', logError);
      return res.status(500).json({ error: 'query_failed' });
    }

    if (!log) {
      return res.status(404).json({ error: 'log_not_found' });
    }

    // Return full details
    return res.status(200).json({
      success: true,
      log: {
        id: log.id,
        user_id: log.user_id,
        backup_id: log.backup_id,
        validation_type: log.validation_type,
        endpoint: log.endpoint,
        status: log.status,
        test_date: log.test_date,
        metrics: log.metrics,
        test_details: log.test_details,
        issues: log.issues,
        created_at: log.created_at,
        updated_at: log.updated_at
      }
    });

  } catch (error) {
    console.error('[audit/logs/details] fatal:', error);
    return res.status(500).json({ error: error?.message || 'internal_error' });
  }
}
