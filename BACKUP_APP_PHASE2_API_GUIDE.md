# Backup App Phase 2 — API Implementation Guide

**For:** Web-Builder  
**Focus:** API endpoints to be implemented in Phase 2  
**Based on:** BACKUP_APP_PHASE2_DESIGN.md

---

## Overview

This guide provides the exact API endpoints, request/response formats, and implementation details for Phase 2 of the Backup App.

## New API Routes (Phase 2)

```
/api/backup/
├── schedule/
│   ├── configure.js         [POST/GET] — Configure backup schedule
│   ├── daily.js             [POST]     — Cron trigger (internal)
│   └── trigger.js           [POST]     — Manual backup trigger
│
├── quota/
│   ├── status.js            [GET]      — Get storage quota status
│   └── update.js            [PUT]      — Update quota settings
│
├── metrics/
│   ├── summary.js           [GET]      — Get backup metrics summary
│   ├── daily.js             [GET]      — Get daily metrics history
│   └── update-usage.js      [POST]     — Cron trigger (internal)
│
├── cleanup/
│   ├── daily.js             [POST]     — Cron trigger (internal)
│   └── manual.js            [POST]     — Manual cleanup
│
├── notifications/
│   ├── list.js              [GET]      — List notifications
│   └── [id]/read.js         [PUT]      — Mark as read
│
└── user/
    ├── telegram/
    │   ├── connect.js       [POST]     — Connect Telegram account
    │   └── disconnect.js    [POST]     — Disconnect Telegram account
```

---

## 1. Schedule Configuration

### 1.1 POST /api/backup/schedule/configure

Configure automatic backup scheduling and retention policy.

**Request:**
```javascript
{
  method: 'POST',
  headers: {
    'Authorization': 'Bearer {token}',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    enabled: true,
    time: '02:00',              // HH:MM format (KST)
    interval: 'daily',          // daily | weekly | monthly
    retention_days: 90,         // 7-3650 days
    auto_delete_enabled: true,
    max_storage_bytes: 10737418240,  // 10 GB
    warning_threshold_percent: 80
  })
}
```

**Response (200):**
```json
{
  "success": true,
  "policy": {
    "id": "uuid",
    "user_id": "uuid",
    "enabled": true,
    "time": "02:00",
    "interval": "daily",
    "retention_days": 90,
    "auto_delete_enabled": true,
    "max_storage_bytes": 10737418240,
    "warning_threshold_percent": 80,
    "updated_at": "2026-05-13T10:00:00Z"
  }
}
```

**Implementation:**
```javascript
// pages/api/backup/schedule/configure.js

import { supabaseAdmin } from '@/lib/supabaseAdmin';

export default async function handler(req, res) {
  const { authorization } = req.headers;
  
  if (!authorization) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authorization.replace('Bearer ', '');
  const { data: user, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  try {
    if (req.method === 'POST') {
      const {
        enabled,
        time,
        interval,
        retention_days,
        auto_delete_enabled,
        max_storage_bytes,
        warning_threshold_percent
      } = req.body;

      // Validation
      if (time && !time.match(/^\d{2}:\d{2}$/)) {
        return res.status(400).json({ error: 'Invalid time format (HH:MM)' });
      }

      if (retention_days && (retention_days < 7 || retention_days > 3650)) {
        return res.status(400).json({ error: 'Retention days must be 7-3650' });
      }

      if (warning_threshold_percent && (warning_threshold_percent < 1 || warning_threshold_percent > 100)) {
        return res.status(400).json({ error: 'Warning threshold must be 1-100' });
      }

      // Upsert policy
      const { data: policy, error } = await supabaseAdmin
        .from('backup_policies')
        .upsert(
          {
            user_id: user.id,
            backup_enabled: enabled ?? true,
            backup_time: time ? time + ':00' : undefined,
            backup_interval: interval || 'daily',
            retention_days: retention_days ?? 90,
            auto_delete_enabled: auto_delete_enabled ?? true,
            max_storage_bytes: max_storage_bytes ?? 10737418240,
            warning_threshold_percent: warning_threshold_percent ?? 80,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'user_id' }
        )
        .select()
        .single();

      if (error) throw error;

      return res.status(200).json({
        success: true,
        policy: {
          id: policy.id,
          user_id: policy.user_id,
          enabled: policy.backup_enabled,
          time: policy.backup_time,
          interval: policy.backup_interval,
          retention_days: policy.retention_days,
          auto_delete_enabled: policy.auto_delete_enabled,
          max_storage_bytes: policy.max_storage_bytes,
          warning_threshold_percent: policy.warning_threshold_percent,
          updated_at: policy.updated_at
        }
      });

    } else if (req.method === 'GET') {
      // Get current policy
      const { data: policy, error } = await supabaseAdmin
        .from('backup_policies')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
        throw error;
      }

      if (!policy) {
        return res.status(404).json({ error: 'No policy configured' });
      }

      return res.status(200).json({
        success: true,
        policy
      });
    }

  } catch (error) {
    console.error('Policy configure error:', error);
    return res.status(500).json({ error: error.message });
  }
}
```

