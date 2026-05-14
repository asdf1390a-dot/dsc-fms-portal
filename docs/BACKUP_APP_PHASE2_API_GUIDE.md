# Backup Module Phase 2 — API Implementation Guide

## Endpoint Summary (16 Total)

| Group | Endpoint | Method | Route | Cron? |
|-------|----------|--------|-------|-------|
| Schedule | Configure Policy | GET/PUT | `/api/backups/schedule/config` | ❌ |
| Schedule | Daily Trigger | POST | `/api/cron/backups/schedule/daily` | ✅ |
| Quota | Check Status | GET | `/api/backups/quota/status` | ❌ |
| Quota | Recalculate | PUT | `/api/backups/quota/update` | ❌ |
| Metrics | Summary | GET | `/api/backups/metrics/summary` | ❌ |
| Metrics | Daily Logs | GET | `/api/backups/metrics/daily` | ❌ |
| Metrics | Daily Aggregation | POST | `/api/cron/backups/metrics/daily` | ✅ |
| Cleanup | Auto-Delete | POST | `/api/cron/backups/cleanup/daily` | ✅ |
| Cleanup | Manual Delete | POST | `/api/backups/cleanup/manual` | ❌ |
| Notify | List | GET | `/api/backups/notifications/list` | ❌ |
| Notify | Mark Read | PUT | `/api/backups/notifications/{id}/read` | ❌ |

---

## Implementation Details

### Shared Utilities

Create `lib/backups/service.ts`:

```typescript
import { SupabaseClient } from '@supabase/supabase-js';

export async function getBackupPolicy(
  supabase: SupabaseClient,
  userId: string
): Promise<BackupPolicy | null> {
  const { data, error } = await supabase
    .from('backup_policies')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function getQuotaStatus(
  supabase: SupabaseClient,
  userId: string
): Promise<QuotaStatus> {
  // Fetch quota and calculate usage
  const { data: quota } = await supabase
    .from('backup_storage_quotas')
    .select('*')
    .eq('user_id', userId)
    .single();

  const { data: backups } = await supabase
    .from('backups')
    .select('size_bytes')
    .eq('user_id', userId)
    .eq('status', 'completed');

  const currentUsage = backups?.reduce((sum, b) => sum + (b.size_bytes || 0), 0) || 0;
  const maxStorage = quota?.max_storage_bytes;
  const usagePercent = maxStorage ? Math.round((currentUsage / maxStorage) * 100) : 0;

  return {
    plan_type: quota?.plan_type,
    max_storage_bytes: maxStorage,
    current_usage_bytes: currentUsage,
    usage_percent: usagePercent,
    warning_threshold_percent: quota?.warning_threshold_percent || 80,
    is_warning: usagePercent >= (quota?.warning_threshold_percent || 80),
    is_exceeded: maxStorage ? currentUsage > maxStorage : false,
    last_calculated_at: new Date().toISOString(),
  };
}

export async function sendNotification(
  supabase: SupabaseClient,
  userId: string,
  type: NotificationType,
  message: string,
  channel: NotificationChannel,
  backupId?: string
): Promise<void> {
  const { error } = await supabase
    .from('backup_notifications')
    .insert({
      user_id: userId,
      notification_type: type,
      message,
      notification_channel: channel,
      backup_id: backupId || null,
      sent_at: new Date().toISOString(),
    });

  if (error) throw error;
}

export async function calculateMetrics(
  supabase: SupabaseClient,
  userId: string,
  metricDate: string
): Promise<void> {
  const date = new Date(metricDate);
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const { data: backups } = await supabase
    .from('backups')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', startOfDay.toISOString())
    .lt('created_at', endOfDay.toISOString());

  if (!backups || backups.length === 0) return;

  const successCount = backups.filter(b => b.status === 'completed').length;
  const failureCount = backups.filter(b => b.status === 'failed').length;
  const totalSize = backups.reduce((sum, b) => sum + (b.size_bytes || 0), 0);
  const durations = backups
    .filter(b => b.created_at && b.completed_at)
    .map(b => (new Date(b.completed_at).getTime() - new Date(b.created_at).getTime()) / 1000);
  const avgDuration = durations.length ? Math.round(durations.reduce((a, b) => a + b) / durations.length) : 0;
  const maxDuration = durations.length ? Math.max(...durations) : 0;

  const { error } = await supabase
    .from('backup_metrics')
    .upsert({
      user_id: userId,
      metric_date: metricDate,
      total_backups: backups.length,
      successful_backups: successCount,
      failed_backups: failureCount,
      skipped_backups: 0,
      total_size_bytes: totalSize,
      average_duration_seconds: avgDuration,
      max_duration_seconds: maxDuration,
    }, { onConflict: 'user_id,metric_date' });

  if (error) throw error;
}
```

