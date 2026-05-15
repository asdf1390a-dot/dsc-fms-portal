-- Backup Module Phase 2 — Automated scheduling, retention policies, notifications, and metrics
-- Extensions to 22_backup_module.sql
-- Applied after: 22_backup_module.sql

-- ============================================================
-- PHASE 2: NEW TABLES & SCHEMA EXTENSIONS
-- ============================================================

-- 1. backup_policies: User-configurable retention and automation settings
create table if not exists public.backup_policies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Scheduling
  backup_enabled boolean default true,
  backup_time time default '02:00'::time,  -- 02:00 KST = 20:30 IST
  backup_interval text default 'daily'
    check (backup_interval in ('daily', 'weekly', 'monthly')),

  -- Retention
  retention_days int default 90
    check (retention_days >= 7 and retention_days <= 3650),  -- 7 days to 10 years
  auto_delete_enabled boolean default true,

  -- Storage quota
  max_storage_bytes bigint default 10737418240,  -- 10 GB
  warning_threshold_percent int default 80
    check (warning_threshold_percent > 0 and warning_threshold_percent <= 100),

  -- Audit
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  unique(user_id)
);

create index if not exists backup_policies_user_id_idx on backup_policies(user_id);

-- 2. backup_storage_quotas: Track per-user storage usage
create table if not exists public.backup_storage_quotas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Plan type
  plan_type text default 'standard'
    check (plan_type in ('basic', 'standard', 'premium', 'unlimited')),

  -- Current usage
  max_storage_bytes bigint,  -- NULL for unlimited
  current_usage_bytes bigint default 0,

  -- Calculated at
  last_calculated_at timestamptz,

  -- Audit
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  unique(user_id)
);

create index if not exists backup_storage_quotas_user_id_idx on backup_storage_quotas(user_id);

-- 3. backup_notifications: Log all notifications sent to users
create table if not exists public.backup_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  backup_id uuid references public.backups(id) on delete set null,

  -- Type of notification
  notification_type text not null
    check (notification_type in ('success', 'failure', 'quota_warning', 'quota_exceeded', 'deletion_scheduled')),

  -- Message content
  message text not null,

  -- Delivery channel
  notification_channel text default 'email'
    check (notification_channel in ('email', 'telegram', 'in_app')),

  -- Status
  sent_at timestamptz default now(),
  read_at timestamptz,

  -- Audit
  created_at timestamptz default now()
);

create index if not exists backup_notifications_user_id_idx on backup_notifications(user_id);
create index if not exists backup_notifications_backup_id_idx on backup_notifications(backup_id);
create index if not exists backup_notifications_type_idx on backup_notifications(notification_type);
create index if not exists backup_notifications_created_at_idx on backup_notifications(created_at desc);

-- 4. backup_metrics: Daily aggregated metrics for dashboard
create table if not exists public.backup_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  metric_date date not null,

  -- Counts
  total_backups int default 0,
  successful_backups int default 0,
  failed_backups int default 0,
  skipped_backups int default 0,  -- e.g., backup already exists for date

  -- Size
  total_size_bytes bigint default 0,

  -- Performance
  average_duration_seconds int default 0,
  max_duration_seconds int default 0,

  -- Audit
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  unique(user_id, metric_date)
);

create index if not exists backup_metrics_user_date_idx on backup_metrics(user_id, metric_date desc);
create index if not exists backup_metrics_date_idx on backup_metrics(metric_date desc);

-- 5. audit_validation_logs: Evaluator validation test results
create table if not exists public.audit_validation_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  backup_id uuid references public.backups(id) on delete set null,

  -- Validation type
  validation_type text not null
    check (validation_type in ('api_response_time', 'restore_test', 'storage_connectivity')),

  -- Endpoint or test target
  endpoint text,

  -- Test metrics and results
  metrics jsonb not null default '{}',
  status text not null
    check (status in ('passed', 'warning', 'failed')),
  test_date timestamptz default now(),
  test_details jsonb,
  issues jsonb default '[]'::jsonb,

  -- Audit
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists audit_validation_logs_user_id_idx on audit_validation_logs(user_id);
create index if not exists audit_validation_logs_user_test_date_idx on audit_validation_logs(user_id, test_date desc);
create index if not exists audit_validation_logs_validation_type_idx on audit_validation_logs(validation_type);
create index if not exists audit_validation_logs_status_idx on audit_validation_logs(status);