### 1.2 POST /api/backup/schedule/trigger

Manually trigger a backup immediately (bypasses schedule).

**Request:**
```javascript
{
  method: 'POST',
  headers: {
    'Authorization': 'Bearer {token}',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'Manual Backup 2026-05-13'  // Optional, auto-generated if not provided
  })
}
```

**Response (200):**
```json
{
  "success": true,
  "backup": {
    "id": "uuid",
    "user_id": "uuid",
    "name": "Manual Backup 2026-05-13",
    "backup_type": "agent_state",
    "status": "in_progress",
    "created_at": "2026-05-13T10:00:00Z"
  }
}
```

**Response (409 - Already in progress):**
```json
{
  "error": "Backup already in progress",
  "in_progress_backup_id": "uuid",
  "started_at": "2026-05-13T10:00:00Z"
}
```

**Implementation:**
```javascript
// pages/api/backup/schedule/trigger.js

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { authorization } = req.headers;
  if (!authorization) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authorization.replace('Bearer ', '');
  const { data: user, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  try {
    const { name } = req.body;

    // 1. Check for in-progress backup
    const { data: inProgress } = await supabaseAdmin
      .from('backups')
      .select('id, created_at')
      .eq('user_id', user.id)
      .eq('status', 'in_progress')
      .limit(1);

    if (inProgress && inProgress.length > 0) {
      return res.status(409).json({
        error: 'Backup already in progress',
        in_progress_backup_id: inProgress[0].id,
        started_at: inProgress[0].created_at
      });
    }

    // 2. Create backup
    const backupName = name || `Manual Backup ${new Date().toISOString().split('T')[0]}`;
    
    const { data: backup, error: createError } = await supabaseAdmin
      .from('backups')
      .insert({
        user_id: user.id,
        name: backupName,
        backup_type: 'agent_state',
        status: 'in_progress',
        created_by: user.id,
        metadata: {
          trigger: 'manual',
          triggered_at: new Date().toISOString()
        }
      })
      .select()
      .single();

    if (createError) throw createError;

    return res.status(200).json({
      success: true,
      backup: {
        id: backup.id,
        user_id: backup.user_id,
        name: backup.name,
        backup_type: backup.backup_type,
        status: backup.status,
        created_at: backup.created_at
      }
    });

  } catch (error) {
    console.error('Backup trigger error:', error);
    return res.status(500).json({ error: error.message });
  }
}
```

### 1.3 POST /api/backup/schedule/daily (Cron)

Scheduled daily backup trigger. Called by Vercel Cron or external scheduler.

**Timeout Handling:**
- Backups running longer than 30 minutes are marked as 'failed' and cleaned up
- A separate cron job runs every 3 hours to detect stale backups

