-- DSC FMS Portal — PM Phase 1 Schema Validation Queries
-- Purpose: Confirm db/32_pm_module_phase1.sql + db/06_pm_module.sql state before
-- exposing /api/pm/validate/* endpoints.
-- Run in: Supabase Dashboard → SQL Editor (read-only checks; no DDL)

-- 1) Table presence
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('pm_plans', 'pm_schedules', 'pm_work_logs', 'pm_parts_used');

-- 2) pm_plans Phase 1 columns
select column_name, data_type, is_nullable
from information_schema.columns
where table_name = 'pm_plans'
  and column_name in ('frequency_label', 'category', 'checklist', 'created_by', 'updated_at')
order by column_name;

-- 3) pm_schedules.updated_at presence
select column_name, data_type
from information_schema.columns
where table_name = 'pm_schedules' and column_name = 'updated_at';

-- 4) CHECK constraints for enums
select conname, pg_get_constraintdef(c.oid)
from pg_constraint c
join pg_class t on c.conrelid = t.oid
where t.relname in ('pm_plans', 'pm_schedules')
  and c.contype = 'c';

-- 5) RLS enabled?
select relname, relrowsecurity
from pg_class
where relname in ('pm_plans', 'pm_schedules', 'pm_work_logs', 'pm_parts_used');

-- 6) Sanity counts (no PII)
select 'pm_plans' as tbl, count(*) as n from pm_plans
union all
select 'pm_schedules', count(*) from pm_schedules
union all
select 'pm_work_logs', count(*) from pm_work_logs
union all
select 'pm_parts_used', count(*) from pm_parts_used;

-- 7) Overdue snapshot (matches /api/pm/validate/overdue logic)
select count(*) as overdue_count
from pm_schedules
where scheduled_date < current_date
  and status in ('pending', 'in_progress');

-- 8) Schedule conflict snapshot (multiple active schedules same asset+date)
select asset_id, scheduled_date, count(*) as collisions
from pm_schedules
where status in ('pending', 'in_progress')
group by asset_id, scheduled_date
having count(*) > 1
order by collisions desc
limit 20;