-- ============================================================
-- PHASE 2: COLUMN ADDITIONS TO EXISTING TABLES
-- ============================================================

-- 1. Extend backups table with Phase 2 fields
alter table public.backups add column if not exists
  storage_provider text default 'supabase'
  check (storage_provider in ('supabase', 's3', 'local'));

alter table public.backups add column if not exists
  is_compressed boolean default false;

alter table public.backups add column if not exists
  compression_ratio decimal default 1.0
  check (compression_ratio > 0 and compression_ratio <= 1.0);

-- 2. Extend backup_files table with Phase 2 fields
alter table public.backup_files add column if not exists
  is_compressed boolean default false;

alter table public.backup_files add column if not exists
  original_size_bytes bigint;  -- Size before compression

-- ============================================================
-- PHASE 2: ROW-LEVEL SECURITY (RLS)
-- ============================================================

-- 1. backup_policies RLS
alter table public.backup_policies enable row level security;

drop policy if exists "users_can_manage_own_policies" on backup_policies;
create policy "users_can_manage_own_policies" on backup_policies
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 2. backup_storage_quotas RLS
alter table public.backup_storage_quotas enable row level security;

drop policy if exists "users_can_view_own_quotas" on backup_storage_quotas;
create policy "users_can_view_own_quotas" on backup_storage_quotas
  for select using (auth.uid() = user_id);

drop policy if exists "admin_can_update_quotas" on backup_storage_quotas;
create policy "admin_can_update_quotas" on backup_storage_quotas
  for update using (
    (auth.uid() = user_id) or
    (auth.jwt() ->> 'role' = 'admin')
  )
  with check (
    (auth.uid() = user_id) or
    (auth.jwt() ->> 'role' = 'admin')
  );

-- 3. backup_notifications RLS
alter table public.backup_notifications enable row level security;

drop policy if exists "users_can_view_own_notifications" on backup_notifications;
create policy "users_can_view_own_notifications" on backup_notifications
  for select using (auth.uid() = user_id);

drop policy if exists "users_can_update_own_notifications" on backup_notifications;
create policy "users_can_update_own_notifications" on backup_notifications
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 4. backup_metrics RLS
alter table public.backup_metrics enable row level security;

drop policy if exists "users_can_view_own_metrics" on backup_metrics;
create policy "users_can_view_own_metrics" on backup_metrics
  for select using (auth.uid() = user_id);

-- 5. audit_validation_logs RLS
alter table public.audit_validation_logs enable row level security;

drop policy if exists "users_can_view_own_audit_logs" on audit_validation_logs;
create policy "users_can_view_own_audit_logs" on audit_validation_logs
  for select using (auth.uid() = user_id);

drop policy if exists "evaluators_can_insert_audit_logs" on audit_validation_logs;
create policy "evaluators_can_insert_audit_logs" on audit_validation_logs
  for insert with check (auth.uid() = user_id);

-- ============================================================
-- PHASE 2: TRIGGERS FOR AUTOMATED MAINTENANCE
-- ============================================================

-- Trigger: Auto-update backup_policies.updated_at
create or replace function update_backup_policies_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists backup_policies_timestamp on backup_policies;
create trigger backup_policies_timestamp
  before update on backup_policies
  for each row
  execute function update_backup_policies_timestamp();

-- Trigger: Auto-update backup_storage_quotas.updated_at
create or replace function update_backup_storage_quotas_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists backup_storage_quotas_timestamp on backup_storage_quotas;
create trigger backup_storage_quotas_timestamp
  before update on backup_storage_quotas
  for each row
  execute function update_backup_storage_quotas_timestamp();

-- Trigger: Auto-update backup_metrics.updated_at
create or replace function update_backup_metrics_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists backup_metrics_timestamp on backup_metrics;
create trigger backup_metrics_timestamp
  before update on backup_metrics
  for each row
  execute function update_backup_metrics_timestamp();

-- Trigger: Auto-update audit_validation_logs.updated_at
create or replace function update_audit_validation_logs_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists audit_validation_logs_timestamp on audit_validation_logs;
create trigger audit_validation_logs_timestamp
  before update on audit_validation_logs
  for each row
  execute function update_audit_validation_logs_timestamp();

