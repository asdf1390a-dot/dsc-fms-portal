-- ============================================================
-- DSC FMS Portal — Weekly Report Templates + Entries Module
-- 파일: 27_weekly_report_templates_entries.sql
-- 작성: 2026-05-15
-- 전제: 25_weekly_reports.sql, 26_weekly_reports_email.sql 실행 완료
-- 설계서: WEEKLY_REPORT_AUTO_GENERATION_DESIGN.md
-- ------------------------------------------------------------
-- Week 2 분량: 부서별 템플릿 + 주간 수동 입력 엔트리 레이어.
-- 자동 생성된 weekly_reports 위에 사용자가 직접 입력/보완할 수
-- 있는 manual entry 레이어를 추가하고, submit 시점에 weekly_reports
-- 로 머지한다.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. weekly_report_templates — 부서별 입력 양식 정의
-- ─────────────────────────────────────────────────────────────
create table if not exists weekly_report_templates (
  id                uuid primary key default gen_random_uuid(),
  dept_name         text not null
    check (dept_name in ('production','technology','maintenance','management')),
  version           int  not null default 1,
  name              text not null,
  description       text,

  -- fields: 입력 항목 메타데이터 배열
  --   [{ key, label_ko, label_en, type, required, unit, source, default }, ...]
  --   type:   'number' | 'percent' | 'text' | 'longtext' | 'date'
  --   source: 'manual' | 'auto:<rpc_key>'  (auto-generate 시 자동 채움)
  fields            jsonb not null default '[]'::jsonb,

  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  unique (dept_name, version)
);

create index if not exists weekly_report_templates_dept_idx
  on weekly_report_templates(dept_name) where is_active;
create index if not exists weekly_report_templates_active_idx
  on weekly_report_templates(is_active);

comment on table weekly_report_templates is
  '주간 보고서 부서별 입력 양식 정의 — 어떤 KPI 필드를 입력받을지 메타데이터 보관';


-- ─────────────────────────────────────────────────────────────
-- 2. weekly_report_entries — 주간 부서별 입력 엔트리
-- ─────────────────────────────────────────────────────────────
-- weekly_reports 가 자동 집계 결과의 단일 행이라면,
-- weekly_report_entries 는 (year, week, dept_name) 단위의 draft 입력이다.
-- submit 시점에 weekly_reports 로 머지된다.
create table if not exists weekly_report_entries (
  id                uuid primary key default gen_random_uuid(),
  year              int  not null,
  week              int  not null check (week between 1 and 53),
  dept_name         text not null
    check (dept_name in ('production','technology','maintenance','management')),
  template_id       uuid references weekly_report_templates(id) on delete set null,

  -- 부서별 입력 데이터 (template.fields 키와 1:1 매핑)
  data              jsonb not null default '{}'::jsonb,

  -- 자동 채움 / 수동 입력 출처 표시
  source            text not null default 'manual'
    check (source in ('manual','auto','mixed')),

  status            text not null default 'draft'
    check (status in ('draft','submitted','merged','rejected')),

  submitted_by      uuid references auth.users(id) on delete set null,
  submitted_at      timestamptz,
  merged_into       uuid references weekly_reports(id) on delete set null,
  merged_at         timestamptz,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  unique (year, week, dept_name)
);

create index if not exists weekly_report_entries_year_week_idx
  on weekly_report_entries(year desc, week desc);
create index if not exists weekly_report_entries_dept_idx
  on weekly_report_entries(dept_name);
create index if not exists weekly_report_entries_status_idx
  on weekly_report_entries(status);

comment on table weekly_report_entries is
  '주간 보고서 부서별 입력 엔트리 — draft → submitted → merged 워크플로우';


-- ─────────────────────────────────────────────────────────────
-- 3. updated_at 트리거
-- ─────────────────────────────────────────────────────────────
create or replace function weekly_template_touch_updated()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_weekly_report_templates_updated on weekly_report_templates;
create trigger trg_weekly_report_templates_updated
  before update on weekly_report_templates
  for each row execute function weekly_template_touch_updated();

drop trigger if exists trg_weekly_report_entries_updated on weekly_report_entries;
create trigger trg_weekly_report_entries_updated
  before update on weekly_report_entries
  for each row execute function weekly_template_touch_updated();


