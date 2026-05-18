-- ════════════════════════════════════════════════════════════════════════════
-- JEEPNEY Career Portfolio — Database Schema
--
-- Tables: portfolio_kpi_timeline, portfolio_images
-- Existing: career_companies, career_projects, career_achievements (from 12_career_module.sql)
--
-- Usage: Run in Supabase SQL Editor
-- Status: This extends existing career_* tables with portfolio-specific aggregations
-- ════════════════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────────────────
-- 1. portfolio_kpi_timeline (새 테이블 — 성능 최적화용 집계)
-- ────────────────────────────────────────────────────────────────────────────
-- 목적: 연도별 KPI를 미리 집계하여 대시보드 차트 렌더링 성능 향상
-- 트리거 또는 매일 자정에 자동 업데이트 추천

create table if not exists public.portfolio_kpi_timeline (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  company_id      uuid not null references public.career_companies(id) on delete cascade,
  year            int not null,

  -- 절감액 (억원 단위)
  savings_labor   numeric default 0,              -- 노무비 절감
  savings_equipment numeric default 0,            -- 설비/수선비 절감
  savings_gas     numeric default 0,              -- 가스비 절감
  savings_total   numeric default 0,              -- 총 절감액

  -- 생산성 지표 (%)
  efficiency      numeric default 0,              -- 생산효율 (0~100)
  loss_time       numeric default 0,              -- LOSS 시간 (0~100)

  -- 비율 지표 (%)
  labor_ratio     numeric default 0,              -- 매출 대비 노무비 비율
  equipment_ratio numeric default 0,              -- 매출 대비 설비수선비 비율

  -- 조직 성과
  revenue_multiplier numeric default 1.0,        -- 매출 배수 (2019년 기준 = 1.0)
  headcount_efficiency numeric default 1.0,      -- 인원당 효율성 배수

  -- 추적
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),

  unique (user_id, company_id, year)
);

create index if not exists idx_portfolio_kpi_timeline_user_year
  on public.portfolio_kpi_timeline(user_id, year desc);
create index if not exists idx_portfolio_kpi_timeline_company_year
  on public.portfolio_kpi_timeline(company_id, year desc);

-- Updated_at trigger
drop trigger if exists trg_portfolio_kpi_timeline_updated_at on public.portfolio_kpi_timeline;
create trigger trg_portfolio_kpi_timeline_updated_at
  before update on public.portfolio_kpi_timeline
  for each row execute function public.career_set_updated_at();

-- ────────────────────────────────────────────────────────────────────────────
-- 2. portfolio_images (새 테이블 — 타임라인 이미지)
-- ────────────────────────────────────────────────────────────────────────────
-- 목적: 각 연도별 타임라인에 이미지 첨부 (선택 사항)

