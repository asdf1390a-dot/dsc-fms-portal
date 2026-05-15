// POST /api/backup/audit/validate/restore-test — Execute restore test for backup integrity
// Test: Download sample/all files and verify decompression works
//
// Auth: Bearer CRON_SECRET
// Request: { backup_id, test_type, sample_files }
// Response: Metrics + status (passed/failed)

import { supabaseAdmin } from '../../../../../lib/supabase-admin';
import { createGunzip } from 'zlib';
import { promisify } from 'util';

const gunzip = promisify(createGunzip);

async function decompressGzip(buffer) {
  try {
    const decompressed = await gunzip(buffer);
    return decompressed;
  } catch (error) {
    throw new Error(`Decompression failed: ${error.message}`);
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

  try {
    const { backup_id, test_type = 'sample', sample_files = 5, user_id } = req.body;

    if (!backup_id) {
      return res.status(400).json({ error: 'backup_id is required' });
    }

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    // Get backup metadata
    const { data: backup, error: backupError } = await supabaseAdmin
      .from('backups')
      .select('*')
      .eq('id', backup_id)
      .eq('user_id', user_id)
      .single();

    if (backupError || !backup) {
      return res.status(404).json({ error: 'Backup not found' });
    }

    const issues = [];
    const startTime = Date.now();

    // 1. Verify files exist in storage
    const { data: files, error: listErr } = await supabaseAdmin.storage
      .from('backups')
      .list(`${user_id}/${backup_id}`, { limit: 1000 });

    if (listErr || !files || files.length === 0) {
      issues.push('No files found in backup storage');
      return res.status(400).json({
        success: false,
        backup_id,
        status: 'failed',
        issues,
        metrics: {
          total_files: 0,
          files_tested: 0,
          files_passed: 0,
          files_failed: 0,
          data_integrity_check: 'failed',
          compression_valid: false,
          restore_time_seconds: 0
        }
      });
    }

    // 2. Test decompression (sample or full)
    const filesToTest = test_type === 'sample'
      ? files.slice(0, Math.min(sample_files, files.length))
      : files;

    let filesPassed = 0;
    let filesFailed = 0;

    for (const file of filesToTest) {
      try {
        const { data: fileData, error: dlErr } = await supabaseAdmin.storage
          .from('backups')
          .download(`${user_id}/${backup_id}/${file.name}`);

        if (dlErr || !fileData) {
          filesFailed++;
          issues.push(`File ${file.name}: download failed`);
          continue;
        }

        // Test decompression
        const decompressed = await decompressGzip(fileData);

        if (decompressed && decompressed.byteLength > 0) {
          filesPassed++;
        } else {
          filesFailed++;
          issues.push(`File ${file.name}: decompressed size is 0`);
        }
      } catch (error) {
        filesFailed++;
        issues.push(`File ${file.name}: ${error.message}`);
      }
    }

    const restoreTime = (Date.now() - startTime) / 1000;
    const passed = filesFailed === 0 && filesPassed > 0;

    // Log validation result
    const { error: insertErr } = await supabaseAdmin
      .from('audit_validation_logs')
      .insert({
        user_id: user_id,
        backup_id: backup_id,
        validation_type: 'restore_test',
        metrics: {
          total_files: files.length,
          files_tested: filesToTest.length,
          files_passed: filesPassed,
          files_failed: filesFailed,
          data_integrity_check: passed ? 'passed' : 'failed',
          compression_valid: passed,
          restore_time_seconds: Math.round(restoreTime * 100) / 100
        },
        status: passed ? 'passed' : 'failed',
        test_date: new Date().toISOString(),
        issues: issues.length > 0 ? issues : null
      });

    if (insertErr) {
      console.error('[audit/validate/restore-test] insert error:', insertErr);
    }

    return res.status(200).json({
      success: true,
      backup_id,
      test_type,
      test_date: new Date().toISOString(),
      status: passed ? 'passed' : 'failed',
      metrics: {
        total_files: files.length,
        files_tested: filesToTest.length,
        files_passed: filesPassed,
        files_failed: filesFailed,
        data_integrity_check: passed ? 'passed' : 'failed',
        compression_valid: passed,
        restore_time_seconds: Math.round(restoreTime * 100) / 100
      },
      issues
    });

  } catch (error) {
    console.error('[audit/validate/restore-test] fatal:', error);
    return res.status(500).json({ error: error?.message || 'internal_error' });
  }
}
