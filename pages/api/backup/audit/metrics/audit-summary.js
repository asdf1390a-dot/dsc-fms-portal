// GET /api/backup/audit/metrics/audit-summary — Get today's audit metrics summary for evaluator daily standup
// Aggregates all validation tests run today and computes health metrics

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
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Fetch today's validation logs
    const { data: logs, error: logsError } = await supabaseAdmin
      .from('audit_validation_logs')
      .select('*')
      .gte('test_date', today.toISOString())
      .lt('test_date', tomorrow.toISOString())
      .order('test_date', { ascending: false });

    if (logsError) {
      console.error('[audit/metrics/audit-summary] logs fetch error:', logsError);
    }

    const validationTests = {
      api_response_time: {
        status: 'pending',
        last_tested: null,
        avg_response_ms: null,
        sla_compliant: null
      },
      restore_test: {
        status: 'pending',
        last_tested: null,
        files_passed: null,
        files_failed: null
      },
      storage_connectivity: {
        status: 'pending',
        last_tested: null,
        connection_time_ms: null
      }
    };

    // Process logs and extract latest results by type
    let totalTests = 0;
    let passedTests = 0;
    let warningTests = 0;
    let failedTests = 0;

    if (logs && logs.length > 0) {
      // Group logs by validation_type and get latest of each
      const latestByType = {};
      for (const log of logs) {
        if (!latestByType[log.validation_type]) {
          latestByType[log.validation_type] = log;
        }
      }

      // Extract metrics for each test type
      if (latestByType.api_response_time) {
        const test = latestByType.api_response_time;
        validationTests.api_response_time = {
          status: test.status,
          last_tested: test.test_date,
          avg_response_ms: test.metrics?.avg_response_ms || null,
          sla_compliant: test.status === 'passed'
        };
        totalTests++;
        if (test.status === 'passed') passedTests++;
        else if (test.status === 'warning') warningTests++;
        else failedTests++;
      }

      if (latestByType.restore_test) {
        const test = latestByType.restore_test;
        validationTests.restore_test = {
          status: test.status,
          last_tested: test.test_date,
          files_passed: test.metrics?.files_passed || 0,
          files_failed: test.metrics?.files_failed || 0
        };
        totalTests++;
        if (test.status === 'passed') passedTests++;
        else if (test.status === 'warning') warningTests++;
        else failedTests++;
      }

      if (latestByType.storage_connectivity) {
        const test = latestByType.storage_connectivity;
        validationTests.storage_connectivity = {
          status: test.status,
          last_tested: test.test_date,
          connection_time_ms: test.metrics?.connection_time_ms || null
        };
        totalTests++;
        if (test.status === 'passed') passedTests++;
        else if (test.status === 'warning') warningTests++;
        else failedTests++;
      }
    }

    // Calculate overall health metrics
    let successRate = 0;
    let retentionCompliance = 100.0;
    let availabilityScore = 100.0;
    let reliabilityScore = 100.0;

    if (totalTests > 0) {
      successRate = (passedTests / totalTests) * 100;
      availabilityScore = ((passedTests + warningTests) / totalTests) * 100;
      reliabilityScore = (passedTests / totalTests) * 100;
    }

    // Determine overall status
    let overallStatus = 'healthy';
    let evaluatorRequired = false;

    if (failedTests > 0) {
      overallStatus = 'critical';
      evaluatorRequired = true;
    } else if (warningTests > 0 || successRate < 95) {
      overallStatus = 'warning';
      evaluatorRequired = true;
    }

    const dateStr = today.toISOString().split('T')[0];

    return res.status(200).json({
      success: true,
      date: dateStr,
      metrics: {
        success_rate: Math.round(successRate * 100) / 100,
        retention_compliance: Math.round(retentionCompliance * 100) / 100,
        availability_score: Math.round(availabilityScore * 100) / 100,
        reliability_score: Math.round(reliabilityScore * 100) / 100
      },
      status: overallStatus,
      evaluator_required: evaluatorRequired,
      validation_tests: validationTests
    });

  } catch (error) {
    console.error('[audit/metrics/audit-summary] fatal:', error);
    return res.status(500).json({ error: error?.message || 'internal_error' });
  }
}
