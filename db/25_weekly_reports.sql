-- ============================================================
-- DSC FMS Portal — Weekly Report Auto-Generation Module
-- 파일: 25_weekly_reports.sql
-- 작성: 2026-05-14
-- 전제: 01_schema.sql, 04_bm_module_v2.sql, 05_kpi_rpc.sql,
--       06_pm_module.sql, 15_kpi_module.sql, 17_pm_worklog.sql,
--       18_management_reports.sql 실행 완료
-- 설계서: WEEKLY_REPORT_AUTO_GENERATION_DESIGN.md
-- ============================================================
-- Week 1 분량: DB 테이블 + RPC + RLS만 포함.
-- API 엔드포인트 / UI / Cron 은 Week 2 이후에 작성.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 0. ISO 8601 주간 범위 계산 헬퍼 (PostgreSQL 표준)
-- ─────────────────────────────────────────────────────────────
-- PostgreSQL 자체 함수: to_date(year||'-'||week, 'IYYY-IW') 는
-- ISO 주의 월요일을 반환한다. 우리는 이 표준을 따른다.

create or replace function iso_week_start(p_year int, p_week int)
returns date language sql immutable as $$
  select to_date(p_year::text || '-' || lpad(p_week::text, 2, '0'), 'IYYY-IW');
$$;

create or replace function iso_week_end(p_year int, p_week int)
returns date language sql immutable as $$
  select iso_week_start(p_year, p_week) + 6;
$$;

comment on function iso_week_start(int,int) is 'ISO 8601 주의 월요일 날짜 반환';
comment on function iso_week_end(int,int)   is 'ISO 8601 주의 일요일 날짜 반환';


-- ─────────────────────────────────────────────────────────────
-- 1. weekly_reports — 주간 자동 생성 보고서
-- ─────────────────────────────────────────────────────────────
create table if not exists weekly_reports (
  id                uuid primary key default gen_random_uuid(),
  year              int  not null,
  week              int  not null check (week between 1 and 53),
  week_start_date   date not null,
  week_end_date     date not null,

  -- 부서별 JSON (자동 집계 결과)
  production        jsonb not null default '{}'::jsonb,
  technology        jsonb not null default '{}'::jsonb,
  maintenance       jsonb not null default '{}'::jsonb,
  management        jsonb not null default '{}'::jsonb,

  -- 메타
  status            text  not null default 'generated'
    check (status in ('generated','reviewed','approved','rejected')),
  generated_by      text  not null default 'system',     -- 'system' 또는 user_id 문자열
  reviewed_by       uuid  references auth.users(id) on delete set null,
  approved_by       uuid  references auth.users(id) on delete set null,

  generated_at      timestamptz not null default now(),
  reviewed_at       timestamptz,
  approved_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  unique (year, week)
);

create index if not exists weekly_reports_year_week_idx
  on weekly_reports(year desc, week desc);
create index if not exists weekly_reports_status_idx
  on weekly_reports(status);
create index if not exists weekly_reports_dates_idx
  on weekly_reports(week_start_date desc);

comment on table weekly_reports is
  '주간업무양식 자동 생성 보고서 — 부서별 JSON 집계 + 상태 워크플로우';