-- ─────────────────────────────────────────────────────────────
-- 4. 기본 템플릿 시드 (production / technology / maintenance / management)
--    auto:* source 는 generate_weekly_report_auto() 결과 JSON 키와 매핑.
-- ─────────────────────────────────────────────────────────────
insert into weekly_report_templates (dept_name, version, name, description, fields, is_active)
values
  ('production', 1, '생산부 주간보고 v1',
   '생산실적, 달성률, OEE, 일별 생산량',
   '[
     {"key":"plan","label_ko":"생산계획","label_en":"Plan","type":"number","required":true,"unit":"ea","source":"auto:production.plan"},
     {"key":"actual","label_ko":"생산실적","label_en":"Actual","type":"number","required":true,"unit":"ea","source":"auto:production.actual"},
     {"key":"achievement_rate","label_ko":"달성률","label_en":"Achievement","type":"percent","required":true,"unit":"%","source":"auto:production.achievement_rate"},
     {"key":"oee","label_ko":"OEE","label_en":"OEE","type":"percent","required":false,"unit":"%","source":"auto:production.oee"},
     {"key":"notes","label_ko":"특이사항","label_en":"Notes","type":"longtext","required":false,"source":"manual"}
   ]'::jsonb,
   true),

  ('technology', 1, '기술부 주간보고 v1',
   '설비점검, 개선건, 이슈, 일정준수',
   '[
     {"key":"equipment_check_count","label_ko":"설비점검 건수","label_en":"Equipment Checks","type":"number","required":true,"unit":"건","source":"auto:technology.equipment_check_count"},
     {"key":"improvement_count","label_ko":"개선 건수","label_en":"Improvements","type":"number","required":true,"unit":"건","source":"auto:technology.improvement_count"},
     {"key":"issues_found","label_ko":"발견 이슈","label_en":"Issues Found","type":"number","required":false,"unit":"건","source":"auto:technology.issues_found"},
     {"key":"schedule_adherence","label_ko":"일정 준수율","label_en":"Schedule Adherence","type":"percent","required":false,"unit":"%","source":"auto:technology.schedule_adherence"},
     {"key":"notes","label_ko":"특이사항","label_en":"Notes","type":"longtext","required":false,"source":"manual"}
   ]'::jsonb,
   true),

  ('maintenance', 1, '보전부 주간보고 v1',
   'BM 발생/완료, PM 계획/완료/달성률, MTTR/MTBF',
   '[
     {"key":"bm_incidents","label_ko":"BM 발생","label_en":"BM Incidents","type":"number","required":true,"unit":"건","source":"auto:maintenance.bm_incidents"},
     {"key":"bm_completed","label_ko":"BM 완료","label_en":"BM Completed","type":"number","required":true,"unit":"건","source":"auto:maintenance.bm_completed"},
     {"key":"pm_planned","label_ko":"PM 계획","label_en":"PM Planned","type":"number","required":true,"unit":"건","source":"auto:maintenance.pm_planned"},
     {"key":"pm_completed","label_ko":"PM 완료","label_en":"PM Completed","type":"number","required":true,"unit":"건","source":"auto:maintenance.pm_completed"},
     {"key":"pm_achievement","label_ko":"PM 달성률","label_en":"PM Achievement","type":"percent","required":true,"unit":"%","source":"auto:maintenance.pm_achievement"},
     {"key":"mttr_hours","label_ko":"MTTR","label_en":"MTTR","type":"number","required":false,"unit":"h","source":"auto:maintenance.mttr_hours"},
     {"key":"mtbf_hours","label_ko":"MTBF","label_en":"MTBF","type":"number","required":false,"unit":"h","source":"auto:maintenance.mtbf_hours"},
     {"key":"total_downtime_hours","label_ko":"총 다운타임","label_en":"Total Downtime","type":"number","required":false,"unit":"h","source":"auto:maintenance.total_downtime_hours"},
     {"key":"notes","label_ko":"특이사항","label_en":"Notes","type":"longtext","required":false,"source":"manual"}
   ]'::jsonb,
   true),

  ('management', 1, '생산관리부 주간보고 v1',
   '비용절감, 일정달성, 안전, 품질',
   '[
     {"key":"cost_savings","label_ko":"비용절감","label_en":"Cost Savings","type":"number","required":true,"unit":"INR","source":"auto:management.cost_savings"},
     {"key":"schedule_achievement","label_ko":"일정달성률","label_en":"Schedule Achievement","type":"percent","required":true,"unit":"%","source":"auto:management.schedule_achievement"},
     {"key":"safety_incidents","label_ko":"안전사고","label_en":"Safety Incidents","type":"number","required":true,"unit":"건","source":"auto:management.safety_incidents"},
     {"key":"quality_defects","label_ko":"품질불량","label_en":"Quality Defects","type":"number","required":false,"unit":"건","source":"auto:management.quality_defects"},
     {"key":"notes","label_ko":"특이사항","label_en":"Notes","type":"longtext","required":false,"source":"manual"}
   ]'::jsonb,
   true)