**Implementation:**
```javascript
// pages/api/backup/schedule/daily.js

import { createDailyBackup } from '@/lib/backup/createDailyBackup';

const BACKUP_TIMEOUT_MINUTES = 30;

export default async function handler(req, res) {
  // Verify cron secret
  const cronSecret = req.headers['authorization']?.replace('Bearer ', '');
  
  if (cronSecret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // 0. Check and cleanup stale backups (older than 30 min)
    const staleThreshold = new Date(Date.now() - BACKUP_TIMEOUT_MINUTES * 60 * 1000);
    const { data: staleBackups } = await supabaseAdmin
      .from('backups')
      .select('id, user_id')
      .eq('status', 'in_progress')
      .lt('created_at', staleThreshold.toISOString());

    for (const backup of staleBackups || []) {
      await supabaseAdmin
        .from('backups')
        .update({
          status: 'failed',
          metadata: {
            failure_reason: 'timeout_exceeded_30_minutes'
          }
        })
        .eq('id', backup.id);
    }

    // 1. Get all users with backup enabled
    const { data: policies } = await supabaseAdmin
      .from('backup_policies')
      .select('user_id')
      .eq('backup_enabled', true);

    const results = [];

    // 2. Create backup for each user
    for (const policy of policies || []) {
      try {
        const result = await createDailyBackup(policy.user_id);
        results.push({
          user_id: policy.user_id,
          backup_id: result.id,
          status: 'created'
        });
      } catch (error) {
        results.push({
          user_id: policy.user_id,
          status: 'failed',
          error: error.message
        });
      }
    }

    return res.status(200).json({
      success: true,
      results,
      stale_backups_cleaned: staleBackups?.length || 0,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Daily backup cron error:', error);
    return res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }

// Add to vercel.json:
// {
//   "crons": [{
//     "path": "/api/backup/schedule/daily",
//     "schedule": "0 2 * * *"
//   }]
// }
```

---

## 2. Quota Management

### 2.1 GET /api/backup/quota/status

Get current storage quota and usage.

**Request:**
```javascript
fetch('/api/backup/quota/status', {
  headers: { 'Authorization': 'Bearer {token}' }
})
```

**Response (200):**
```json
{
  "success": true,
  "quota": {
    "max_bytes": 10737418240,
    "used_bytes": 2147483648,
    "available_bytes": 8589934592,
    "percentage": 20.0,
    "is_warning": false,
    "is_exceeded": false,
    "plan_type": "standard",
    "last_calculated_at": "2026-05-13T10:00:00Z",
    "expiring_soon": [
      {
        "backup_id": "uuid-1",
        "name": "Auto Backup 2026-05-09",
        "size_bytes": 1241513984,
        "days_until_deletion": 5
      },
      {
        "backup_id": "uuid-2",
        "name": "Manual Backup 2026-05-08",
        "size_bytes": 1181116007,
        "days_until_deletion": 4
      }
    ]
  }
}
```

