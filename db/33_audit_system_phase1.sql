-- Audit System Phase 1 — Config + log tables for daily reliability auditing
-- Scope: AUDIT-P1 (2026-05-22 ~ 2026-05-27)
-- See: project_audit_system.md, AUDIT_SYSTEM_IMPLEMENTATION_CHECKLIST_2026-05-20.md
-- Applied after: 32_pm_module_phase1.sql

-- ============================================================
-- audit_configs: user-defined audit checks with thresholds
-- ============================================================
create table if not exists public.audit_configs (
  config_id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,

  audit_name text not null,
  description text,

  -- Threshold for triggering an alert. Interpretation depends on audit_name.
  threshold numeric not null default 95.0,

  enabled boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(owner_id, audit_name)
);

create index if not exists audit_configs_owner_idx on audit_configs(owner_id);
create index if not exists audit_configs_enabled_idx on audit_configs(enabled) where enabled = true;

-- ============================================================
-- audit_logs: results of each audit run
-- ============================================================
create table if not exists public.audit_logs (
  log_id uuid primary key default gen_random_uuid(),
  config_id uuid references public.audit_configs(config_id) on delete set null,
  owner_id uuid references auth.users(id) on delete cascade,

  audit_name text not null,
  measured_value numeric,
  threshold numeric,
  status text not null
    check (status in ('pass', 'warn', 'fail', 'error')),

  details jsonb default '{}'::jsonb,

  run_at timestamptz not null default now()
);

create index if not exists audit_logs_owner_idx on audit_logs(owner_id);
create index if not exists audit_logs_run_at_idx on audit_logs(run_at desc);
create index if not exists audit_logs_audit_name_idx on audit_logs(audit_name);
create index if not exists audit_logs_status_idx on audit_logs(status);

-- ============================================================
-- updated_at trigger for audit_configs
-- ============================================================
create or replace function public.set_audit_configs_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_audit_configs_updated_at on public.audit_configs;
create trigger trg_audit_configs_updated_at
  before update on public.audit_configs
  for each row execute function public.set_audit_configs_updated_at();

-- ============================================================
-- RLS
-- ============================================================
alter table public.audit_configs enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists audit_configs_own on public.audit_configs;
create policy audit_configs_own on public.audit_configs
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists audit_logs_own on public.audit_logs;
create policy audit_logs_own on public.audit_logs
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ============================================================
-- Default configs (seeded per user lazily by API on first POST)
-- ============================================================
-- backup_success_rate, api_response_time, storage_reliability, alert_delivery
-- are inserted via API when a user first calls POST /api/audit/config.
