-- DSC FMS Portal — BM Module v2 (SAP PM Alignment)
-- 적용: Supabase Dashboard → SQL Editor → 붙여넣기 → Run
-- 작성: 2026-05-11

-- ─────────────────────────────────────────────────────────
-- 1. technicians 테이블 (SAP: Work Center)
-- ─────────────────────────────────────────────────────────
create table if not exists technicians (
  id              uuid primary key default gen_random_uuid(),
  employee_id     text unique,                    -- 사번
  name            text not null,                  -- 영문명
  name_ta         text,                           -- 타밀어명 (현장 표시용)
  team            text not null default 'general'
                    check (team in ('mechanical','electrical','general')),
  skills          text[] default '{}',            -- ['welding','pneumatics', ...]
  contact         text,                           -- 전화번호
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

comment on table technicians is 'SAP Work Center — 보전 담당자 마스터';

-- ─────────────────────────────────────────────────────────
-- 2. cause_codes 테이블 (SAP: Cause code group / code)
--    현장에서 드롭다운으로 선택
-- ─────────────────────────────────────────────────────────
create table if not exists cause_codes (
  code        text primary key,          -- 'MECH', 'ELEC', 'OPER', ...
  name_en     text not null,
  name_ta     text,
  group_name  text                       -- 'Mechanical', 'Electrical', ...
);

insert into cause_codes (code, name_en, name_ta, group_name) values
  ('MECH-WEAR',  'Mechanical wear',         'இயந்திர தேய்மானம்',  'Mechanical'),
  ('MECH-BREAK', 'Mechanical breakage',     'இயந்திர உடைவு',      'Mechanical'),
  ('ELEC-SHORT', 'Electrical short circuit','மின் குறுச்சுற்று',   'Electrical'),
  ('ELEC-BURN',  'Motor/coil burned',       'மோட்டார் எரிந்தது',  'Electrical'),
  ('ELEC-SENSOR','Sensor failure',          'சென்சார் கோளாறு',    'Electrical'),
  ('PNEU-LEAK',  'Pneumatic leak',          'காற்று கசிவு',        'Pneumatic'),
  ('PNEU-VALVE', 'Valve failure',           'வால்வு கோளாறு',       'Pneumatic'),
  ('OPER-WRONG', 'Operator error',          'இயக்குபவர் பிழை',    'Operation'),
  ('OPER-SETUP', 'Setup/adjustment issue',  'அமைவு சரிசெய்தல்',   'Operation'),
  ('MOLD-CRACK', 'Mould crack/damage',      'அச்சு சேதம்',        'Mould'),
  ('MOLD-ALIGN', 'Mould misalignment',      'அச்சு சீரமைப்பு',    'Mould'),
  ('UTIL-POWER', 'Power supply issue',      'மின்சார இடைஞ்சல்',   'Utility'),
  ('UTIL-AIR',   'Compressed air supply',   'சுருக்கப்பட்ட காற்று','Utility'),
  ('UNKN',       'Unknown / under investigation', 'தெரியவில்லை',  'Unknown')
on conflict (code) do nothing;

-- ─────────────────────────────────────────────────────────
-- 3. bm_events 확장 (SAP PM: Notification → Order 통합)
-- ─────────────────────────────────────────────────────────

-- 3-a. 신규 컬럼 추가
alter table bm_events
  add column if not exists priority        text not null default 'medium'
    check (priority in ('low','medium','high','critical')),
  add column if not exists cause_code      text references cause_codes(code),
  add column if not exists downtime_start  timestamptz,   -- 실제 기계 정지 시각
  add column if not exists downtime_end    timestamptz,   -- 실제 기계 재가동 시각
  add column if not exists work_hours      numeric(5,2),  -- 실투입 공수 (h)
  add column if not exists technician_id   uuid references technicians(id);

-- 3-b. status 체크 제약 재설정
-- (기존 제약이 있으면 drop 후 재생성)
alter table bm_events
  drop constraint if exists bm_events_status_check;
alter table bm_events
  add constraint bm_events_status_check
    check (status in ('open','in_progress','pending_parts','resolved','cancelled'));

-- 3-c. 인덱스
create index if not exists bm_events_asset_idx        on bm_events(asset_id);
create index if not exists bm_events_status_idx       on bm_events(status);
create index if not exists bm_events_reported_at_idx  on bm_events(reported_at desc);
create index if not exists bm_events_technician_idx   on bm_events(technician_id);
create index if not exists bm_events_cause_code_idx   on bm_events(cause_code);

-- ─────────────────────────────────────────────────────────
-- 4. 뷰: bm_kpi — MTTR / MTBF 자동 계산 (SAP PM 기준)
-- ─────────────────────────────────────────────────────────
create or replace view bm_kpi as
with resolved as (
  select
    asset_id,
    date_trunc('month', reported_at)                           as month,
    count(*)                                                    as breakdown_count,
    -- MTTR: 실제 downtime 기준 (없으면 reported→resolved 폴백)
    avg(
      extract(epoch from (
        coalesce(downtime_end, resolved_at) -
        coalesce(downtime_start, reported_at)
      )) / 60.0
    )                                                           as mttr_min,
    sum(
      extract(epoch from (
        coalesce(downtime_end, resolved_at) -
        coalesce(downtime_start, reported_at)
      )) / 60.0
    )                                                           as total_downtime_min,
    avg(work_hours)                                             as avg_work_hours
  from bm_events
  where status = 'resolved'
    and (downtime_end is not null or resolved_at is not null)
  group by asset_id, date_trunc('month', reported_at)
)
select
  r.asset_id,
  a.machine_asset_number,
  a.name_en,
  r.month,
  r.breakdown_count,
  round(r.mttr_min::numeric, 1)                                 as mttr_min,
  -- MTBF: (총가동시간 - 총정지시간) / 고장건수
  -- 총가동시간 = 해당 월 720h = 43200 min
  round(
    case when r.breakdown_count > 0
      then (43200.0 - r.total_downtime_min) / r.breakdown_count
      else null
    end::numeric, 1
  )                                                             as mtbf_min,
  round(r.total_downtime_min::numeric, 1)                       as total_downtime_min,
  round(r.avg_work_hours::numeric, 2)                           as avg_work_hours
from resolved r
join assets a on a.id = r.asset_id;

comment on view bm_kpi is 'SAP PM KPI: 설비별 월간 MTTR / MTBF 자동 집계';

-- ─────────────────────────────────────────────────────────
-- 5. RLS 정책
-- ─────────────────────────────────────────────────────────
alter table technicians  enable row level security;
alter table cause_codes  enable row level security;

-- technicians: 인증 사용자 전체 읽기, 보전팀+관리자만 쓰기
drop policy if exists "auth_read_technicians" on technicians;
create policy "auth_read_technicians" on technicians
  for select to authenticated using (true);

drop policy if exists "auth_write_technicians" on technicians;
create policy "auth_write_technicians" on technicians
  for all to authenticated using (true) with check (true);

-- cause_codes: 읽기 전용 (마스터 코드)
drop policy if exists "auth_read_cause_codes" on cause_codes;
create policy "auth_read_cause_codes" on cause_codes
  for select to authenticated using (true);

-- bm_events: 인증 사용자 전체 허용 (기존 정책 있으면 스킵)
drop policy if exists "auth_all_bm_events" on bm_events;
create policy "auth_all_bm_events" on bm_events
  for all to authenticated using (true) with check (true);

-- ─────────────────────────────────────────────────────────
-- 6. updated_at 트리거 (bm_events)
-- ─────────────────────────────────────────────────────────
drop trigger if exists bm_events_set_updated_at on bm_events;
create trigger bm_events_set_updated_at
  before update on bm_events
  for each row execute function set_updated_at();
