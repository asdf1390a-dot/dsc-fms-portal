# Migration Status — db/36 Team Dashboard Phase 2

**Last Updated:** 2026-06-03 17:38 KST  
**Status:** ⏳ **PENDING EXECUTION**  
**Priority:** 🔴 **BLOCKING** — Required before Team Dashboard P2 API integration

---

## 📋 Migration Details

**File:** `db/36_team_dashboard_phase2.sql`  
**Commit:** `c336853` (2026-06-01)  
**Database Target:** Supabase PostgreSQL

### SQL Changes
1. **portfolio_items columns:** Adds `skills_used` (TEXT[]) and `impact` (TEXT)
2. **portfolio_items indexes:** Status and creation date indexes for query optimization
3. **milestones table:** New table for project milestone tracking
   - Fields: id, project_id, title, description, target_date, status, owner_id, completion_date, created_at, updated_at
   - Indexes on: project_id, status, target_date, owner_id
   - RLS enabled with public access policy
   - Automatic timestamp updates via trigger

---

## 🚀 Execution Methods

### Method 1: Manual Supabase SQL Editor (Recommended)
1. Go to **Supabase Dashboard** → **SQL Editor**
2. Create new query
3. Copy entire content from `db/36_team_dashboard_phase2.sql`
4. Click **Run**
5. Verify: Check "milestones" table in Tables view

**Estimated time:** 2-3 minutes

### Method 2: Automated Script (Requires Credentials)
```bash
cd /home/jeepney/projects/dsc-fms-portal
SUPABASE_URL="your-project-url" \
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key" \
node scripts/apply-migration.js db/36_team_dashboard_phase2.sql
```

### Method 3: CLI (Supabase CLI)
```bash
supabase migration up
```

---

## ✅ Verification Steps

After migration execution, verify in Supabase:

```sql
-- Check portfolio_items columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'portfolio_items';

-- Check milestones table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'milestones';

-- Check RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'milestones';
```

---

## 📌 Dependencies

- ✅ db/28_asset_master_phase1.sql (Applied)
- ✅ db/29_asset_qr_scanning.sql (Applied)
- ✅ db/35_team_dashboard_phase1.sql (Applied)
- ⏳ **db/36_team_dashboard_phase2.sql** (PENDING)
  - Blocks: Team Dashboard P2 API integration
  - Needed by: `pages/api/team/portfolio` endpoints
  - ETA for unblock: After manual execution in Supabase

---

## 🔗 Related Tasks

- [Asset Master P1 Day 5 Testing](../INCOMPLETE_TASKS_REGISTRY.md) — After db/36 applied
- [Team Dashboard P2 UI Implementation](../INCOMPLETE_TASKS_REGISTRY.md) — Waiting for db/36
- **Deadline:** 2026-06-10 18:00 KST

---

## 📝 Notes

- Migration uses `IF NOT EXISTS` clauses for idempotency
- Can be safely re-run without errors
- No data loss — only additive schema changes
- RLS policy set to public access (can be refined later)