---

## Endpoint Implementations

### 1. GET `/api/backups/schedule/config`

**File:** `app/api/backups/schedule/config/route.ts`

```typescript
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized', status: 401 }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('backup_policies')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code === 'PGRST116') {
      // Create default policy
      const { data: newPolicy, error: createError } = await supabase
        .from('backup_policies')
        .insert({
          user_id: userId,
          backup_enabled: true,
          backup_time: '02:00',
          backup_interval: 'daily',
          retention_days: 90,
          auto_delete_enabled: true,
          max_storage_bytes: 10737418240,
          warning_threshold_percent: 80,
        })
        .select()
        .single();

      if (createError) throw createError;
      return NextResponse.json({ data: newPolicy, status: 200 });
    }

    if (error) throw error;
    return NextResponse.json({ data, status: 200 });
  } catch (error) {
    console.error('Error fetching backup config:', error);
    return NextResponse.json({ error: 'Internal server error', status: 500 }, { status: 500 });
  }
}
```

### 2. PUT `/api/backups/schedule/config`

```typescript
export async function PUT(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized', status: 401 }, { status: 401 });
    }

    const body = await request.json();

    // Validation
    if (body.backup_time && !/^\d{2}:\d{2}$/.test(body.backup_time)) {
      return NextResponse.json(
        { error: 'Invalid time format (HH:MM)', status: 400 },
        { status: 400 }
      );
    }

    if (body.backup_interval && !['daily', 'weekly', 'monthly'].includes(body.backup_interval)) {
      return NextResponse.json(
        { error: 'Invalid backup interval', status: 400 },
        { status: 400 }
      );
    }

    if (body.retention_days && (body.retention_days < 7 || body.retention_days > 3650)) {
      return NextResponse.json(
        { error: 'Retention days must be between 7 and 3650', status: 400 },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('backup_policies')
      .update(body)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ data, status: 200 });
  } catch (error) {
    console.error('Error updating backup config:', error);
    return NextResponse.json({ error: 'Internal server error', status: 500 }, { status: 500 });
  }
}
```

### 3. POST `/api/cron/backups/schedule/daily`

**File:** `app/api/cron/backups/schedule/daily/route.ts`

```typescript
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  // Verify Vercel Cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized', status: 401 }, { status: 401 });
  }

  try {
    // Get all enabled policies
    const { data: policies } = await supabase
      .from('backup_policies')
      .select('user_id, backup_time')
      .eq('backup_enabled', true);

    if (!policies) {
      return NextResponse.json({ triggered: 0, skipped: 0, failed: 0, status: 200 });
    }

    let triggered = 0;
    let skipped = 0;
    let failed = 0;

    for (const policy of policies) {
      try {
        // Check if backup already exists for today
        const today = new Date().toISOString().split('T')[0];
        const { data: existingBackup } = await supabase
          .from('backups')
          .select('id')
          .eq('user_id', policy.user_id)
          .gte('created_at', `${today}T00:00:00Z`)
          .lt('created_at', `${today}T23:59:59Z`)
          .single();

        if (existingBackup) {
          skipped++;
          continue;
        }

        // Create backup record
        const { error } = await supabase
          .from('backups')
          .insert({
            user_id: policy.user_id,
            name: `Auto Backup ${new Date().toISOString().split('T')[0]}`,
            backup_type: 'agent_state',
            status: 'pending',
          });

        if (error) throw error;
        triggered++;
      } catch (err) {
        console.error(`Error triggering backup for ${policy.user_id}:`, err);
        failed++;
      }
    }

    return NextResponse.json({ triggered, skipped, failed, status: 200 });
  } catch (error) {
    console.error('Error in daily backup schedule:', error);
    return NextResponse.json({ error: 'Internal server error', status: 500 }, { status: 500 });
  }
}
```