-- ─────────────────────────────────────────────────────────────
-- 2. weekly_comments — 부서별 해석/코멘트
-- ─────────────────────────────────────────────────────────────
create table if not exists weekly_comments (
  id                uuid primary key default gen_random_uuid(),
  report_id         uuid not null references weekly_reports(id) on delete cascade,
  dept_name         text not null
    check (dept_name in ('production','technology','maintenance','management')),
  comment_type      text not null default 'note'
    check (comment_type in ('interpretation','finding','action','note')),
  comment           text not null,
  author_id         uuid references auth.users(id) on delete set null,
  author_name       text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists weekly_comments_report_idx on weekly_comments(report_id);
create index if not exists weekly_comments_dept_idx   on weekly_comments(dept_name);

comment on table weekly_comments is
  '주간 보고서에 대한 부서별 코멘트 / 해석';


-- ─────────────────────────────────────────────────────────────
-- 3. weekly_auto_logs — 자동 생성 실행 로그
-- ─────────────────────────────────────────────────────────────
create table if not exists weekly_auto_logs (
  id                uuid primary key default gen_random_uuid(),
  execution_time    timestamptz not null default now(),
  target_year       int,
  target_week       int,
  status            text not null
    check (status in ('success','failed','skipped')),
  error_msg         text,
  rows_processed    int  not null default 0,
  duration_ms       int,
  triggered_by      text not null default 'cron'      -- 'cron' | 'manual' | user_id
);

create index if not exists weekly_auto_logs_time_idx
  on weekly_auto_logs(execution_time desc);

comment on table weekly_auto_logs is
  '주간 자동 생성 RPC/Cron 실행 이력';


-- ─────────────────────────────────────────────────────────────
-- 4. updated_at 트리거
-- ─────────────────────────────────────────────────────────────
create or replace function weekly_reports_touch_updated()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_weekly_reports_updated on weekly_reports;
create trigger trg_weekly_reports_updated
  before update on weekly_reports
  for each row execute function weekly_reports_touch_updated();

drop trigger if exists trg_weekly_comments_updated on weekly_comments;
create trigger trg_weekly_comments_updated
  before update on weekly_comments
  for each row execute function weekly_reports_touch_updated();


-- ─────────────────────────────────────────────────────────────
-- 5. 부서별 집계 RPC — 생산 (Production)
--    데이터 소스: kpi_actuals + kpi_targets
-- ─────────────────────────────────────────────────────────────
create or replace function get_weekly_production_data(p_year int, p_week int)
returns jsonb
language plpgsql security definer as $$
declare
  v_start date := iso_week_start(p_year, p_week);
  v_end   date := iso_week_end  (p_year, p_week);
  v_plan         numeric;
  v_actual       numeric;
  v_oee          numeric;
  v_achievement  numeric;
  v_daily        jsonb;
begin
  -- 월간 계획치를 주간으로 환산 (계획 / 4)
  select coalesce(sum(target_value) / 4.0, 0)
    into v_plan
  from kpi_targets
  where category_id = 'production_volume'
    and target_month >= date_trunc('month', v_start)::date
    and target_month <  (date_trunc('month', v_end) + interval '1 month')::date;

  -- 주간 실적 합계
  select coalesce(sum(actual_value), 0)
    into v_actual
  from kpi_actuals
  where category_id = 'production_volume'
    and target_month >= v_start
    and target_month <= v_end;

  -- OEE 평균
  select avg(actual_value)
    into v_oee
  from kpi_actuals
  where category_id = 'oee'
    and target_month >= v_start
    and target_month <= v_end;

  -- 달성율
  v_achievement := case
    when v_plan > 0 then round((v_actual / v_plan * 100)::numeric, 1)
    else null
  end;

  -- 일별 생산량 breakdown
  select coalesce(
           jsonb_agg(jsonb_build_object(
             'date',  target_month,
             'qty',   actual_value
           ) order by target_month),
           '[]'::jsonb)
    into v_daily
  from kpi_actuals
  where category_id = 'production_volume'
    and target_month >= v_start
    and target_month <= v_end;

  return jsonb_build_object(
    'plan',              v_plan,
    'actual',            v_actual,
    'achievement_rate',  v_achievement,
    'oee',               round(coalesce(v_oee, 0)::numeric, 1),
    'daily_breakdown',   v_daily,
    'notes',             ''
  );
end;
$$;


-- ─────────────────────────────────────────────────────────────
-- 6. 부서별 집계 RPC — 기술 (Technology)
--    데이터 소스: bm_events (점검/개선 분류는 status로 근사)
--                kpi_actuals.plan_achievement
-- ─────────────────────────────────────────────────────────────
create or replace function get_weekly_technology_data(p_year int, p_week int)
returns jsonb
language plpgsql security definer as $$
declare
  v_start date := iso_week_start(p_year, p_week);
  v_end   date := iso_week_end  (p_year, p_week);
  v_check_count       int;
  v_improvement_count int;
  v_issues_open       int;
  v_schedule          numeric;
begin
  -- 점검 건수: 해당 주에 보고된 BM 이벤트 (취소 제외)
  select count(*) into v_check_count
  from bm_events
  where reported_at::date between v_start and v_end
    and status <> 'cancelled';

  -- 개선 건수: 해당 주에 해결 완료된 건
  select count(*) into v_improvement_count
  from bm_events
  where status = 'resolved'
    and coalesce(downtime_end, updated_at)::date between v_start and v_end;

  -- 열린 이슈 (시점 스냅샷)
  select count(*) into v_issues_open
  from bm_events
  where status in ('open','in_progress','pending_parts');

  -- 일정 준수율
  select avg(actual_value) into v_schedule
  from kpi_actuals
  where category_id = 'plan_achievement'
    and target_month between v_start and v_end;

  return jsonb_build_object(
    'equipment_check_count', v_check_count,
    'improvement_count',     v_improvement_count,
    'issues_found',          v_issues_open,
    'schedule_adherence',    round(coalesce(v_schedule, 0)::numeric, 1),
    'notes',                 ''
  );
end;
$$;


-- ─────────────────────────────────────────────────────────────
-- 7. 부서별 집계 RPC — 보전 (Maintenance)
--    데이터 소스: bm_events, pm_work_logs, pm_schedules
-- ─────────────────────────────────────────────────────────────
create or replace function get_weekly_maintenance_data(p_year int, p_week int)
returns jsonb
language plpgsql security definer as $$
declare
  v_start date := iso_week_start(p_year, p_week);
  v_end   date := iso_week_end  (p_year, p_week);
  v_bm_incidents  int;
  v_bm_completed  int;
  v_pm_planned    int;
  v_pm_completed  int;
  v_mttr_min      numeric;
  v_mtbf_min      numeric;
  v_downtime_min  numeric;
  v_pm_achievement numeric;
begin
  -- BM 발생 건수
  select count(*) into v_bm_incidents
  from bm_events
  where reported_at::date between v_start and v_end
    and status <> 'cancelled';

  -- BM 해결 건수
  select count(*) into v_bm_completed
  from bm_events
  where status = 'resolved'
    and coalesce(downtime_end, updated_at)::date between v_start and v_end;

  -- PM 계획 건수 (pm_schedules에 scheduled_date 가 있다고 가정,
  -- 없으면 0 반환 — 안전한 PERFORM 패턴 사용)
  begin
    execute $sql$
      select count(*) from pm_schedules
       where scheduled_date::date between $1 and $2
    $sql$ using v_start, v_end into v_pm_planned;
  exception when undefined_column or undefined_table then
    v_pm_planned := 0;
  end;

  -- PM 완료 건수: pm_work_logs.ended_at 기준 result='ok'
  begin
    execute $sql$
      select count(*) from pm_work_logs
       where result = 'ok'
         and ended_at::date between $1 and $2
    $sql$ using v_start, v_end into v_pm_completed;
  exception when undefined_column or undefined_table then
    v_pm_completed := 0;
  end;

  v_pm_achievement := case
    when v_pm_planned > 0 then round((v_pm_completed::numeric / v_pm_planned * 100)::numeric, 1)
    else null
  end;

  -- MTTR/MTBF: bm_kpi 뷰 (월 단위 집계) — 해당 주가 포함된 월 데이터로 근사
  begin
    select
      avg(mttr_min),
      avg(mtbf_min),
      sum(total_downtime_min)
    into v_mttr_min, v_mtbf_min, v_downtime_min
    from bm_kpi
    where month >= date_trunc('month', v_start)::timestamptz
      and month <  (date_trunc('month', v_end) + interval '1 month')::timestamptz;
  exception when undefined_table then
    v_mttr_min := null; v_mtbf_min := null; v_downtime_min := null;
  end;

  return jsonb_build_object(
    'bm_incidents',          v_bm_incidents,
    'bm_completed',          v_bm_completed,
    'pm_planned',            v_pm_planned,
    'pm_completed',          v_pm_completed,
    'pm_achievement',        v_pm_achievement,
    'mttr_hours',            round(coalesce(v_mttr_min, 0)::numeric / 60.0, 2),
    'mtbf_hours',            round(coalesce(v_mtbf_min, 0)::numeric / 60.0, 1),
    'total_downtime_hours',  round(coalesce(v_downtime_min, 0)::numeric / 60.0, 2),
    'notes',                 ''
  );
end;
$$;


-- ─────────────────────────────────────────────────────────────
-- 8. 부서별 집계 RPC — 생산관리 (Management)
--    데이터 소스: kpi_actuals (plan_achievement, accident_count, defect_ppm)
--                management_reports.production jsonb (cost_savings)
-- ─────────────────────────────────────────────────────────────
create or replace function get_weekly_management_data(p_year int, p_week int)
returns jsonb
language plpgsql security definer as $$
declare
  v_start date := iso_week_start(p_year, p_week);
  v_end   date := iso_week_end  (p_year, p_week);
  v_cost_savings numeric := 0;
  v_schedule     numeric;
  v_accidents    numeric := 0;
  v_defects      numeric;
begin
  -- 비용 절감액: management_reports.production->>'cost_savings' 합계 (월÷4 근사)
  begin
    execute $sql$
      select coalesce(sum(((production->>'cost_savings')::numeric)) / 4.0, 0)
        from management_reports
       where created_at::date between $1 and $2
    $sql$ using v_start - 31, v_end into v_cost_savings;
  exception when undefined_table or undefined_column then
    v_cost_savings := 0;
  end;

  -- 일정 준수율
  select avg(actual_value) into v_schedule
  from kpi_actuals
  where category_id = 'plan_achievement'
    and target_month between v_start and v_end;

  -- 안전 사고
  select coalesce(sum(actual_value), 0) into v_accidents
  from kpi_actuals
  where category_id = 'accident_count'
    and target_month between v_start and v_end;

  -- 품질 불량 PPM 평균
  select avg(actual_value) into v_defects
  from kpi_actuals
  where category_id = 'defect_ppm'
    and target_month between v_start and v_end;

  return jsonb_build_object(
    'cost_savings',         round(coalesce(v_cost_savings, 0)::numeric, 0),
    'schedule_achievement', round(coalesce(v_schedule, 0)::numeric, 1),
    'safety_incidents',     v_accidents::int,
    'quality_defects',      round(coalesce(v_defects, 0)::numeric, 0),
    'notes',                ''
  );
end;
$$;


-- ─────────────────────────────────────────────────────────────
-- 9. 통합 자동 생성 RPC — generate_weekly_report_auto
--    하나의 호출로 4개 부서 집계 → weekly_reports 에 upsert
-- ─────────────────────────────────────────────────────────────
create or replace function generate_weekly_report_auto(
  p_year      int default null,
  p_week      int default null,
  p_force     boolean default false,
  p_triggered_by text default 'manual'
)
returns weekly_reports
language plpgsql security definer as $$
declare
  v_year   int  := coalesce(p_year, extract(isoyear from current_date)::int);
  v_week   int  := coalesce(p_week, extract(week    from current_date)::int);
  v_start  date := iso_week_start(v_year, v_week);
  v_end    date := iso_week_end  (v_year, v_week);
  v_prod   jsonb;
  v_tech   jsonb;
  v_maint  jsonb;
  v_mgmt   jsonb;
  v_existing weekly_reports%rowtype;
  v_result   weekly_reports%rowtype;
  v_t_start  timestamptz := clock_timestamp();
begin
  -- 기존 보고서 확인
  select * into v_existing
  from weekly_reports where year = v_year and week = v_week;

  if found and not p_force then
    -- 이미 존재하면 그대로 반환 (강제 재생성 아닌 경우)
    insert into weekly_auto_logs(target_year, target_week, status, rows_processed,
                                 duration_ms, triggered_by, error_msg)
    values (v_year, v_week, 'skipped', 0,
            extract(milliseconds from clock_timestamp() - v_t_start)::int,
            p_triggered_by, 'already exists');
    return v_existing;
  end if;

  -- 4개 부서 집계
  v_prod  := get_weekly_production_data (v_year, v_week);
  v_tech  := get_weekly_technology_data (v_year, v_week);
  v_maint := get_weekly_maintenance_data(v_year, v_week);
  v_mgmt  := get_weekly_management_data (v_year, v_week);

  -- upsert
  insert into weekly_reports (
    year, week, week_start_date, week_end_date,
    production, technology, maintenance, management,
    status, generated_by, generated_at
  ) values (
    v_year, v_week, v_start, v_end,
    v_prod, v_tech, v_maint, v_mgmt,
    'generated', 'system', now()
  )
  on conflict (year, week) do update set
    week_start_date = excluded.week_start_date,
    week_end_date   = excluded.week_end_date,
    production      = excluded.production,
    technology      = excluded.technology,
    maintenance     = excluded.maintenance,
    management      = excluded.management,
    status          = 'generated',
    generated_at    = now(),
    updated_at      = now()
  returning * into v_result;

  insert into weekly_auto_logs(target_year, target_week, status, rows_processed,
                               duration_ms, triggered_by)
  values (v_year, v_week, 'success', 1,
          extract(milliseconds from clock_timestamp() - v_t_start)::int,
          p_triggered_by);

  return v_result;
exception when others then
  insert into weekly_auto_logs(target_year, target_week, status, error_msg,
                               duration_ms, triggered_by)
  values (v_year, v_week, 'failed', sqlerrm,
          extract(milliseconds from clock_timestamp() - v_t_start)::int,
          p_triggered_by);
  raise;
end;
$$;

comment on function generate_weekly_report_auto(int,int,boolean,text) is
  '주간 보고서 자동 생성 — 4개 부서 RPC 호출 후 weekly_reports에 upsert';


-- ─────────────────────────────────────────────────────────────
-- 10. 조회용 뷰 — weekly_reports_summary
-- ─────────────────────────────────────────────────────────────
create or replace view weekly_reports_summary as
select
  wr.id,
  wr.year,
  wr.week,
  wr.week_start_date,
  wr.week_end_date,
  wr.status,
  wr.generated_at,
  wr.reviewed_at,
  wr.approved_at,
  (wr.production  ->> 'achievement_rate')   ::numeric as production_achievement,
  (wr.technology  ->> 'schedule_adherence') ::numeric as tech_schedule,
  (wr.maintenance ->> 'pm_achievement')     ::numeric as maintenance_achievement,
  (wr.management  ->> 'schedule_achievement')::numeric as mgmt_schedule,
  (select count(*) from weekly_comments wc where wc.report_id = wr.id) as total_comments
from weekly_reports wr;

comment on view weekly_reports_summary is '주간 보고서 목록용 요약 뷰';


-- ─────────────────────────────────────────────────────────────
-- 11. RLS 정책
--     - anon: 읽기 가능 (대시보드 표시용)
--     - authenticated: insert/update 가능
--     - admin (raw_user_meta_data->>'role' = 'admin'): 전체 권한
--     - dept 매핑: auth.users.raw_user_meta_data->>'dept' 가
--                  weekly_comments.dept_name 과 일치하면 작성 가능
-- ─────────────────────────────────────────────────────────────

alter table weekly_reports     enable row level security;
alter table weekly_comments    enable row level security;
alter table weekly_auto_logs   enable row level security;

-- weekly_reports ---------------------------------------------------------
drop policy if exists weekly_reports_select on weekly_reports;
create policy weekly_reports_select on weekly_reports
  for select using (true);

drop policy if exists weekly_reports_insert on weekly_reports;
create policy weekly_reports_insert on weekly_reports
  for insert to authenticated with check (true);

drop policy if exists weekly_reports_update on weekly_reports;
create policy weekly_reports_update on weekly_reports
  for update to authenticated using (
    -- 부서장(reviewed_by 자기 자신 가능) 또는 admin
    coalesce(auth.jwt() -> 'user_metadata' ->> 'role',
             auth.jwt() -> 'app_metadata'  ->> 'role') = 'admin'
    or status in ('generated','reviewed')
  );

drop policy if exists weekly_reports_delete on weekly_reports;
create policy weekly_reports_delete on weekly_reports
  for delete to authenticated using (
    coalesce(auth.jwt() -> 'user_metadata' ->> 'role',
             auth.jwt() -> 'app_metadata'  ->> 'role') = 'admin'
  );

-- weekly_comments --------------------------------------------------------
drop policy if exists weekly_comments_select on weekly_comments;
create policy weekly_comments_select on weekly_comments
  for select using (true);

drop policy if exists weekly_comments_insert on weekly_comments;
create policy weekly_comments_insert on weekly_comments
  for insert to authenticated with check (
    -- admin 은 무조건, 일반 사용자는 자신의 부서에만
    coalesce(auth.jwt() -> 'user_metadata' ->> 'role',
             auth.jwt() -> 'app_metadata'  ->> 'role') = 'admin'
    or coalesce(auth.jwt() -> 'user_metadata' ->> 'dept',
                auth.jwt() -> 'app_metadata'  ->> 'dept') = dept_name
    or coalesce(auth.jwt() -> 'user_metadata' ->> 'dept',
                auth.jwt() -> 'app_metadata'  ->> 'dept') is null  -- dept 미설정 사용자는 모든 부서 허용 (초기 단계)
  );

drop policy if exists weekly_comments_update on weekly_comments;
create policy weekly_comments_update on weekly_comments
  for update to authenticated using (
    author_id = auth.uid()
    or coalesce(auth.jwt() -> 'user_metadata' ->> 'role',
                auth.jwt() -> 'app_metadata'  ->> 'role') = 'admin'
  );

drop policy if exists weekly_comments_delete on weekly_comments;
create policy weekly_comments_delete on weekly_comments
  for delete to authenticated using (
    author_id = auth.uid()
    or coalesce(auth.jwt() -> 'user_metadata' ->> 'role',
                auth.jwt() -> 'app_metadata'  ->> 'role') = 'admin'
  );

-- weekly_auto_logs (read-only for users, service role inserts) -----------
drop policy if exists weekly_auto_logs_select on weekly_auto_logs;
create policy weekly_auto_logs_select on weekly_auto_logs
  for select using (true);

-- INSERT 은 SECURITY DEFINER RPC 와 service_role 만 (별도 policy 없음)


-- ─────────────────────────────────────────────────────────────
-- 12. 권한 (RPC 호출 권한)
-- ─────────────────────────────────────────────────────────────
grant execute on function iso_week_start(int,int)              to anon, authenticated;
grant execute on function iso_week_end(int,int)                to anon, authenticated;
grant execute on function get_weekly_production_data(int,int)  to authenticated;
grant execute on function get_weekly_technology_data(int,int)  to authenticated;
grant execute on function get_weekly_maintenance_data(int,int) to authenticated;
grant execute on function get_weekly_management_data(int,int)  to authenticated;
grant execute on function generate_weekly_report_auto(int,int,boolean,text)
                                                               to authenticated;

-- ============================================================
-- END OF 25_weekly_reports.sql
-- 다음 단계: Supabase SQL Editor에서 본 파일을 실행
--           이후 Week 2 — API 엔드포인트 (8개) 구현 진행
-- ============================================================