on conflict (dept_name, version) do nothing;


-- ─────────────────────────────────────────────────────────────
-- 5. RPC: upsert_weekly_entry(year, week, dept_name, data, source, template_id)
--    Draft 입력 저장 (POST /api/weekly-reports/entries)
-- ─────────────────────────────────────────────────────────────
create or replace function upsert_weekly_entry(
  p_year int,
  p_week int,
  p_dept_name text,
  p_data jsonb,
  p_source text default 'manual',
  p_template_id uuid default null
)
returns weekly_report_entries language plpgsql security definer
set search_path = public as $$
declare
  v_entry weekly_report_entries;
  v_template_id uuid;
begin
  if p_dept_name not in ('production','technology','maintenance','management') then
    raise exception 'invalid dept_name: %', p_dept_name;
  end if;
  if p_week < 1 or p_week > 53 then
    raise exception 'invalid week: %', p_week;
  end if;

  -- Resolve template_id: prefer passed in, else current active template for dept
  if p_template_id is null then
    select id into v_template_id
    from weekly_report_templates
    where dept_name = p_dept_name and is_active
    order by version desc limit 1;
  else
    v_template_id := p_template_id;
  end if;

  insert into weekly_report_entries (
    year, week, dept_name, template_id, data, source, status
  ) values (
    p_year, p_week, p_dept_name, v_template_id, p_data, p_source, 'draft'
  )
  on conflict (year, week, dept_name) do update
    set data = excluded.data,
        template_id = coalesce(excluded.template_id, weekly_report_entries.template_id),
        source = case
          when weekly_report_entries.source = excluded.source then excluded.source
          else 'mixed'
        end,
        status = case
          when weekly_report_entries.status = 'merged' then weekly_report_entries.status
          else 'draft'
        end,
        updated_at = now()
  returning * into v_entry;

  return v_entry;
end;
$$;

comment on function upsert_weekly_entry(int,int,text,jsonb,text,uuid) is
  '주간 부서별 엔트리 upsert. merged 상태는 보호.';


-- ─────────────────────────────────────────────────────────────
-- 6. RPC: seed_entries_from_auto(year, week)
--    auto-generate 시 weekly_reports 의 부서별 JSON 을 entries 로
--    분해해서 draft 로 채워준다.
-- ─────────────────────────────────────────────────────────────
create or replace function seed_entries_from_auto(
  p_year int,
  p_week int
)
returns int language plpgsql security definer
set search_path = public as $$
declare
  v_report  weekly_reports;
  v_dept    text;
  v_data    jsonb;
  v_count   int := 0;
begin
  select * into v_report
  from weekly_reports
  where year = p_year and week = p_week;

  if v_report.id is null then
    raise exception 'weekly_report not found for %-W%', p_year, p_week;
  end if;

  for v_dept in select unnest(array['production','technology','maintenance','management'])
  loop
    v_data := case v_dept
      when 'production'  then v_report.production
      when 'technology'  then v_report.technology
      when 'maintenance' then v_report.maintenance
      when 'management'  then v_report.management
    end;

    perform upsert_weekly_entry(p_year, p_week, v_dept, coalesce(v_data, '{}'::jsonb), 'auto', null);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

comment on function seed_entries_from_auto(int,int) is
  '자동 생성된 weekly_reports 데이터를 부서별 entries draft 로 분해 저장.';


-- ─────────────────────────────────────────────────────────────
-- 7. RPC: submit_weekly_entries(year, week, user_id)
--    제출 시점에 entries → weekly_reports 로 머지.
-- ─────────────────────────────────────────────────────────────
create or replace function submit_weekly_entries(
  p_year int,
  p_week int,
  p_user_id uuid default null
)
returns weekly_reports language plpgsql security definer
set search_path = public as $$
declare
  v_report weekly_reports;
  v_entry  weekly_report_entries;
  v_prod   jsonb := '{}'::jsonb;
  v_tech   jsonb := '{}'::jsonb;
  v_maint  jsonb := '{}'::jsonb;
  v_mgmt   jsonb := '{}'::jsonb;
  v_total  int := 0;