**Implementation:**
```javascript
// pages/api/backup/quota/status.js

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { authorization } = req.headers;
  if (!authorization) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authorization.replace('Bearer ', '');
  const { data: user, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  try {
    // 1. Get quota settings
    const { data: quota } = await supabaseAdmin
      .from('backup_storage_quotas')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!quota) {
      return res.status(404).json({ error: 'Quota not configured' });
    }

    // 2. Calculate current usage
    const { data: backups } = await supabaseAdmin
      .from('backups')
      .select('id, name, size_bytes, created_at')
      .eq('user_id', user.id)
      .eq('status', 'completed');

    const usedBytes = backups?.reduce((sum, b) => sum + (b.size_bytes || 0), 0) || 0;
    const percentage = quota.max_storage_bytes 
      ? (usedBytes / quota.max_storage_bytes) * 100 
      : 0;

    const { data: policy } = await supabaseAdmin
      .from('backup_policies')
      .select('warning_threshold_percent, retention_days')
      .eq('user_id', user.id)
      .single();

    // 3. Calculate expiring_soon (within next 7 days)
    const expiringCutoff = new Date();
    expiringCutoff.setDate(expiringCutoff.getDate() + 7);
    
    const expiringBackups = backups
      ?.filter(b => {
        const createdDate = new Date(b.created_at);
        const expiryDate = new Date(createdDate);
        expiryDate.setDate(expiryDate.getDate() + (policy?.retention_days || 90));
        
        return expiryDate <= expiringCutoff && expiryDate > new Date();
      })
      .map(b => {
        const createdDate = new Date(b.created_at);
        const expiryDate = new Date(createdDate);
        expiryDate.setDate(expiryDate.getDate() + (policy?.retention_days || 90));
        
        const daysUntil = Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24));
        
        return {
          backup_id: b.id,
          name: b.name,
          size_bytes: b.size_bytes,
          days_until_deletion: daysUntil
        };
      })
      .sort((a, b) => a.days_until_deletion - b.days_until_deletion) || [];

    return res.status(200).json({
      success: true,
      quota: {
        max_bytes: quota.max_storage_bytes,
        used_bytes: usedBytes,
        available_bytes: quota.max_storage_bytes - usedBytes,
        percentage: Math.round(percentage * 100) / 100,
        is_warning: percentage >= (policy?.warning_threshold_percent || 80),
        is_exceeded: usedBytes > quota.max_storage_bytes,
        plan_type: quota.plan_type,
        last_calculated_at: quota.last_calculated_at,
        expiring_soon: expiringBackups
      }
    });

  } catch (error) {
    console.error('Quota status error:', error);
    return res.status(500).json({ error: error.message });
  }
}
```

### 2.2 PUT /api/backup/quota/update

Update quota settings.

**Request:**
```javascript
{
  method: 'PUT',
  headers: {
    'Authorization': 'Bearer {token}',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    max_storage_bytes: 21474836480,  // 20 GB
    plan_type: 'premium'
  })
}
```

**Response (200):**
```json
{
  "success": true,
  "quota": {
    "max_storage_bytes": 21474836480,
    "plan_type": "premium",
    "updated_at": "2026-05-13T10:00:00Z"
  }
}
```

**Implementation:**
```javascript
// pages/api/backup/quota/update.js

export default async function handler(req, res) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { authorization } = req.headers;
  if (!authorization) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authorization.replace('Bearer ', '');
  const { data: user, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  try {
    const { max_storage_bytes, plan_type } = req.body;

    const updateData = {};
    if (max_storage_bytes !== undefined) {
      if (max_storage_bytes <= 0) {
        return res.status(400).json({ error: 'max_storage_bytes must be positive' });
      }
      updateData.max_storage_bytes = max_storage_bytes;
    }
    if (plan_type !== undefined) {
      if (!['basic', 'standard', 'premium', 'unlimited'].includes(plan_type)) {
        return res.status(400).json({ error: 'Invalid plan_type' });
      }
      updateData.plan_type = plan_type;
    }

    const { data: quota, error } = await supabaseAdmin
      .from('backup_storage_quotas')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) throw error;

    return res.status(200).json({
      success: true,
      quota: {
        max_storage_bytes: quota.max_storage_bytes,
        plan_type: quota.plan_type,
        updated_at: quota.updated_at
      }
    });

  } catch (error) {
    console.error('Quota update error:', error);
    return res.status(500).json({ error: error.message });
  }
}
```

---

## 3. Metrics & Monitoring

### 3.1 GET /api/backup/metrics/summary

Get backup metrics summary for dashboard.

**Request:**
```javascript
fetch('/api/backup/metrics/summary?days=30', {
  headers: { 'Authorization': 'Bearer {token}' }
})
```

**Response (200):**
```json
{
  "success": true,
  "metrics": {
    "period_days": 30,
    "total_backups": 28,
    "successful": 27,
    "failed": 1,
    "success_rate": 96,
    "total_size_bytes": 33548804341,
    "avg_daily_size_bytes": 1118293478,
    "latest_backup_bytes": 1396477458
  }
}
```

