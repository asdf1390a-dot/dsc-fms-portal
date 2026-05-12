-- ============================================================
-- DSC FMS Portal — PM Module v2 (작업일지 + 부품 사용)
-- 파일: 17_pm_worklog.sql
-- 전제: 06_pm_module.sql 실행 완료
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. pm_plans 컬럼 추가
-- ─────────────────────────────────────────────────────────────
alter table pm_plans
  add column if not exists frequency_label text
    check (frequency_label in ('daily','weekly','biweekly','monthly','quarterly','biannual','annual'))
    default 'monthly',
  add column if not exists category       text    default 'general',
  add column if not exists checklist      jsonb   default '[]'::jsonb,
  add column if not exists created_by     uuid    references auth.users(id) on delete set null,
  add column if not exists updated_at     timestamptz not null default now();

create or replace function pm_plans_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_pm_plans_updated_at on pm_plans;
create trigger trg_pm_plans_updated_at
  before update on pm_plans
  for each row execute function pm_plans_set_updated_at();

alter table pm_schedules
  add column if not exists updated_at     timestamptz not null default now();

drop trigger if exists trg_pm_schedules_updated_at on pm_schedules;
create trigger trg_pm_schedules_updated_at
  before update on pm_schedules
  for each row execute function pm_plans_set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 2. pm_work_logs