### 4. GET `/api/backups/quota/status`

**File:** `app/api/backups/quota/status/route.ts`

```typescript
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { getQuotaStatus } from '@/lib/backups/service';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized', status: 401 }, { status: 401 });
    }

    const status = await getQuotaStatus(supabase, userId);
    return NextResponse.json({ data: status, status: 200 });
  } catch (error) {
    console.error('Error fetching quota status:', error);
    return NextResponse.json({ error: 'Internal server error', status: 500 }, { status: 500 });
  }
}
```

### 5. PUT `/api/backups/quota/update`

**File:** `app/api/backups/quota/update/route.ts`

```typescript
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { getQuotaStatus } from '@/lib/backups/service';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PUT(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized', status: 401 }, { status: 401 });
    }

    // Recalculate storage
    const { data: backups } = await supabase
      .from('backups')
      .select('size_bytes')
      .eq('user_id', userId)
      .eq('status', 'completed');

    const currentUsage = backups?.reduce((sum, b) => sum + (b.size_bytes || 0), 0) || 0;

    // Update quota
    const { data, error } = await supabase
      .from('backup_storage_quotas')
      .update({
        current_usage_bytes: currentUsage,
        last_calculated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      data: {
        current_usage_bytes: currentUsage,
        recalculated_at: new Date().toISOString(),
      },
      status: 200,
    });
  } catch (error) {
    console.error('Error updating quota:', error);
    return NextResponse.json({ error: 'Internal server error', status: 500 }, { status: 500 });
  }
}
```

### 6. GET `/api/backups/metrics/summary`

**File:** `app/api/backups/metrics/summary/route.ts`

```typescript
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized', status: 401 }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: backups } = await supabase
      .from('backups')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString());

    if (!backups) {
      return NextResponse.json({
        data: {
          total_backups: 0,
          successful_backups: 0,
          failed_backups: 0,
          skipped_backups: 0,
          total_size_bytes: 0,
          average_duration_seconds: 0,
          max_duration_seconds: 0,
          failure_rate_percent: 0,
          period_days: days,
        },
        status: 200,
      });
    }

    const successful = backups.filter(b => b.status === 'completed').length;
    const failed = backups.filter(b => b.status === 'failed').length;
    const totalSize = backups.reduce((sum, b) => sum + (b.size_bytes || 0), 0);
    const durations = backups
      .filter(b => b.created_at && b.completed_at)
      .map(b => (new Date(b.completed_at).getTime() - new Date(b.created_at).getTime()) / 1000);
    const avgDuration = durations.length ? Math.round(durations.reduce((a, b) => a + b) / durations.length) : 0;
    const maxDuration = durations.length ? Math.max(...durations) : 0;

    return NextResponse.json({
      data: {
        total_backups: backups.length,
        successful_backups: successful,
        failed_backups: failed,
        skipped_backups: 0,
        total_size_bytes: totalSize,
        average_duration_seconds: avgDuration,
        max_duration_seconds: maxDuration,
        failure_rate_percent: backups.length ? (failed / backups.length) * 100 : 0,
        period_days: days,
      },
      status: 200,
    });
  } catch (error) {
    console.error('Error fetching metrics summary:', error);
    return NextResponse.json({ error: 'Internal server error', status: 500 }, { status: 500 });
  }
}
```

### 7. GET `/api/backups/metrics/daily`

**File:** `app/api/backups/metrics/daily/route.ts`

```typescript
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized', status: 401 }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const limit = parseInt(searchParams.get('limit') || '90');

    let query = supabase
      .from('backup_metrics')
      .select('*')
      .eq('user_id', userId)
      .order('metric_date', { ascending: false })
      .limit(limit);

    if (startDate) query = query.gte('metric_date', startDate);
    if (endDate) query = query.lte('metric_date', endDate);

    const { data, error } = await query;

    if (error) throw error;
    return NextResponse.json({ data: data || [], status: 200 });
  } catch (error) {
    console.error('Error fetching daily metrics:', error);
    return NextResponse.json({ error: 'Internal server error', status: 500 }, { status: 500 });
  }
}
```

### 8. POST `/api/cron/backups/metrics/daily`

**File:** `app/api/cron/backups/metrics/daily/route.ts`