**Implementation:**
```javascript
// pages/api/backup/metrics/summary.js

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { authorization } = req.headers;
  const { days = 30 } = req.query;

  if (!authorization) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authorization.replace('Bearer ', '');
  const { data: user, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  try {
    // Validate days
    const daysNum = Math.min(Math.max(parseInt(days) || 30, 1), 365);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysNum);

    // 1. Get metrics for period
    const { data: metrics } = await supabaseAdmin
      .from('backup_metrics')
      .select('*')
      .eq('user_id', user.id)
      .gte('metric_date', startDate.toISOString().split('T')[0])
      .order('metric_date', { ascending: false });

    // 2. Calculate summary
    let totalBackups = 0;
    let successfulBackups = 0;
    let failedBackups = 0;
    let totalSizeBytes = 0;

    metrics?.forEach(m => {
      totalBackups += m.total_backups || 0;
      successfulBackups += m.successful_backups || 0;
      failedBackups += m.failed_backups || 0;
      totalSizeBytes += m.total_size_bytes || 0;
    });

    const successRate = totalBackups > 0
      ? Math.round((successfulBackups / totalBackups) * 100)
      : 0;

    const avgDailySizeBytes = totalSizeBytes / daysNum;

    // 3. Get largest backup
    const { data: backups } = await supabaseAdmin
      .from('backups')
      .select('size_bytes')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .order('size_bytes', { ascending: false })
      .limit(1);

    const largestBackupBytes = backups?.[0]?.size_bytes || 0;

    return res.status(200).json({
      success: true,
      metrics: {
        period_days: daysNum,
        total_backups: totalBackups,
        successful: successfulBackups,
        failed: failedBackups,
        success_rate: successRate,
        total_size_bytes: totalSizeBytes,
        avg_daily_size_bytes: Math.round(avgDailySizeBytes),
        latest_backup_bytes: largestBackupBytes
      }
    });

  } catch (error) {
    console.error('Metrics summary error:', error);
    return res.status(500).json({ error: error.message });
  }
}
```

### 3.2 GET /api/backup/metrics/daily

Get daily metrics history for chart.

**Request:**
```javascript
fetch('/api/backup/metrics/daily?start_date=2026-05-01&end_date=2026-05-13', {
  headers: { 'Authorization': 'Bearer {token}' }
})
```

**Response (200):**
```json
{
  "success": true,
  "metrics": [
    {
      "date": "2026-05-13",
      "successful": 1,
      "failed": 0,
      "size_bytes": 1241513984,
      "total": 1
    },
    {
      "date": "2026-05-12",
      "successful": 1,
      "failed": 0,
      "size_bytes": 1181116007,
      "total": 1
    }
  ]
}
```

**Implementation:**
```javascript
// pages/api/backup/metrics/daily.js

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { authorization } = req.headers;
  const { start_date, end_date } = req.query;

  if (!authorization) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authorization.replace('Bearer ', '');
  const { data: user, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  try {
    let query = supabaseAdmin
      .from('backup_metrics')
      .select('*')
      .eq('user_id', user.id);

    if (start_date) {
      query = query.gte('metric_date', start_date);
    }

    if (end_date) {
      query = query.lte('metric_date', end_date);
    }

    const { data: metrics } = await query
      .order('metric_date', { ascending: false });

    return res.status(200).json({
      success: true,
      metrics: metrics?.map(m => ({
        date: m.metric_date,
        successful: m.successful_backups || 0,
        failed: m.failed_backups || 0,
        size_bytes: m.total_size_bytes || 0,
        total: m.total_backups || 0
      })) || []
    });

  } catch (error) {
    console.error('Daily metrics error:', error);
    return res.status(500).json({ error: error.message });
  }
}
```

### 3.3 POST /api/backup/metrics/update-usage (Cron)

Update storage usage metrics. Called daily by cron.