begin
  -- Collect dept data from entries
  for v_entry in
    select * from weekly_report_entries
    where year = p_year and week = p_week
  loop
    if v_entry.dept_name = 'production'  then v_prod  := v_entry.data; end if;
    if v_entry.dept_name = 'technology'  then v_tech  := v_entry.data; end if;
    if v_entry.dept_name = 'maintenance' then v_maint := v_entry.data; end if;
    if v_entry.dept_name = 'management'  then v_mgmt  := v_entry.data; end if;
    v_total := v_total + 1;
  end loop;

  if v_total = 0 then
    raise exception 'no entries found for %-W% — call /entries or /auto-generate first', p_year, p_week;
  end if;

  -- Upsert weekly_reports row
  insert into weekly_reports (
    year, week, week_start_date, week_end_date,
    production, technology, maintenance, management,
    status, generated_by
  ) values (
    p_year, p_week,
    iso_week_start(p_year, p_week),
    iso_week_end(p_year, p_week),
    v_prod, v_tech, v_maint, v_mgmt,
    'reviewed',
    coalesce(p_user_id::text, 'system')
  )
  on conflict (year, week) do update
    set production  = excluded.production,
        technology  = excluded.technology,
        maintenance = excluded.maintenance,
        management  = excluded.management,
        status      = 'reviewed',
        reviewed_by = p_user_id,
        reviewed_at = now(),
        updated_at  = now()
  returning * into v_report;

  -- Mark entries as merged
  update weekly_report_entries
  set status      = 'merged',
      submitted_by = p_user_id,
      submitted_at = now(),
      merged_into  = v_report.id,
      merged_at    = now()
  where year = p_year and week = p_week;

  return v_report;
end;
$$;

comment on function submit_weekly_entries(int,int,uuid) is
  '주간 부서별 entries 를 weekly_reports 로 머지하고 reviewed 상태로 전환.';


-- ─────────────────────────────────────────────────────────────
-- 8. 뷰: weekly_entries_view — 템플릿 정보와 조인된 history 조회용
-- ─────────────────────────────────────────────────────────────
create or replace view weekly_entries_view as
select
  e.id,
  e.year,
  e.week,
  e.dept_name,
  e.data,
  e.source,
  e.status,
  e.submitted_by,
  e.submitted_at,
  e.merged_into,
  e.merged_at,
  e.created_at,
  e.updated_at,
  t.id   as template_id,
  t.name as template_name,
  t.version as template_version,
  iso_week_start(e.year, e.week) as week_start_date,
  iso_week_end(e.year, e.week)   as week_end_date
from weekly_report_entries e
left join weekly_report_templates t on t.id = e.template_id;

comment on view weekly_entries_view is
  '주간 엔트리 + 템플릿 + ISO 주 날짜 결합 뷰 (history 조회용)';


-- ─────────────────────────────────────────────────────────────
-- 9. RLS 정책
-- ─────────────────────────────────────────────────────────────
alter table weekly_report_templates enable row level security;
alter table weekly_report_entries   enable row level security;

-- Templates: 누구나 읽기, admin 만 쓰기
drop policy if exists "weekly_templates_select" on weekly_report_templates;
create policy "weekly_templates_select"
  on weekly_report_templates for select
  using (true);

drop policy if exists "weekly_templates_admin_write" on weekly_report_templates;
create policy "weekly_templates_admin_write"
  on weekly_report_templates for all
  using (auth.jwt() ->> 'role' = 'admin')
  with check (auth.jwt() ->> 'role' = 'admin');

-- Entries: 누구나 읽기, 인증 사용자는 쓰기
drop policy if exists "weekly_entries_select" on weekly_report_entries;
create policy "weekly_entries_select"
  on weekly_report_entries for select
  using (true);

drop policy if exists "weekly_entries_authenticated_write" on weekly_report_entries;
create policy "weekly_entries_authenticated_write"
  on weekly_report_entries for all
  using (auth.role() = 'authenticated' or auth.jwt() ->> 'role' = 'admin')
  with check (auth.role() = 'authenticated' or auth.jwt() ->> 'role' = 'admin');

-- ============================================================
-- END
-- ============================================================
