-- ============================================================================
-- DSC FMS Portal — PM Module (예방보전)
-- 작성: 2026-05-11
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. pm_plans 테이블
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists pm_plans (
  id               uuid primary key default gen_random_uuid(),
  asset_id         uuid references assets(id) on delete set null,
  title            text not null,
  description      text,
  frequency_days   int not null check (frequency_days > 0),
  estimated_hours  numeric(4,1),
  is_active        boolean not null default true,
  created_at       timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. pm_schedules 테이블
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists pm_schedules (
  id                 uuid primary key default gen_random_uuid(),
  plan_id            uuid not null references pm_plans(id) on delete cascade,
  asset_id           uuid references assets(id) on delete set null,
  scheduled_date     date not null,
  status             text not null default 'pending'
                       check (status in ('pending','in_progress','completed','skipped')),
  completed_at       timestamptz,
  completed_by       uuid references auth.users(id) on delete set null,
  completed_by_name  text,
  actual_hours       numeric(4,1),
  notes              text,
  created_at         timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. 인덱스
-- ─────────────────────────────────────────────────────────────────────────────
create index if not exists pm_schedules_scheduled_date_idx on pm_schedules(scheduled_date);
create index if not exists pm_schedules_status_idx         on pm_schedules(status);
create index if not exists pm_schedules_plan_id_idx        on pm_schedules(plan_id);
create index if not exists pm_schedules_asset_id_idx       on pm_schedules(asset_id);
create index if not exists pm_plans_asset_id_idx           on pm_plans(asset_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RLS
-- ─────────────────────────────────────────────────────────────────────────────
alter table pm_plans     enable row level security;
alter table pm_schedules enable row level security;

drop policy if exists "auth_read_pm_plans"    on pm_plans;
create policy "auth_read_pm_plans" on pm_plans
  for select to authenticated using (true);

drop policy if exists "auth_write_pm_plans"   on pm_plans;
create policy "auth_write_pm_plans" on pm_plans
  for insert to authenticated with check (true);

drop policy if exists "auth_update_pm_plans"  on pm_plans;
create policy "auth_update_pm_plans" on pm_plans
  for update to authenticated using (true) with check (true);

drop policy if exists "auth_read_pm_schedules"   on pm_schedules;
create policy "auth_read_pm_schedules" on pm_schedules
  for select to authenticated using (true);

drop policy if exists "auth_write_pm_schedules"  on pm_schedules;
create policy "auth_write_pm_schedules" on pm_schedules
  for insert to authenticated with check (true);

drop policy if exists "auth_update_pm_schedules" on pm_schedules;
create policy "auth_update_pm_schedules" on pm_schedules
  for update to authenticated using (true) with check (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. 뷰: pm_upcoming
-- ─────────────────────────────────────────────────────────────────────────────
create or replace view pm_upcoming as
select
  s.id                                     as schedule_id,
  s.plan_id,
  s.asset_id,
  a.machine_asset_number                   as asset_number,
  a.name_en                                as asset_name,
  p.title,
  s.scheduled_date,
  (s.scheduled_date - current_date)::int   as days_until,
  p.frequency_days
from pm_schedules s
join pm_plans  p on p.id = s.plan_id
left join assets a on a.id = s.asset_id
where s.status = 'pending'
  and s.scheduled_date <= current_date + 30
order by s.scheduled_date asc;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. RPC: get_pm_compliance
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function get_pm_compliance(
  p_year  int default extract(year  from now())::int,
  p_month int default extract(month from now())::int
)
returns table (
  total_scheduled  int,
  total_completed  int,
  compliance_rate  numeric
)
language sql security definer as $$
  select
    count(*)::int                                             as total_scheduled,
    count(*) filter (where status = 'completed')::int        as total_completed,
    round(
      count(*) filter (where status = 'completed') * 100.0
      / nullif(count(*), 0),
      1
    )                                                        as compliance_rate
  from pm_schedules
  where extract(year  from scheduled_date) = p_year
    and extract(month from scheduled_date) = p_month;
$$;