**Implementation:**
```javascript
// pages/api/backup/metrics/update-usage.js

export default async function handler(req, res) {
  const cronSecret = req.headers['authorization']?.replace('Bearer ', '');
  
  if (cronSecret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Get all users with policies
    const { data: policies } = await supabaseAdmin
      .from('backup_policies')
      .select('user_id, warning_threshold_percent');

    const results = [];

    for (const policy of policies || []) {
      try {
        // Calculate usage
        const { data: backups } = await supabaseAdmin
          .from('backups')
          .select('size_bytes')
          .eq('user_id', policy.user_id)
          .eq('status', 'completed');

        const usedBytes = backups?.reduce((sum, b) => sum + (b.size_bytes || 0), 0) || 0;

        // Get quota
        const { data: quota } = await supabaseAdmin
          .from('backup_storage_quotas')
          .select('max_storage_bytes')
          .eq('user_id', policy.user_id)
          .single();

        // Update quota
        await supabaseAdmin
          .from('backup_storage_quotas')
          .update({
            current_usage_bytes: usedBytes,
            last_calculated_at: new Date().toISOString()
          })
          .eq('user_id', policy.user_id);

        // Check warning threshold
        if (quota?.max_storage_bytes) {
          const percentage = (usedBytes / quota.max_storage_bytes) * 100;

          if (percentage >= policy.warning_threshold_percent) {
            // Log notification
            await supabaseAdmin
              .from('backup_notifications')
              .insert({
                user_id: policy.user_id,
                notification_type: percentage >= 100 ? 'quota_exceeded' : 'quota_warning',
                message: `Your backup storage is ${Math.round(percentage)}% full`,
                notification_channel: 'email'
              });
          }
        }

        results.push({
          user_id: policy.user_id,
          used_bytes: usedBytes,
          status: 'updated'
        });

      } catch (error) {
        results.push({
          user_id: policy.user_id,
          status: 'failed',
          error: error.message
        });
      }
    }

    return res.status(200).json({
      success: true,
      results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Usage update error:', error);
    return res.status(500).json({ error: error.message });
  }
}

// Add to vercel.json:
// {
//   "crons": [{
//     "path": "/api/backup/metrics/update-usage",
//     "schedule": "0 3 * * *"
//   }]
// }
```

---

## 4. Cleanup Operations

### 4.1 POST /api/backup/cleanup/daily (Cron)

Auto-cleanup expired backups. Called daily by cron.

**Implementation:**
```javascript
// pages/api/backup/cleanup/daily.js

export default async function handler(req, res) {
  const cronSecret = req.headers['authorization']?.replace('Bearer ', '');
  
  if (cronSecret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Get all users with auto_delete enabled
    const { data: policies } = await supabaseAdmin
      .from('backup_policies')
      .select('user_id, retention_days, max_storage_bytes, auto_delete_enabled')
      .eq('auto_delete_enabled', true);

    const results = [];

    for (const policy of policies || []) {
      try {
        // Get expired backups
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() - policy.retention_days);

        const { data: expiredBackups } = await supabaseAdmin
          .from('backups')
          .select('id, name, size_bytes')
          .eq('user_id', policy.user_id)
          .lt('created_at', expiryDate.toISOString())
          .eq('status', 'completed')
          .order('created_at', { ascending: true });

        // Delete expired backups
        let deletedCount = 0;
        for (const backup of expiredBackups || []) {
          const { error } = await supabaseAdmin
            .from('backups')
            .delete()
            .eq('id', backup.id);

          if (!error) {
            deletedCount++;
            // Log notification
            await supabaseAdmin
              .from('backup_notifications')
              .insert({
                user_id: policy.user_id,
                backup_id: backup.id,
                notification_type: 'deletion_scheduled',
                message: `Backup "${backup.name}" was deleted per retention policy`,
                notification_channel: 'in_app'
              });
          }
        }

        results.push({
          user_id: policy.user_id,
          deleted_count: deletedCount,
          status: 'success'
        });

      } catch (error) {
        results.push({
          user_id: policy.user_id,
          status: 'failed',
          error: error.message
        });
      }
    }

    return res.status(200).json({
      success: true,
      results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Cleanup error:', error);
    return res.status(500).json({ error: error.message });
  }
}

// Add to vercel.json:
// {
//   "crons": [{
//     "path": "/api/backup/cleanup/daily",
//     "schedule": "5 2 * * *"
//   }]
// }
```

