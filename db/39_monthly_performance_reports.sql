-- 39_monthly_performance_reports.sql
-- 월간 경영실적 보고 (CEO 전용)
-- 작성: 2026-06-09
-- 요구사항:
--  - 월 1회 자동 생성 (매월 1일 05:00 KST)
--  - CEO만 조회 가능 (role='ceo' 또는 'admin')
--  - 고정 포맷 (KPI JSONB로 향후 항목 추가/삭제 가능)
--  - 실적추이분석(인사이트) 자동 산출

-- =============================================================================
-- 1) monthly_performance_reports : 월별 보고 본체
-- =============================================================================
create table if not exists public.monthly_performance_reports (
  id              uuid primary key default gen_random_uuid(),
  year            int  not null check (year between 2020 and 2100),
  month           int  not null check (month between 1 and 12),
  -- KPI 스냅샷 (고정 포맷; 확장 시 키만 추가)
  -- 예: { production:{actual_qty,plan_qty,eff,oee}, quality:{customer_ppm,...},
  --      cost:{...}, safety:{...}, hr:{...} }
  kpi             jsonb not null default '{}'::jsonb,
  -- 트렌드 분석 결과 (전월/전년 대비, 6개월 추이 등)
  insights        jsonb not null default '{}'::jsonb,
  -- 원본 첨부 (월 1회 업로드 파일 경로 — Supabase Storage)
  source_file_path text,
  source_file_name text,
  -- 생성 메타
  generated_by    uuid references auth.users(id),
  generated_at    timestamptz not null default now(),
  is_auto         boolean not null default false,
  -- 상태: draft / published / archived
  status          text not null default 'published'
                   check (status in ('draft','published','archived')),
  updated_at      timestamptz not null default now(),
  unique (year, month)
);

create index if not exists idx_mpr_year_month
  on public.monthly_performance_reports (year desc, month desc);

-- updated_at 자동 갱신
create or replace function public.touch_mpr_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_mpr_touch on public.monthly_performance_reports;
create trigger trg_mpr_touch
  before update on public.monthly_performance_reports
  for each row execute function public.touch_mpr_updated_at();

-- =============================================================================
-- 2) monthly_report_access_logs : 감사 로그 (CEO 조회 추적)
-- =============================================================================
create table if not exists public.monthly_report_access_logs (
  id           bigserial primary key,
  report_id    uuid references public.monthly_performance_reports(id) on delete cascade,
  user_id      uuid references auth.users(id),
  user_email   text,
  action       text not null check (action in ('view','download','generate','update')),
  ip_address   text,
  user_agent   text,
  created_at   timestamptz not null default now()
);

create index if not exists idx_mral_report
  on public.monthly_report_access_logs (report_id, created_at desc);
create index if not exists idx_mral_user
  on public.monthly_report_access_logs (user_id, created_at desc);

-- =============================================================================
-- 3) RLS — CEO 전용
-- =============================================================================
alter table public.monthly_performance_reports enable row level security;
alter table public.monthly_report_access_logs  enable row level security;

-- role 판별 헬퍼: user_metadata.role in ('ceo','admin')
create or replace function public.is_ceo_or_admin()
returns boolean
language sql stable as $$
  select coalesce(
    (auth.jwt() -> 'user_metadata' ->> 'role') in ('ceo','admin'),
    false
  );
$$;

-- 보고 본체: CEO/admin 만 SELECT
drop policy if exists mpr_select_ceo on public.monthly_performance_reports;
create policy mpr_select_ceo on public.monthly_performance_reports
  for select using ( public.is_ceo_or_admin() );

-- INSERT/UPDATE/DELETE 는 service_role 만 (정책 없음 → 일반 사용자 차단)
-- (서버 API에서 supabase-admin 사용)

-- 감사 로그: CEO/admin SELECT, 모든 authenticated INSERT(자기 행위 기록)
drop policy if exists mral_select_ceo on public.monthly_report_access_logs;
create policy mral_select_ceo on public.monthly_report_access_logs
  for select using ( public.is_ceo_or_admin() );

drop policy if exists mral_insert_self on public.monthly_report_access_logs;
create policy mral_insert_self on public.monthly_report_access_logs
  for insert with check ( auth.uid() = user_id );

-- =============================================================================
-- 4) 검증 쿼리 (실행 후 결과 확인용)
-- =============================================================================
-- select count(*) from public.monthly_performance_reports;
-- select count(*) from public.monthly_report_access_logs;
-- select policyname, cmd from pg_policies where tablename in
--   ('monthly_performance_reports','monthly_report_access_logs');
