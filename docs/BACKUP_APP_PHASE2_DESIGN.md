# Backup Module Phase 2 — Detailed Design Guide

## Overview

Phase 2 extends the basic backup functionality (Phase 1) with **automated scheduling, retention policies, quota management, notifications, and metrics**. This enables users to:
- Configure daily/weekly/monthly automated backups
- Set retention policies (7–3650 days)
- Track storage usage and quotas
- Receive notifications across multiple channels
- View metrics and analytics

## Architecture

### Tech Stack
- **Framework:** Next.js 14
- **Database:** Supabase (PostgreSQL)
- **Storage:** Supabase Storage (backups bucket)
- **Scheduling:** Vercel Cron
- **Notifications:** Email + Telegram + In-App

### Key Principles
1. **User isolation:** RLS ensures users access only their own data
2. **Automation:** Cron jobs handle daily scheduling, cleanup, metrics
3. **Real-time:** In-app notifications and dashboards update immediately
4. **Extensibility:** Notification channels, plan types, and retention policies can be extended

---

## Data Model

### New Tables

#### 1. `backup_policies`
Stores user-configurable automation and retention settings.

```
backup_policies {
  id: uuid (PK)
  user_id: uuid (FK → auth.users)
  
  -- Scheduling
  backup_enabled: boolean (default: true)
  backup_time: time (default: 02:00 — 20:30 IST)
  backup_interval: enum('daily' | 'weekly' | 'monthly')
  
  -- Retention
  retention_days: int (7–3650, default: 90)
  auto_delete_enabled: boolean (default: true)
  
  -- Storage
  max_storage_bytes: bigint (default: 10 GB)
  warning_threshold_percent: int (1–100, default: 80)
  
  -- Audit
  created_at: timestamptz
  updated_at: timestamptz
  
  unique(user_id)
}
```

#### 2. `backup_storage_quotas`
Tracks current and maximum storage per user.

```
backup_storage_quotas {
  id: uuid (PK)
  user_id: uuid (FK → auth.users)
  
  plan_type: enum('basic' | 'standard' | 'premium' | 'unlimited')
  max_storage_bytes: bigint | null (null = unlimited)
  current_usage_bytes: bigint (default: 0)
  
  last_calculated_at: timestamptz
  
  created_at: timestamptz
  updated_at: timestamptz
  
  unique(user_id)
}
```

#### 3. `backup_notifications`
Audit log of all notifications sent to users.

```
backup_notifications {
  id: uuid (PK)
  user_id: uuid (FK → auth.users)
  backup_id: uuid | null (FK → backups)
  
  notification_type: enum(
    'success' | 'failure' | 'quota_warning' | 'quota_exceeded' | 'deletion_scheduled'
  )
  message: text
  notification_channel: enum('email' | 'telegram' | 'in_app')
  
  sent_at: timestamptz
  read_at: timestamptz | null
  
  created_at: timestamptz
}
```

#### 4. `backup_metrics`
Daily aggregated metrics for dashboards and analytics.

```
backup_metrics {
  id: uuid (PK)
  user_id: uuid (FK → auth.users)
  metric_date: date
  
  -- Counts
  total_backups: int (default: 0)
  successful_backups: int (default: 0)
  failed_backups: int (default: 0)
  skipped_backups: int (default: 0)
  
  -- Size
  total_size_bytes: bigint (default: 0)
  
  -- Performance
  average_duration_seconds: int (default: 0)
  max_duration_seconds: int (default: 0)
  
  created_at: timestamptz
  updated_at: timestamptz
  
  unique(user_id, metric_date)
}
```

### Column Additions

**backups (Phase 1 extension)**
- `storage_provider: text` (enum: 'supabase', 's3', 'local')
- `is_compressed: boolean` (default: false)
- `compression_ratio: decimal` (0 < ratio ≤ 1.0)

**backup_files (Phase 1 extension)**
- `is_compressed: boolean`
- `original_size_bytes: bigint | null`

---

## API Endpoints (16 Total)

### Group 1: Schedule (3 endpoints)

#### 1.1 GET `/api/backups/schedule/config`
Retrieve user's current backup policy.

**Request Headers**
- `x-user-id: uuid`

**Response (200)**
```json
{
  "data": {
    "id": "uuid",
    "backup_enabled": true,
    "backup_time": "02:00",
    "backup_interval": "daily",
    "retention_days": 90,
    "auto_delete_enabled": true,
    "max_storage_bytes": 10737418240,
    "warning_threshold_percent": 80
  },
  "status": 200
}
```

#### 1.2 PUT `/api/backups/schedule/config`
Update user's backup policy.