### 4.2 POST /api/backup/cleanup/manual

Manually delete specific backups.

**Request:**
```javascript
{
  method: 'POST',
  headers: {
    'Authorization': 'Bearer {token}',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    backup_ids: ['uuid1', 'uuid2']
  })
}
```

**Response (200):**
```json
{
  "success": true,
  "deleted_count": 2,
  "failed": []
}
```

**Implementation:**
```javascript
// pages/api/backup/cleanup/manual.js

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { authorization } = req.headers;
  if (!authorization) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authorization.replace('Bearer ', '');
  const { data: user, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  try {
    const { backup_ids = [] } = req.body;

    if (!Array.isArray(backup_ids) || backup_ids.length === 0) {
      return res.status(400).json({ error: 'backup_ids must be non-empty array' });
    }

    let deletedCount = 0;
    const failed = [];

    for (const backupId of backup_ids) {
      try {
        // Verify ownership
        const { data: backup } = await supabaseAdmin
          .from('backups')
          .select('id, user_id')
          .eq('id', backupId)
          .single();

        if (!backup || backup.user_id !== user.id) {
          failed.push({ backup_id: backupId, error: 'Not found or unauthorized' });
          continue;
        }

        // Delete
        const { error } = await supabaseAdmin
          .from('backups')
          .delete()
          .eq('id', backupId);

        if (error) {
          failed.push({ backup_id: backupId, error: error.message });
        } else {
          deletedCount++;
        }

      } catch (error) {
        failed.push({ backup_id: backupId, error: error.message });
      }
    }

    return res.status(200).json({
      success: deletedCount > 0,
      deleted_count: deletedCount,
      failed
    });

  } catch (error) {
    console.error('Manual cleanup error:', error);
    return res.status(500).json({ error: error.message });
  }
}
```

---

## 5. Notifications

### 5.1 GET /api/backup/notifications/list

List notifications for user.

**Request:**
```javascript
fetch('/api/backup/notifications/list?limit=50&type=success', {
  headers: { 'Authorization': 'Bearer {token}' }
})
```

**Response (200):**
```json
{
  "success": true,
  "notifications": [
    {
      "id": "uuid",
      "backup_id": "uuid",
      "notification_type": "success",
      "message": "Backup completed successfully",
      "notification_channel": "email",
      "sent_at": "2026-05-13T10:00:00Z",
      "read_at": null
    }
  ]
}
```

**Implementation:**
```javascript
// pages/api/backup/notifications/list.js

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { authorization } = req.headers;
  const { limit = 50, type } = req.query;

  if (!authorization) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authorization.replace('Bearer ', '');
  const { data: user, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  try {
    let query = supabaseAdmin
      .from('backup_notifications')
      .select('*')
      .eq('user_id', user.id);

    if (type) {
      query = query.eq('notification_type', type);
    }

    const { data: notifications } = await query
      .order('created_at', { ascending: false })
      .limit(Math.min(parseInt(limit) || 50, 500));

    return res.status(200).json({
      success: true,
      notifications: notifications || []
    });

  } catch (error) {
    console.error('Notifications list error:', error);
    return res.status(500).json({ error: error.message });
  }
}
```

### 5.2 PUT /api/backup/notifications/[id]/read

Mark notification as read.

**Request:**
```javascript
{
  method: 'PUT',
  headers: {
    'Authorization': 'Bearer {token}',
    'Content-Type': 'application/json'
  }
}
```

**Response (200):**
```json
{
  "success": true,
  "notification": {
    "id": "uuid",
    "read_at": "2026-05-13T10:00:00Z"
  }
}
```