-- ─────────────────────────────────────────────────────────────
create table if not exists pm_work_logs (
  id              uuid primary key default gen_random_uuid(),
  schedule_id     uuid not null references pm_schedules(id) on delete cascade,
  plan_id         uuid not null references pm_plans(id) on delete cascade,
  asset_id        uuid references assets(id) on delete set null,
  performed_by    uuid references auth.users(id) on delete set null,
  performed_by_name text not null,
  started_at      timestamptz,
  ended_at        timestamptz,
  actual_hours    numeric(4,1),
  result          text not null default 'ok'
    check (result in ('ok', 'abnormal', 'deferred')),
  findings        text,
  action_taken    text,
  notes           text,
  checklist_result jsonb default '[]'::jsonb,
  photos          text[] default '{}',
  bm_event_id     uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists pm_work_logs_schedule_idx on pm_work_logs(schedule_id);
create index if not exists pm_work_logs_asset_idx    on pm_work_logs(asset_id);
create index if not exists pm_work_logs_created_idx  on pm_work_logs(created_at desc);

drop trigger if exists trg_pm_work_logs_updated_at on pm_work_logs;
create trigger trg_pm_work_logs_updated_at
  before update on pm_work_logs
  for each row execute function pm_plans_set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 3. pm_parts_used
-- ─────────────────────────────────────────────────────────────
create table if not exists pm_parts_used (
  id              uuid primary key default gen_random_uuid(),
  work_log_id     uuid not null references pm_work_logs(id) on delete cascade,
  schedule_id     uuid not null references pm_schedules(id) on delete cascade,
  asset_id        uuid references assets(id) on delete set null,
  part_id         uuid,
  part_name       text not null,
  part_number     text,
  quantity        numeric(8,2) not null default 1,
  unit            text default 'ea',
  inventory_deducted boolean not null default false,
  created_at      timestamptz not null default now()
);

create index if not exists pm_parts_used_work_log_idx  on pm_parts_used(work_log_id);
create index if not exists pm_parts_used_schedule_idx  on pm_parts_used(schedule_id);
create index if not exists pm_parts_used_asset_idx     on pm_parts_used(asset_id);

-- ─────────────────────────────────────────────────────────────
-- 4. RLS
-- ─────────────────────────────────────────────────────────────
alter table pm_work_logs  enable row level security;
alter table pm_parts_used enable row level security;

drop policy if exists "auth_read_pm_work_logs"   on pm_work_logs;
create policy "auth_read_pm_work_logs" on pm_work_logs for select using (true);

drop policy if exists "auth_write_pm_work_logs"  on pm_work_logs;
create policy "auth_write_pm_work_logs" on pm_work_logs
  for insert to authenticated with check (true);

drop policy if exists "auth_update_pm_work_logs" on pm_work_logs;
create policy "auth_update_pm_work_logs" on pm_work_logs
  for update to authenticated using (true) with check (true);

drop policy if exists "auth_delete_pm_work_logs" on pm_work_logs;
create policy "auth_delete_pm_work_logs" on pm_work_logs
  for delete to authenticated using (true);

drop policy if exists "auth_read_pm_parts_used"  on pm_parts_used;
create policy "auth_read_pm_parts_used" on pm_parts_used for select using (true);

drop policy if exists "auth_write_pm_parts_used" on pm_parts_used;
create policy "auth_write_pm_parts_used" on pm_parts_used
  for insert to authenticated with check (true);

drop policy if exists "auth_delete_pm_parts_used" on pm_parts_used;
create policy "auth_delete_pm_parts_used" on pm_parts_used
  for delete to authenticated using (true);

drop policy if exists "auth_delete_pm_plans" on pm_plans;
create policy "auth_delete_pm_plans" on pm_plans
  for delete to authenticated using (true);

drop policy if exists "auth_delete_pm_schedules" on pm_schedules;
create policy "auth_delete_pm_schedules" on pm_schedules
  for delete to authenticated using (true);

-- ─────────────────────────────────────────────────────────────
-- 5. pm_plan_summary view
-- ─────────────────────────────────────────────────────────────
create or replace view pm_plan_summary as
select
  p.id                                               as plan_id,
  p.asset_id,
  a.machine_asset_number                             as asset_number,
  a.name_en                                          as asset_name,
  p.title,
  p.frequency_days,
  p.frequency_label,
  p.category,
  p.is_active,
  min(s.scheduled_date) filter (where s.status = 'pending')      as next_scheduled_date,
  max(s.scheduled_date) filter (where s.status = 'completed')    as last_completed_date,
  count(s.id) filter (
    where date_trunc('month', s.scheduled_date) = date_trunc('month', now())
  )::int                                             as this_month_total,
  count(s.id) filter (
    where date_trunc('month', s.scheduled_date) = date_trunc('month', now())
      and s.status = 'completed'
  )::int                                             as this_month_done,
  count(s.id) filter (
    where s.status = 'pending'
      and s.scheduled_date < current_date
  )::int                                             as overdue_count
from pm_plans p
left join assets       a on a.id = p.asset_id
left join pm_schedules s on s.plan_id = p.id
group by p.id, p.asset_id, a.machine_asset_number, a.name_en,
         p.title, p.frequency_days, p.frequency_label, p.category, p.is_active;

-- ─────────────────────────────────────────────────────────────
-- 6. RPC: pm_generate_schedules
-- ─────────────────────────────────────────────────────────────
create or replace function pm_generate_schedules(
  p_plan_id    uuid,
  p_start_date date,
  p_count      int default 12
)
returns int
language plpgsql security definer as $$
declare
  v_plan       pm_plans%rowtype;
  v_inserted   int := 0;
  v_sched_date date;
  i            int;
begin
  select * into v_plan from pm_plans where id = p_plan_id;
  if not found then
    raise exception 'pm_plan not found: %', p_plan_id;
  end if;

  for i in 0..(p_count - 1) loop
    v_sched_date := p_start_date + (v_plan.frequency_days * i);
    if not exists (
      select 1 from pm_schedules
      where plan_id = p_plan_id
        and scheduled_date = v_sched_date
    ) then
      insert into pm_schedules (plan_id, asset_id, scheduled_date)
      values (p_plan_id, v_plan.asset_id, v_sched_date);
      v_inserted := v_inserted + 1;
    end if;
  end loop;

  return v_inserted;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 7. RPC: get_pm_compliance_annual
-- ─────────────────────────────────────────────────────────────
create or replace function get_pm_compliance_annual(
  p_year int default extract(year from now())::int
)
returns table (
  month            int,
  total_scheduled  int,
  total_completed  int,
  compliance_rate  numeric
)
language sql security definer as $$
  select
    extract(month from scheduled_date)::int              as month,
    count(*)::int                                        as total_scheduled,
    count(*) filter (where status = 'completed')::int    as total_completed,
    round(
      count(*) filter (where status = 'completed') * 100.0
      / nullif(count(*), 0), 1
    )                                                    as compliance_rate
  from pm_schedules
  where extract(year from scheduled_date) = p_year
  group by extract(month from scheduled_date)
  order by month;
$$;

-- ─────────────────────────────────────────────────────────────
-- 8. RPC: get_pm_compliance_monthly (이번 달 요약 카드용)
-- ─────────────────────────────────────────────────────────────
create or replace function get_pm_compliance_monthly(
  p_month date default date_trunc('month', now())::date
)
returns table (
  target_month     date,
  total_scheduled  int,
  total_completed  int,
  total_overdue    int,
  compliance_rate  numeric
)
language sql security definer as $$
  select
    date_trunc('month', p_month)::date                        as target_month,
    count(*)::int                                             as total_scheduled,
    count(*) filter (where status = 'completed')::int         as total_completed,
    count(*) filter (
      where status = 'pending' and scheduled_date < current_date
    )::int                                                    as total_overdue,
    round(
      count(*) filter (where status = 'completed') * 100.0
      / nullif(count(*), 0), 1
    )                                                         as compliance_rate
  from pm_schedules
  where date_trunc('month', scheduled_date) = date_trunc('month', p_month);
$$;