```typescript
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { calculateMetrics } from '@/lib/backups/service';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized', status: 401 }, { status: 401 });
  }

  try {
    // Get unique users with backups
    const { data: users } = await supabase
      .from('backups')
      .select('user_id')
      .distinct();

    if (!users) {
      return NextResponse.json({ aggregated: 0, status: 200 });
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const metricDate = yesterday.toISOString().split('T')[0];

    let aggregated = 0;
    for (const user of users) {
      try {
        await calculateMetrics(supabase, user.user_id, metricDate);
        aggregated++;
      } catch (err) {
        console.error(`Error calculating metrics for ${user.user_id}:`, err);
      }
    }

    return NextResponse.json({ aggregated, status: 200 });
  } catch (error) {
    console.error('Error in metrics aggregation:', error);
    return NextResponse.json({ error: 'Internal server error', status: 500 }, { status: 500 });
  }
}
```

### 9. POST `/api/cron/backups/cleanup/daily`

**File:** `app/api/cron/backups/cleanup/daily/route.ts`

```typescript
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { sendNotification } from '@/lib/backups/service';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized', status: 401 }, { status: 401 });
  }

  try {
    // Get all policies with auto-delete enabled
    const { data: policies } = await supabase
      .from('backup_policies')
      .select('user_id, retention_days')
      .eq('auto_delete_enabled', true);

    if (!policies) {
      return NextResponse.json({ deleted: 0, freed_bytes: 0, users_notified: 0, status: 200 });
    }

    let deleted = 0;
    let freedBytes = 0;
    let usersNotified = 0;

    for (const policy of policies) {
      try {
        // Get expired backups
        const { data: expiredBackups } = await supabase
          .rpc('get_expired_backups', {
            user_id_param: policy.user_id,
            retention_days: policy.retention_days,
          });

        if (!expiredBackups || expiredBackups.length === 0) continue;

        for (const backup of expiredBackups) {
          try {
            // Delete from storage
            const backupFiles = await supabase.storage
              .from('backups')
              .list(`${policy.user_id}/${backup.backup_id}`);

            if (backupFiles.data) {
              for (const file of backupFiles.data) {
                await supabase.storage
                  .from('backups')
                  .remove([`${policy.user_id}/${backup.backup_id}/${file.name}`]);
              }
            }

            // Delete database record
            await supabase
              .from('backups')
              .delete()
              .eq('id', backup.backup_id);

            deleted++;
            freedBytes += backup.size_bytes || 0;
          } catch (err) {
            console.error(`Error deleting backup ${backup.backup_id}:`, err);
          }
        }

        // Send notification
        await sendNotification(
          supabase,
          policy.user_id,
          'deletion_scheduled',
          `Deleted ${expiredBackups.length} expired backup(s)`,
          'email'
        );
        usersNotified++;
      } catch (err) {
        console.error(`Error processing cleanup for ${policy.user_id}:`, err);
      }
    }

    return NextResponse.json({ deleted, freed_bytes: freedBytes, users_notified: usersNotified, status: 200 });
  } catch (error) {
    console.error('Error in cleanup cron:', error);
    return NextResponse.json({ error: 'Internal server error', status: 500 }, { status: 500 });
  }
}
```

### 10. POST `/api/backups/cleanup/manual`

**File:** `app/api/backups/cleanup/manual/route.ts`

```typescript
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized', status: 401 }, { status: 401 });
    }

    const { backup_id } = await request.json();
    if (!backup_id) {
      return NextResponse.json({ error: 'backup_id required', status: 400 }, { status: 400 });
    }

    // Verify ownership
    const { data: backup, error: fetchError } = await supabase
      .from('backups')
      .select('*')
      .eq('id', backup_id)
      .eq('user_id', userId)
      .single();

    if (fetchError || !backup) {
      return NextResponse.json({ error: 'Backup not found', status: 404 }, { status: 404 });
    }

    const freedBytes = backup.size_bytes || 0;

    // Delete from storage
    const backupFiles = await supabase.storage
      .from('backups')
      .list(`${userId}/${backup_id}`);

    if (backupFiles.data) {
      for (const file of backupFiles.data) {
        await supabase.storage
          .from('backups')
          .remove([`${userId}/${backup_id}/${file.name}`]);
      }
    }

    // Delete from database
    const { error: deleteError } = await supabase
      .from('backups')
      .delete()
      .eq('id', backup_id);

    if (deleteError) throw deleteError;

    return NextResponse.json({
      data: {
        deleted_id: backup_id,
        freed_bytes: freedBytes,
      },
      status: 200,
    });
  } catch (error) {
    console.error('Error deleting backup:', error);
    return NextResponse.json({ error: 'Internal server error', status: 500 }, { status: 500 });
  }
}
```

