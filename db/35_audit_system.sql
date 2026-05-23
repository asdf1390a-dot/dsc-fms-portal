-- Audit System (Daily Reliability Score) — AUDIT-P1
-- Adds DRS event logs + daily sessions on top of existing audit_configs (db/33).
-- Uses distinct table names to avoid collision with `audit_logs` from db/33.
-- Applied after: 34_discord_bot_phase1.sql

-- ============================================================
-- audit_event_logs: raw event-level signals for DRS calculation
-- (event_type ∈ backup | storage | integrity | access)
-- ============================================================
create table if not exists public.audit_event_logs (
  id uuid primary key default gen_random_uuid(),
  event_type text not null
    check (event_type in ('backup', 'storage', 'integrity', 'access')),
  status text not null
    check (status in ('success', 'warning', 'failure')),
  score integer
    check (score is null or (score between 0 and 100)),
  details jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_event_logs_event_type
  on public.audit_event_logs(event_type);
create index if not exists idx_audit_event_logs_created_at
  on public.audit_event_logs(created_at desc);

-- ============================================================
-- audit_sessions: daily aggregated DRS reports
-- ============================================================
create table if not exists public.audit_sessions (
  id uuid primary key default gen_random_uuid(),
  report_date date not null unique,
  drs_score integer not null
    check (drs_score between 0 and 100),
  backup_recovery_rate integer
    check (backup_recovery_rate is null or (backup_recovery_rate between 0 and 100)),
  storage_health_rate integer
    check (storage_health_rate is null or (storage_health_rate between 0 and 100)),
  data_integrity_rate integer
    check (data_integrity_rate is null or (data_integrity_rate between 0 and 100)),
  accessibility_rate integer
    check (accessibility_rate is null or (accessibility_rate between 0 and 100)),
  status text default 'pending'
    check (status in ('pending', 'good', 'caution', 'critical')),
  telegram_sent boolean default false,
  discord_sent boolean default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_sessions_report_date
  on public.audit_sessions(report_date desc);
create index if not exists idx_audit_sessions_status
  on public.audit_sessions(status);

-- ============================================================
-- RLS — authenticated reads, service_role writes
-- ============================================================
alter table public.audit_event_logs enable row level security;
alter table public.audit_sessions enable row level security;

drop policy if exists audit_event_logs_auth_read on public.audit_event_logs;
create policy audit_event_logs_auth_read on public.audit_event_logs
  for select to authenticated using (true);

drop policy if exists audit_event_logs_service_write on public.audit_event_logs;
create policy audit_event_logs_service_write on public.audit_event_logs
  for all to service_role using (true) with check (true);

drop policy if exists audit_sessions_auth_read on public.audit_sessions;
create policy audit_sessions_auth_read on public.audit_sessions
  for select to authenticated using (true);

drop policy if exists audit_sessions_service_write on public.audit_sessions;
create policy audit_sessions_service_write on public.audit_sessions
  for all to service_role using (true) with check (true);