**Implementation:**
```javascript
// pages/api/backup/notifications/[id]/read.js

export default async function handler(req, res) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { authorization } = req.headers;
  const { id } = req.query;

  if (!authorization) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authorization.replace('Bearer ', '');
  const { data: user, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  try {
    // Verify ownership
    const { data: notification } = await supabaseAdmin
      .from('backup_notifications')
      .select('id, user_id')
      .eq('id', id)
      .single();

    if (!notification || notification.user_id !== user.id) {
      return res.status(404).json({ error: 'Not found' });
    }

    // Update
    const { data: updated, error } = await supabaseAdmin
      .from('backup_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return res.status(200).json({
      success: true,
      notification: {
        id: updated.id,
        read_at: updated.read_at
      }
    });

  } catch (error) {
    console.error('Mark read error:', error);
    return res.status(500).json({ error: error.message });
  }
}
```

---

## 6. User Settings — Telegram Integration

### 6.1 POST /api/user/telegram/connect

Connect or update Telegram account for backup notifications.

**Request:**
```javascript
{
  method: 'POST',
  headers: {
    'Authorization': 'Bearer {token}',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    telegram_chat_id: '123456789',  // User's Telegram chat ID
    telegram_username: '@johndoe'   // Optional, for reference
  })
}
```

**Response (200):**
```json
{
  "success": true,
  "telegram": {
    "chat_id": "123456789",
    "username": "@johndoe",
    "connected_at": "2026-05-13T10:00:00Z",
    "is_active": true
  }
}
```

**Implementation:**
```javascript
// pages/api/user/telegram/connect.js

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { authorization } = req.headers;
  if (!authorization) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authorization.replace('Bearer ', '');
  const { data: user, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  try {
    const { telegram_chat_id, telegram_username } = req.body;

    if (!telegram_chat_id || telegram_chat_id.toString().trim() === '') {
      return res.status(400).json({ error: 'telegram_chat_id is required' });
    }

    // Upsert Telegram connection
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .upsert(
        {
          id: user.id,
          telegram_chat_id: telegram_chat_id.toString(),
          telegram_username: telegram_username || null,
          telegram_connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        { onConflict: 'id' }
      )
      .select()
      .single();

    if (error) throw error;

    return res.status(200).json({
      success: true,
      telegram: {
        chat_id: profile.telegram_chat_id,
        username: profile.telegram_username,
        connected_at: profile.telegram_connected_at,
        is_active: !!profile.telegram_chat_id
      }
    });

  } catch (error) {
    console.error('Telegram connect error:', error);
    return res.status(500).json({ error: error.message });
  }
}
```

### 6.2 POST /api/user/telegram/disconnect

Disconnect Telegram account.

**Request:**
```javascript
{
  method: 'POST',
  headers: {
    'Authorization': 'Bearer {token}',
    'Content-Type': 'application/json'
  }
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Telegram account disconnected"
}
```

**Implementation:**
```javascript
// pages/api/user/telegram/disconnect.js

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { authorization } = req.headers;
  if (!authorization) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authorization.replace('Bearer ', '');
  const { data: user, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  try {
    // Clear Telegram settings
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({
        telegram_chat_id: null,
        telegram_username: null,
        telegram_connected_at: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (error) throw error;

    return res.status(200).json({
      success: true,
      message: 'Telegram account disconnected'
    });

  } catch (error) {
    console.error('Telegram disconnect error:', error);
    return res.status(500).json({ error: error.message });
  }
}
```

---

## Vercel Configuration

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/backup/schedule/daily",
      "schedule": "0 2 * * *"
    },
    {
      "path": "/api/backup/cleanup/daily",
      "schedule": "5 2 * * *"
    },
    {
      "path": "/api/backup/metrics/update-usage",
      "schedule": "0 3 * * *"
    }
  ]
}
```

---

## Environment Variables

```bash
# .env.local
CRON_SECRET=your_secure_cron_secret_here
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

---

**Document completed:** 2026-05-13  
**Next step:** Implement these API routes and test with Postman/curl
