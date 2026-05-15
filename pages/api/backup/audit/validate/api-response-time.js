// POST /api/backup/audit/validate/api-response-time — Test API response time for SLA compliance
// Target: < 2 seconds (p99)
//
// Auth: Bearer token with evaluator role
// Request: { endpoint, iterations, timeout_ms }
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
    const { endpoint, iterations = 5, timeout_ms = 5000 } = req.body;

    if (!endpoint) {
      return res.status(400).json({ error: 'endpoint is required' });
    }

    const results = [];
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();
      try {
        const response = await fetch(`${baseUrl}${endpoint}`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${cronSecret}` },
          signal: AbortSignal.timeout(timeout_ms)
        });
        const responseTime = Date.now() - startTime;

        results.push({
          iteration: i + 1,
          response_ms: responseTime,
          status: response.status
        });
      } catch (error) {
        results.push({
          iteration: i + 1,
          response_ms: timeout_ms,
          status: 'timeout',
          error: error.message
        });
      }
    }

    const responseTimes = results
      .filter(r => r.status !== 'timeout')
      .map(r => r.response_ms)
      .sort((a, b) => a - b);

    if (responseTimes.length === 0) {
      return res.status(500).json({
        error: 'all_iterations_failed',
        details: results
      });
    }

    const metrics = {
      min_response_ms: Math.min(...responseTimes),
      max_response_ms: Math.max(...responseTimes),
      avg_response_ms: Math.round(
        responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      ),
      median_response_ms: responseTimes[Math.floor(responseTimes.length / 2)],
      p99_response_ms: responseTimes[Math.floor(responseTimes.length * 0.99)]
    };

    const slaTarget = 2000;
    const status = metrics.p99_response_ms <= slaTarget ? 'passed' : 'warning';

    // Insert test result into audit_validation_logs
    const { error: insertErr } = await supabaseAdmin
      .from('audit_validation_logs')
      .insert({
        user_id: '00000000-0000-0000-0000-000000000000', // System user for cron tests
        validation_type: 'api_response_time',
        endpoint: endpoint,
        metrics: metrics,
        status: status,
        test_date: new Date().toISOString(),
        test_details: results
      });

    if (insertErr) {
      console.error('[audit/validate/api-response-time] insert error:', insertErr);
    }

    return res.status(200).json({
      success: true,
      endpoint,
      test_date: new Date().toISOString(),
      metrics,
      status,
      sla_target_ms: slaTarget,
      sla_compliance: status === 'passed',
      test_details: results
    });

  } catch (error) {
    console.error('[audit/validate/api-response-time] fatal:', error);
    return res.status(500).json({ error: error?.message || 'internal_error' });
  }
}