### 11. GET `/api/backups/notifications/list`

**File:** `app/api/backups/notifications/list/route.ts`

```typescript
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized', status: 401 }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const channel = searchParams.get('channel');
    const unreadOnly = searchParams.get('unread_only') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = supabase
      .from('backup_notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (type) query = query.eq('notification_type', type);
    if (channel) query = query.eq('notification_channel', channel);
    if (unreadOnly) query = query.is('read_at', null);

    const { data, count, error } = await query;

    if (error) throw error;
    return NextResponse.json({ data: data || [], count: count || 0, status: 200 });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json({ error: 'Internal server error', status: 500 }, { status: 500 });
  }
}
```

### 12. PUT `/api/backups/notifications/{id}/read`

**File:** `app/api/backups/notifications/[id]/read/route.ts`

```typescript
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized', status: 401 }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('backup_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', params.id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ data, status: 200 });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return NextResponse.json({ error: 'Internal server error', status: 500 }, { status: 500 });
  }
}
```

---

## Database Types

Create `types/backups.ts`:

```typescript
export interface BackupPolicy {
  id: string;
  user_id: string;
  backup_enabled: boolean;
  backup_time: string;
  backup_interval: 'daily' | 'weekly' | 'monthly';
  retention_days: number;
  auto_delete_enabled: boolean;
  max_storage_bytes: number;
  warning_threshold_percent: number;
  created_at: string;
  updated_at: string;
}

export interface BackupStorageQuota {
  id: string;
  user_id: string;
  plan_type: 'basic' | 'standard' | 'premium' | 'unlimited';
  max_storage_bytes: number | null;
  current_usage_bytes: number;
  last_calculated_at: string;
  created_at: string;
  updated_at: string;
}

export interface BackupNotification {
  id: string;
  user_id: string;
  backup_id: string | null;
  notification_type: 'success' | 'failure' | 'quota_warning' | 'quota_exceeded' | 'deletion_scheduled';
  message: string;
  notification_channel: 'email' | 'telegram' | 'in_app';
  sent_at: string;
  read_at: string | null;
  created_at: string;
}

export interface BackupMetrics {
  id: string;
  user_id: string;
  metric_date: string;
  total_backups: number;
  successful_backups: number;
  failed_backups: number;
  skipped_backups: number;
  total_size_bytes: number;
  average_duration_seconds: number;
  max_duration_seconds: number;
  created_at: string;
  updated_at: string;
}

export interface QuotaStatus {
  plan_type: string;
  max_storage_bytes: number | null;
  current_usage_bytes: number;
  usage_percent: number;
  warning_threshold_percent: number;
  is_warning: boolean;
  is_exceeded: boolean;
  last_calculated_at: string;
}

export type NotificationType = 'success' | 'failure' | 'quota_warning' | 'quota_exceeded' | 'deletion_scheduled';
export type NotificationChannel = 'email' | 'telegram' | 'in_app';
```

---

## Cron Job Configuration

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/backups/schedule/daily",
      "schedule": "0 2 * * *"
    },
    {
      "path": "/api/cron/backups/metrics/daily",
      "schedule": "0 3 * * *"
    },
    {
      "path": "/api/cron/backups/cleanup/daily",
      "schedule": "0 4 * * *"
    }
  ]
}
```

Set `CRON_SECRET` environment variable in Vercel dashboard.

---

## Testing Checklist

- [ ] All endpoints return correct status codes
- [ ] RLS policies block unauthorized access
- [ ] Cron jobs execute on schedule
- [ ] Notifications are sent correctly
- [ ] Storage cleanup works properly
- [ ] Metrics aggregation calculates correctly
- [ ] Quota calculations are accurate

---

**Status:** Implementation Ready (2026-05-14)  
**Version:** 2.0  
**Next:** API Route Implementation