**Request Headers**
- `x-user-id: uuid`

**Request Body**
```json
{
  "backup_enabled": boolean | undefined,
  "backup_time": "HH:MM" | undefined,
  "backup_interval": "daily" | "weekly" | "monthly" | undefined,
  "retention_days": 7–3650 | undefined,
  "auto_delete_enabled": boolean | undefined,
  "max_storage_bytes": number | undefined,
  "warning_threshold_percent": 1–100 | undefined
}
```

**Response (200)** — Updated policy object

#### 1.3 POST `/api/cron/backups/schedule/daily`
Vercel Cron: Execute scheduled backups for users with `backup_enabled=true`.

**Trigger:** Daily at 02:00 KST (20:30 IST previous day)

**Logic**
1. Query all users where `backup_enabled=true` and `backup_time <= now()`
2. For each user:
   - Check if backup already exists for today (skip if yes)
   - Create new backup record
   - Trigger backup process (async)
   - Log to `backup_metrics`

**Response (200)**
```json
{
  "triggered": 42,
  "skipped": 5,
  "failed": 0,
  "status": 200
}
```

---

### Group 2: Quota (2 endpoints)

#### 2.1 GET `/api/backups/quota/status`
Retrieve current storage quota and usage.

**Request Headers**
- `x-user-id: uuid`

**Response (200)**
```json
{
  "data": {
    "plan_type": "standard",
    "max_storage_bytes": 10737418240,
    "current_usage_bytes": 5368709120,
    "usage_percent": 50,
    "warning_threshold_percent": 80,
    "is_warning": false,
    "is_exceeded": false,
    "last_calculated_at": "2026-05-14T12:00:00Z"
  },
  "status": 200
}
```

#### 2.2 PUT `/api/backups/quota/update`
Manually recalculate storage usage (admin or user).

**Request Headers**
- `x-user-id: uuid`

**Request Body** (optional)
```json
{
  "force_recalculate": boolean | undefined
}
```

**Response (200)**
```json
{
  "data": {
    "current_usage_bytes": 5368709120,
    "recalculated_at": "2026-05-14T13:00:00Z"
  },
  "status": 200
}
```

---

### Group 3: Metrics (3 endpoints)

#### 3.1 GET `/api/backups/metrics/summary`
Retrieve overall backup metrics (all-time summary).

**Request Headers**
- `x-user-id: uuid`

**Query Parameters** (optional)
- `days: int` — Last N days (default: 30)

**Response (200)**
```json
{
  "data": {
    "total_backups": 127,
    "successful_backups": 125,
    "failed_backups": 2,
    "skipped_backups": 0,
    "total_size_bytes": 53687091200,
    "average_duration_seconds": 145,
    "max_duration_seconds": 312,
    "failure_rate_percent": 1.57,
    "period_days": 30
  },
  "status": 200
}
```

#### 3.2 GET `/api/backups/metrics/daily`
Retrieve daily metrics for graphing.

**Request Headers**
- `x-user-id: uuid`

**Query Parameters** (optional)
- `start_date: YYYY-MM-DD`
- `end_date: YYYY-MM-DD`
- `limit: int` (default: 90)

**Response (200)**
```json
{
  "data": [
    {
      "metric_date": "2026-05-14",
      "total_backups": 1,
      "successful_backups": 1,
      "failed_backups": 0,
      "skipped_backups": 0,
      "total_size_bytes": 536870912,
      "average_duration_seconds": 180,
      "max_duration_seconds": 180
    },
    ...
  ],
  "status": 200
}
```

#### 3.3 POST `/api/cron/backups/metrics/daily`
Vercel Cron: Aggregate daily metrics for all users.

**Trigger:** Daily at 03:00 KST (23:30 IST previous day)

**Logic**
1. For each user with backups:
   - Aggregate backups from yesterday
   - Calculate totals and averages
   - Insert into `backup_metrics`

**Response (200)**
```json
{
  "aggregated": 89,
  "status": 200
}
```

---

### Group 4: Cleanup (2 endpoints)

#### 4.1 POST `/api/cron/backups/cleanup/daily`
Vercel Cron: Delete expired backups based on retention policy.

**Trigger:** Daily at 04:00 KST (00:30 IST)

**Logic**
1. For each user where `auto_delete_enabled=true`:
   - Query expired backups using `get_expired_backups(user_id, retention_days)`
   - Delete files from Storage
   - Delete backup records
   - Send notification
   - Update `backup_metrics`

**Response (200)**
```json
{
  "deleted": 12,
  "freed_bytes": 10737418240,
  "users_notified": 12,
  "status": 200
}
```

