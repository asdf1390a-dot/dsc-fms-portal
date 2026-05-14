# Phase 2 Migration Guide

## Status

- **Phase 1 (22_backup_module.sql):** ❌ NOT YET APPLIED  
- **Phase 2 (23_backup_module_phase2.sql):** ⏳ READY TO APPLY

## Required Migrations

### 1. Phase 1: Base Backup Module
**File:** `db/22_backup_module.sql`  
**Contains:**
- `backups` table (backup records)
- `backup_files` table (individual file metadata)
- RLS policies
- Storage bucket setup

### 2. Phase 2: Automation, Retention, Notifications
**File:** `db/23_backup_module_phase2.sql`  
**Contains:**
- `backup_policies` table (scheduling & retention settings)
- `backup_storage_quotas` table (storage limits)
- `backup_notifications` table (alert logs)
- `backup_metrics` table (daily statistics)
- Column additions to existing tables (compression, storage provider)
- RLS policies for new tables
- Triggers and helper functions

## How to Apply Migrations

### Option 1: Supabase Dashboard (Recommended)

1. Open https://app.supabase.com
2. Select project: **DSC FMS Portal** (pzkvhomhztikhkgwgqzr)
3. Go to **SQL Editor** → **New Query**
4. Copy content from `db/22_backup_module.sql` → Execute
5. Create another query with content from `db/23_backup_module_phase2.sql` → Execute
6. Verify success in console output

### Option 2: Supabase CLI

```bash
npm install -g @supabase/cli
supabase db push
```

### Option 3: Direct PostgreSQL (psql)

If you have the database password:

```bash
psql -U postgres \
  -h pzkvhomhztikhkgwgqzr.supabase.co \
  -p 5432 \
  -d postgres < db/22_backup_module.sql

psql -U postgres \
  -h pzkvhomhztikhkgwgqzr.supabase.co \
  -p 5432 \
  -d postgres < db/23_backup_module_phase2.sql
```

## Verification

After applying both migrations, verify success:

```bash
node check-migration.js
```

Expected output:
```
✅ backups table EXISTS
✅ backup_files table EXISTS
✅ backup_policies table EXISTS
✅ backup_storage_quotas table EXISTS
✅ backup_notifications table EXISTS
✅ backup_metrics table EXISTS
```

## Next Steps

Once migrations are applied:

1. ✅ Phase 2 APIs are ready for testing
2. ✅ Vercel Cron can be configured
3. ✅ UI components can be deployed
4. ✅ End-to-end testing can begin

**Timeline:** Both migrations must be applied before 2026-06-03 for Phase 2 completion.