-- ============================================================
-- PHASE 2: HELPER VIEWS & FUNCTIONS
-- ============================================================

-- View: User backup storage summary
create or replace view public.backup_storage_summary as
select
  b.user_id,
  count(b.id) as total_backups,
  sum(coalesce(b.size_bytes, 0)) as total_size_bytes,
  max(b.created_at) as latest_backup_at,
  count(case when b.status = 'completed' then 1 end) as completed_backups,
  count(case when b.status = 'failed' then 1 end) as failed_backups
from public.backups b
group by b.user_id;

-- Function: Calculate storage usage percentage
create or replace function public.get_backup_usage_percent(user_id_param uuid)
returns numeric as $$
declare
  used_bytes bigint;
  max_bytes bigint;
begin
  select coalesce(sum(size_bytes), 0) into used_bytes
  from public.backups
  where user_id = user_id_param and status = 'completed';

  select max_storage_bytes into max_bytes
  from public.backup_storage_quotas
  where user_id = user_id_param;

  if max_bytes is null then
    return null;  -- Unlimited
  end if;

  if max_bytes = 0 then
    return 0;
  end if;

  return round((used_bytes::numeric / max_bytes) * 100, 2);
end;
$$ language plpgsql;

-- Function: Get expired backups for cleanup
create or replace function public.get_expired_backups(
  user_id_param uuid,
  retention_days int default 90
)
returns table(backup_id uuid, backup_name text, size_bytes bigint) as $$
declare
  expiry_date timestamptz;
begin
  expiry_date := now() - (retention_days || ' days')::interval;

  return query
  select
    b.id,
    b.name,
    b.size_bytes
  from public.backups b
  where
    b.user_id = user_id_param and
    b.created_at < expiry_date and
    b.status = 'completed'
  order by b.created_at asc;
end;
$$ language plpgsql;

-- ============================================================
-- PHASE 2: INITIAL DATA SETUP
-- ============================================================

-- Initialize backup_policies for existing users without policies
insert into public.backup_policies (user_id, retention_days, max_storage_bytes)
select distinct user_id, 90, 10737418240
from public.backups
where user_id not in (select user_id from public.backup_policies)
on conflict (user_id) do nothing;

-- Initialize backup_storage_quotas for existing users
insert into public.backup_storage_quotas (user_id, plan_type, max_storage_bytes)
select distinct user_id, 'standard', 10737418240
from public.backups
where user_id not in (select user_id from public.backup_storage_quotas)
on conflict (user_id) do nothing;

-- ============================================================
-- PHASE 2: SUPABASE STORAGE BUCKET SETUP
-- ============================================================

-- Create storage bucket via RLS policies (done via Supabase Dashboard)
-- But here's the SQL for reference if using direct DB:
/*
insert into storage.buckets (id, name, public) values
  ('backups', 'backups', false)
on conflict (id) do nothing;

-- RLS Policy: Users can only access their own backups
create policy "user_backup_access" on storage.objects
  for all using (
    bucket_id = 'backups' and
    auth.uid()::text = (string_to_array(name, '/'))[2]
  );
*/

-- ============================================================
-- PHASE 2: VERIFICATION QUERIES
-- ============================================================

-- Run these to verify migration success:
/*
-- Check all new tables exist
select table_name from information_schema.tables
where table_schema = 'public' and table_name like 'backup_%'
order by table_name;

-- Check column additions
select column_name, data_type
from information_schema.columns
where table_name = 'backups'
and column_name in ('storage_provider', 'is_compressed', 'compression_ratio')
order by column_name;

-- Verify initial data setup
select
  (select count(*) from backup_policies) as policies_count,
  (select count(*) from backup_storage_quotas) as quotas_count,
  (select count(*) from backup_notifications) as notifications_count,
  (select count(*) from backup_metrics) as metrics_count;

-- Check RLS is enabled
select tablename
from pg_tables
where schemaname = 'public'
  and tablename like 'backup_%'
order by tablename;

select tablename, policyname
from pg_policies
where schemaname = 'public'
  and tablename like 'backup_%'
order by tablename, policyname;
*/

-- ============================================================
-- END OF PHASE 2 MIGRATION
-- ============================================================
-- Migration completed: 2026-05-13
-- Applied by: Web-Builder (claude-web-builder)
-- Next step: Verify data integrity and deploy Phase 2 APIs