#### 4.2 POST `/api/backups/cleanup/manual`
Manually delete a specific backup.

**Request Headers**
- `x-user-id: uuid`

**Request Body**
```json
{
  "backup_id": "uuid"
}
```

**Logic**
1. Verify backup belongs to user
2. Delete files from Storage
3. Delete backup record
4. Update quota usage
5. Send notification

**Response (200)**
```json
{
  "deleted_id": "uuid",
  "freed_bytes": 536870912,
  "status": 200
}
```

---

### Group 5: Notifications (2 endpoints)

#### 5.1 GET `/api/backups/notifications/list`
Retrieve all notifications for the user.

**Request Headers**
- `x-user-id: uuid`

**Query Parameters** (optional)
- `type: enum` — Filter by notification type
- `channel: enum` — Filter by channel
- `unread_only: boolean` (default: false)
- `limit: int` (default: 50)
- `offset: int` (default: 0)

**Response (200)**
```json
{
  "data": [
    {
      "id": "uuid",
      "notification_type": "success",
      "message": "Daily backup completed successfully",
      "notification_channel": "email",
      "sent_at": "2026-05-14T02:30:00Z",
      "read_at": null,
      "backup_id": "uuid"
    },
    ...
  ],
  "count": 42,
  "status": 200
}
```

#### 5.2 PUT `/api/backups/notifications/{id}/read`
Mark a notification as read.

**Request Headers**
- `x-user-id: uuid`

**Response (200)**
```json
{
  "data": {
    "id": "uuid",
    "read_at": "2026-05-14T13:00:00Z"
  },
  "status": 200
}
```

---

## API Response Format

### Success (2xx)
```json
{
  "data": object | array,
  "status": 200
}
```

### Error (4xx/5xx)
```json
{
  "error": "Error message",
  "status": 400 | 401 | 403 | 404 | 500
}
```

---

## Authentication & Authorization

- **Authentication:** `x-user-id` header (extracted from JWT in production)
- **Authorization:** Row-level security (RLS) policies in Supabase
- **Admin actions:** Checked via `auth.jwt() ->> 'role'`

---

## Error Handling

| HTTP | Scenario |
|------|----------|
| 400 | Invalid input, validation failed |
| 401 | User not authenticated |
| 403 | User lacks permission |
| 404 | Resource not found |
| 500 | Server error |

---

## Security Considerations

1. **RLS:** All tables protected by row-level policies
2. **Input validation:** Type checking, range validation, enum checks
3. **Storage isolation:** Backups stored in `backups/{user_id}/{backup_id}/` structure
4. **Audit logging:** All notifications logged with timestamps
5. **Notification delivery:** Validated channels, rate limiting (TODO for email/Telegram)

---

## Performance Optimizations

1. **Indexing:** user_id, metric_date, created_at are indexed
2. **Views:** `backup_storage_summary` for quick quota checks
3. **Functions:** PL/pgSQL helpers for expiry calculation
4. **Batch operations:** Cron jobs batch users for efficient processing
5. **Materialized metrics:** Daily aggregation reduces real-time query load

---

## Rollout Plan

### Week 1 (May 13–19)
- ✅ DB migration (23_backup_module_phase2.sql)
- API: Schedule (endpoints 1.1–1.3)
- API: Quota (endpoints 2.1–2.2)

### Week 2 (May 20–26)
- API: Metrics (endpoints 3.1–3.3)
- API: Cleanup (endpoints 4.1–4.2)
- Testing & edge cases

### Week 3 (May 27–Jun 2)
- API: Notifications (endpoints 5.1–5.2)
- UI components (settings, metrics dashboard)
- Final testing & deployment

### Week 4 (Jun 3–9)
- Production monitoring
- Bug fixes & adjustments

---

## Testing Strategy

### Unit Tests
- Input validation for each endpoint
- RLS policy enforcement
- Cron job logic

### Integration Tests
- End-to-end backup workflow
- Quota calculation accuracy
- Notification delivery

### Load Tests
- Cron jobs with 1000+ users
- Concurrent backup creation
- Storage calculation performance

---

## Future Enhancements

1. **Multi-region storage:** AWS S3, Azure Blob
2. **Advanced scheduling:** Custom cron expressions
3. **Backup versioning:** Track file changes
4. **Differential backups:** Only changed files
5. **Encryption:** At-rest encryption for sensitive data
6. **Webhooks:** Notify external systems on backup completion

---

**Status:** Design Complete (2026-05-13)  
**Version:** 2.0 (Phase 2)  
**Next:** API Implementation