create table if not exists public.portfolio_images (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  company_id      uuid references public.career_companies(id) on delete cascade,
  year            int not null,

  -- 이미지 정보
  image_url       text not null,                  -- Supabase Storage 경로
  alt_text        text,                           -- 대체 텍스트
  title           text,                           -- 제목
  description     text,                           -- 설명
  display_order   int default 0,

  -- 추적
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists idx_portfolio_images_user_year
  on public.portfolio_images(user_id, year);
create index if not exists idx_portfolio_images_display_order
  on public.portfolio_images(display_order asc);

-- Updated_at trigger
drop trigger if exists trg_portfolio_images_updated_at on public.portfolio_images;
create trigger trg_portfolio_images_updated_at
  before update on public.portfolio_images
  for each row execute function public.career_set_updated_at();

-- ────────────────────────────────────────────────────────────────────────────
-- 3. RLS (Row Level Security)
-- ────────────────────────────────────────────────────────────────────────────

alter table public.portfolio_kpi_timeline enable row level security;
alter table public.portfolio_images enable row level security;

-- portfolio_kpi_timeline
drop policy if exists "portfolio_kpi_owner_all" on public.portfolio_kpi_timeline;
drop policy if exists "portfolio_kpi_public_read" on public.portfolio_kpi_timeline;

create policy "portfolio_kpi_owner_all" on public.portfolio_kpi_timeline
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 향후 확장: 공개 포트폴리오 옵션
-- create policy "portfolio_kpi_public_read" on public.portfolio_kpi_timeline
--   for select using (
--     exists (
--       select 1 from public.career_profiles
--       where user_id = portfolio_kpi_timeline.user_id
--       and is_public = true
--     )
--   );

-- portfolio_images
drop policy if exists "portfolio_images_owner_all" on public.portfolio_images;
drop policy if exists "portfolio_images_public_read" on public.portfolio_images;

create policy "portfolio_images_owner_all" on public.portfolio_images
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ════════════════════════════════════════════════════════════════════════════
-- SAMPLE DATA — 사용자의 6년 경력 데이터
-- ════════════════════════════════════════════════════════════════════════════

-- 참고: 아래는 SAMPLE 데이터입니다.
-- 실제 user_id, company_id는 환경에 맞게 조정하세요.
--
-- INSERT를 직접 실행하려면:
-- 1. auth.users의 실제 user_id 확인 (SELECT * FROM auth.users)
-- 2. career_companies의 DSC 회사 ID 확인 (SELECT * FROM career_companies WHERE name LIKE 'DSC%')
-- 3. 아래 쿼리의 UUID를 실제 값으로 변경
-- 4. 복사-붙여넣기 실행

-- ────────────────────────────────────────────────────────────────────────────
-- SAMPLE: portfolio_kpi_timeline 데이터 (6년 KPI)
-- ────────────────────────────────────────────────────────────────────────────

-- 주의: 다음 값들을 실제 데이터로 변경하세요:
-- {user_id}: 사용자의 실제 UUID
-- {company_id}: career_companies에서 DSC의 실제 ID

/*
INSERT INTO public.portfolio_kpi_timeline (
  user_id, company_id, year,
  savings_labor, savings_equipment, savings_gas, savings_total,
  efficiency, loss_time,
  labor_ratio, equipment_ratio,
  revenue_multiplier, headcount_efficiency
) VALUES
  -- 2019: 기준년 (시작점)
  ('{user_id}'::uuid, '{company_id}'::uuid, 2019,
   0, 0, 0, 0,
   66, 31.6,
   5.45, 1.07,
   1.0, 1.0),

  -- 2020: 초기 자동화 도입
  ('{user_id}'::uuid, '{company_id}'::uuid, 2020,
   100, 20, 0.3, 120.3,
   78, 18.2,
   4.23, 0.95,
   1.2, 1.3),

  -- 2021: 예방 보전 시스템 도입
  ('{user_id}'::uuid, '{company_id}'::uuid, 2021,
   150, 35, 0.5, 185.5,
   85, 12.5,
   3.89, 0.82,
   1.4, 1.6),

  -- 2022: 직원 교육 강화
  ('{user_id}'::uuid, '{company_id}'::uuid, 2022,
   180, 42, 0.8, 222.8,
   92, 5.8,
   3.12, 0.72,
   1.8, 2.0),

  -- 2023: 성과 인정 및 확대
  ('{user_id}'::uuid, '{company_id}'::uuid, 2023,
   200, 45, 1.0, 246.0,
   94, 3.2,
   2.95, 0.65,
   2.0, 2.1),

  -- 2024: 최종 성과
  ('{user_id}'::uuid, '{company_id}'::uuid, 2024,
   274, 50, 1.3, 325.3,
   96, 2.3,
   2.76, 0.58,
   2.2, 2.3);

*/

-- ────────────────────────────────────────────────────────────────────────────
-- SAMPLE: career_projects (5개 성과 프로젝트)
-- ────────────────────────────────────────────────────────────────────────────

-- 참고: 이미 career_projects 테이블이 존재합니다.
-- 아래 삽입하는 5개 프로젝트는 성과 대시보드의 메인 프로젝트입니다.

/*
INSERT INTO public.career_projects (
  user_id, company_id, title, summary, role,
  start_date, end_date, is_ongoing,
  category, tags,
  kpi_label, kpi_value,
  is_public, is_featured, sort_order
) VALUES
  -- 1. 원가 절감 리더십
  ('{user_id}'::uuid, '{company_id}'::uuid,
   '원가 절감 리더십',
   '6년간 325억원 절감 (노무비 274억 + 수선비 50억 + 가스비 1.3억)',
   'Leader, Cost Reduction Initiative',
   '2019-01-01'::date, '2024-12-31'::date, false,
   'cost_reduction', ARRAY['cost','savings','optimization'],
   '절감액', '325억원', false, true, 1),

  -- 2. 생산성 혁신
  ('{user_id}'::uuid, '{company_id}'::uuid,
   '생산성 혁신',
   '생산효율 66% → 96% (+29.5%p), LOSS시간 31.6% → 2.3% (-29.3%p)',
   'Production Optimization Lead',
   '2019-01-01'::date, '2024-12-31'::date, false,
   'improvement', ARRAY['productivity','efficiency','automation'],
   '생산효율', '96%', false, true, 2),

  -- 3. 설비 보전 최적화
  ('{user_id}'::uuid, '{company_id}'::uuid,
   '설비 보전 최적화',
   '수선비 비율 1.07% → 0.58% (-0.49%p), 절감액 50억원',
   'Equipment Maintenance Manager',
   '2021-01-01'::date, '2024-12-31'::date, false,
   'quality', ARRAY['maintenance','cost','equipment'],
   '수선비 절감', '50억원', false, true, 3),

  -- 4. 공정 개선
  ('{user_id}'::uuid, '{company_id}'::uuid,
   '공정 개선 (가스 소모)',
   '가스 소모량 절감, 1.3억원 절감',
   'Process Optimization Engineer',
   '2020-01-01'::date, '2024-12-31'::date, false,
   'improvement', ARRAY['process','gas','efficiency'],
   '절감액', '1.3억원', false, true, 4),

  -- 5. 조직 성과
  ('{user_id}'::uuid, '{company_id}'::uuid,
   '조직 성과 (매출×2.2배)',
   '매출 2.2배 성장, 인원당 생산성 3배 증가',
   'Operations Director',
   '2019-01-01'::date, '2024-12-31'::date, false,
   'improvement', ARRAY['organization','growth','efficiency'],
   '매출 성장', '2.2배', false, true, 5);

*/

-- ────────────────────────────────────────────────────────────────────────────
-- SAMPLE: career_achievements (10개 세부 성과)
-- ────────────────────────────────────────────────────────────────────────────

-- 참고: career_achievements는 이미 존재하고, 5개 프로젝트 아래에 10개 세부 성과가 들어갑니다.

/*
INSERT INTO public.career_achievements (
  user_id, company_id, project_id,
  title, detail, achieved_at,
  achievement_type,
  metric_label, metric_before, metric_after,
  is_public, sort_order
) VALUES
  -- 프로젝트 1: 원가 절감
  ('{user_id}'::uuid, '{company_id}'::uuid, '{project_id_1}'::uuid,
   '노무비 절감',
   '자동화 도입으로 작업시간 30% 감축, 야근/특근 제로화',
   '2024-12-31'::date,
   'cost_reduction',
   '절감액', '0원', '274억원',
   true, 1),

  ('{user_id}'::uuid, '{company_id}'::uuid, '{project_id_1}'::uuid,
   '설비 수선비 절감',
   '예방 보전 시스템 도입으로 수선 비용 대폭 절감',
   '2024-12-31'::date,
   'cost_reduction',
   '절감액', '0원', '50억원',
   true, 2),

  ('{user_id}'::uuid, '{company_id}'::uuid, '{project_id_1}'::uuid,
   '가스 소모량 절감',
   '압축공기 누유 개선 및 공정 최적화',
   '2024-12-31'::date,
   'cost_reduction',
   '절감액', '0원', '1.3억원',
   true, 3),

  -- 프로젝트 2: 생산성 혁신
  ('{user_id}'::uuid, '{company_id}'::uuid, '{project_id_2}'::uuid,
   '생산효율 상승',
   '생산 라인 자동화 및 작업 표준화로 66% → 96% 상승',
   '2024-12-31'::date,
   'kpi_improvement',
   '생산효율', '66%', '96%',
   true, 4),

  ('{user_id}'::uuid, '{company_id}'::uuid, '{project_id_2}'::uuid,
   'LOSS 시간 감소',
   '장비 정비 주기 최적화로 31.6% → 2.3% 감소',
   '2024-12-31'::date,
   'kpi_improvement',
   'LOSS시간', '31.6%', '2.3%',
   true, 5),

  -- 프로젝트 3: 설비 보전 최적화
  ('{user_id}'::uuid, '{company_id}'::uuid, '{project_id_3}'::uuid,
   '수선비 비율 감소',
   '예방 보전 시스템 도입 및 IoT 센서 설치',
   '2024-12-31'::date,
   'kpi_improvement',
   '수선비 비율', '1.07%', '0.58%',
   true, 6),

  -- 프로젝트 4: 공정 개선
  ('{user_id}'::uuid, '{company_id}'::uuid, '{project_id_4}'::uuid,
   '압축공기 누유 개선',
   '공기 배관 검사 및 개선으로 누유율 50% 감소',
   '2024-12-31'::date,
   'process',
   '에너지 절감', '0원', '0.5억원',
   true, 7),

  ('{user_id}'::uuid, '{company_id}'::uuid, '{project_id_4}'::uuid,
   '용접 공정 최적화',
   '용접 파라미터 개선으로 비용 절감',
   '2024-12-31'::date,
   'process',
   '에너지 절감', '0원', '0.5억원',
   true, 8),

  -- 프로젝트 5: 조직 성과
  ('{user_id}'::uuid, '{company_id}'::uuid, '{project_id_5}'::uuid,
   '매출 성장',
   '6년간 비용 절감 + 신규고객 확보로 매출 2.2배 증가',
   '2024-12-31'::date,
   'kpi_improvement',
   '매출 배수', '1.0배', '2.2배',
   true, 9),

  ('{user_id}'::uuid, '{company_id}'::uuid, '{project_id_5}'::uuid,
   '인원 효율화',
   '같은 인원으로 생산량 3배 증가, 직원 만족도 향상',
   '2024-12-31'::date,
   'kpi_improvement',
   '인원당 생산성', '1.0배', '3.0배',
   true, 10);

*/

-- ════════════════════════════════════════════════════════════════════════════
-- 삽입 방법 (SAMPLE 실행하기)
-- ════════════════════════════════════════════════════════════════════════════
--
-- 1. SELECT 쿼리로 필요한 UUID 확인:
--
--    SELECT id FROM auth.users WHERE email = 'user@example.com';
--    → user_id를 얻음
--
--    SELECT id FROM career_companies
--    WHERE name LIKE 'DSC%' AND user_id = '{user_id}';
--    → company_id를 얻음
--
--    SELECT id FROM career_projects
--    WHERE user_id = '{user_id}' AND is_featured = true
--    ORDER BY sort_order;
--    → project_id들을 얻음 (project_id_1, project_id_2, ...)
--
-- 2. 위 쿼리의 주석 (/* */) 제거하고,
--    {user_id}, {company_id}, {project_id_1} 등을 실제 값으로 변경
--
-- 3. SQL 복사 → Supabase SQL Editor에 붙여넣기 → 실행
--
-- ════════════════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────────────────
-- 검증 쿼리 (실행 후 데이터 확인)
-- ────────────────────────────────────────────────────────────────────────────

-- 테이블 생성 확인
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public' AND table_name LIKE 'portfolio_%';

-- portfolio_kpi_timeline 데이터 확인
-- SELECT year, efficiency, loss_time, labor_ratio, savings_total
-- FROM public.portfolio_kpi_timeline
-- ORDER BY year ASC;

-- career_projects (5개 주요 프로젝트) 확인
-- SELECT id, title, kpi_label, kpi_value, is_featured, sort_order
-- FROM public.career_projects
-- WHERE is_featured = true
-- ORDER BY sort_order;

-- career_achievements 개수 확인
-- SELECT COUNT(*) as total_achievements
-- FROM public.career_achievements;

-- ════════════════════════════════════════════════════════════════════════════
-- 마무리
-- ════════════════════════════════════════════════════════════════════════════
-- 이 스키마는 PORTFOLIO_CAREER_DESIGN.md와 함께 사용됩니다.
-- 웹개발자는 이 테이블을 기반으로 API 쿼리를 작성하고,
-- React 컴포넌트에서 Recharts 차트로 시각화합니다.

