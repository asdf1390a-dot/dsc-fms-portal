-- ============================================================================
-- DSC FMS Portal — KPI Reporting Module (Phase 1)
-- 적용: Supabase Dashboard → SQL Editor → 붙여넣기 → Run
-- ============================================================================
-- Tables:
--   kpi_categories  — KPI 마스터 (11 items, seeded)
--   kpi_targets     — 월별 목표값 (category × month)
--   kpi_actuals     — 월/주 실적값 (week_number nullable; null = 월합계)
--   kpi_comments    — KPI 코멘트 (월/카테고리별)
-- Functions / Views:
--   kpi_set_updated_at()       — generic trigger
--   kpi_auto_sync(target_month)— bm_kpi → MTTR/MTBF 자동 upsert
--   kpi_dashboard_monthly      — target + actual + achievement_rate
-- RLS:
--   read     → authenticated
--   write    → admin (profiles.role = 'admin')
-- ============================================================================

-- ── profiles 테이블 (없으면 생성: role 관리용) ───────────────────────────────
create table if not exists profiles (
  user_id   uuid primary key references auth.users(id) on delete cascade,
  role      text not null default 'user',          -- 'admin' | 'user'
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table profiles enable row level security;

drop policy if exists profiles_self_read on profiles;
create policy profiles_self_read on profiles
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists profiles_admin_read_all on profiles;
create policy profiles_admin_read_all on profiles
  for select to authenticated
  using (exists (select 1 from profiles p2 where p2.user_id = auth.uid() and p2.role = 'admin'));

-- ── updated_at 트리거 함수 ──────────────────────────────────────────────────
create or replace function kpi_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── 1. kpi_categories ──────────────────────────────────────────────────────
create table if not exists kpi_categories (
  id          text primary key,                          -- e.g. 'mttr'
  group_name  text not null,                             -- 생산/품질/보전/안전
  label       text not null,                             -- 표시 명칭
  unit        text not null,                             -- EA / % / PPM / h / 건
  direction   text not null check (direction in ('up','down')),
  is_auto     boolean not null default false,            -- bm_kpi 자동 연동 여부
  sort_order  int not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
drop trigger if exists trg_kpi_categories_updated on kpi_categories;
create trigger trg_kpi_categories_updated before update on kpi_categories
  for each row execute function kpi_set_updated_at();

alter table kpi_categories enable row level security;
drop policy if exists kpi_categories_read on kpi_categories;
create policy kpi_categories_read on kpi_categories
  for select to authenticated using (true);
drop policy if exists kpi_categories_admin_write on kpi_categories;
create policy kpi_categories_admin_write on kpi_categories
  for all to authenticated
  using (exists (select 1 from profiles p where p.user_id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from profiles p where p.user_id = auth.uid() and p.role = 'admin'));

-- ── 2. kpi_targets ─────────────────────────────────────────────────────────
create table if not exists kpi_targets (
  id            bigserial primary key,
  category_id   text not null references kpi_categories(id) on delete cascade,
  target_month  date not null,                           -- always YYYY-MM-01
  target_value  numeric not null,
  note          text,
  created_by    uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (category_id, target_month)
);
create index if not exists idx_kpi_targets_month on kpi_targets(target_month);
drop trigger if exists trg_kpi_targets_updated on kpi_targets;
create trigger trg_kpi_targets_updated before update on kpi_targets
  for each row execute function kpi_set_updated_at();

alter table kpi_targets enable row level security;
drop policy if exists kpi_targets_read on kpi_targets;
create policy kpi_targets_read on kpi_targets
  for select to authenticated using (true);
drop policy if exists kpi_targets_admin_write on kpi_targets;
create policy kpi_targets_admin_write on kpi_targets
  for all to authenticated
  using (exists (select 1 from profiles p where p.user_id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from profiles p where p.user_id = auth.uid() and p.role = 'admin'));

-- ── 3. kpi_actuals ─────────────────────────────────────────────────────────
create table if not exists kpi_actuals (
  id            bigserial primary key,
  category_id   text not null references kpi_categories(id) on delete cascade,
  target_month  date not null,                           -- always YYYY-MM-01
  week_number   int,                                     -- null = 월합계
  actual_value  numeric not null,
  is_auto       boolean not null default false,
  source_note   text,
  created_by    uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
-- weekly + monthly rows allowed; uniqueness covers nulls via coalesce
create unique index if not exists uniq_kpi_actuals_cat_month_week
  on kpi_actuals (category_id, target_month, coalesce(week_number, -1));
create index if not exists idx_kpi_actuals_month on kpi_actuals(target_month);

drop trigger if exists trg_kpi_actuals_updated on kpi_actuals;
create trigger trg_kpi_actuals_updated before update on kpi_actuals
  for each row execute function kpi_set_updated_at();

alter table kpi_actuals enable row level security;
drop policy if exists kpi_actuals_read on kpi_actuals;
create policy kpi_actuals_read on kpi_actuals
  for select to authenticated using (true);
drop policy if exists kpi_actuals_admin_write on kpi_actuals;
create policy kpi_actuals_admin_write on kpi_actuals
  for all to authenticated
  using (exists (select 1 from profiles p where p.user_id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from profiles p where p.user_id = auth.uid() and p.role = 'admin'));

-- ── 4. kpi_comments ────────────────────────────────────────────────────────
create table if not exists kpi_comments (
  id            bigserial primary key,
  target_month  date not null,
  category_id   text references kpi_categories(id) on delete cascade,
  body          text not null,
  created_by    uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_kpi_comments_month on kpi_comments(target_month);
drop trigger if exists trg_kpi_comments_updated on kpi_comments;
create trigger trg_kpi_comments_updated before update on kpi_comments
  for each row execute function kpi_set_updated_at();

alter table kpi_comments enable row level security;
drop policy if exists kpi_comments_read on kpi_comments;
create policy kpi_comments_read on kpi_comments
  for select to authenticated using (true);
drop policy if exists kpi_comments_admin_write on kpi_comments;
create policy kpi_comments_admin_write on kpi_comments
  for all to authenticated
  using (exists (select 1 from profiles p where p.user_id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from profiles p where p.user_id = auth.uid() and p.role = 'admin'));

-- ── 5. SEED — kpi_categories (11 items) ────────────────────────────────────
insert into kpi_categories (id, group_name, label, unit, direction, is_auto, sort_order) values
  ('production_volume', '생산', '생산량',         'EA',  'up',   false, 10),
  ('oee',               '생산', '설비종합효율',   '%',   'up',   false, 20),
  ('plan_achievement',  '생산', '계획달성률',     '%',   'up',   false, 30),
  ('defect_ppm',        '품질', '불량률',         'PPM', 'down', false, 40),
  ('customer_return',   '품질', '고객반품',       '건',  'down', false, 50),
  ('mttr',              '보전', 'MTTR',          'h',   'down', true,  60),
  ('mtbf',              '보전', 'MTBF',          'h',   'up',   true,  70),
  ('pm_achievement',    '보전', 'PM달성률',       '%',   'up',   false, 80),
  ('pm_completed',      '보전', 'PM완료건수',     '건',  'up',   false, 90),
  ('accident_count',    '안전', '재해건수',       '건',  'down', false, 100),
  ('near_miss_count',   '안전', '아차사고',       '건',  'down', false, 110)
on conflict (id) do update set
  group_name = excluded.group_name,
  label      = excluded.label,
  unit       = excluded.unit,
  direction  = excluded.direction,
  is_auto    = excluded.is_auto,
  sort_order = excluded.sort_order;

-- ── 6. kpi_auto_sync RPC ───────────────────────────────────────────────────
-- bm_kpi 뷰에서 해당 월의 MTTR/MTBF를 집계해 kpi_actuals(week_number=null) upsert
create or replace function kpi_auto_sync(target_month date)
returns table (category_id text, actual_value numeric)
language plpgsql security definer as $$
declare
  v_mttr numeric;
  v_mtbf numeric;
begin
  select
    round( sum(mttr_min * breakdown_count) / nullif(sum(breakdown_count), 0) / 60.0, 2),
    round( avg(mtbf_min) / 60.0, 2)
  into v_mttr, v_mtbf
  from bm_kpi
  where month = date_trunc('month', target_month::timestamptz);

  if v_mttr is not null then
    insert into kpi_actuals (category_id, target_month, week_number, actual_value, is_auto, source_note)
    values ('mttr', date_trunc('month', target_month)::date, null, v_mttr, true, 'auto-sync from bm_kpi')
    on conflict (category_id, target_month, coalesce(week_number, -1)) do update
      set actual_value = excluded.actual_value,
          is_auto      = true,
          source_note  = excluded.source_note,
          updated_at   = now();
  end if;

  if v_mtbf is not null then
    insert into kpi_actuals (category_id, target_month, week_number, actual_value, is_auto, source_note)
    values ('mtbf', date_trunc('month', target_month)::date, null, v_mtbf, true, 'auto-sync from bm_kpi')
    on conflict (category_id, target_month, coalesce(week_number, -1)) do update
      set actual_value = excluded.actual_value,
          is_auto      = true,
          source_note  = excluded.source_note,
          updated_at   = now();
  end if;

  return query
    select 'mttr'::text, v_mttr
    union all select 'mtbf'::text, v_mtbf;
end;
$$;

-- ── 7. kpi_dashboard_monthly VIEW ──────────────────────────────────────────
create or replace view kpi_dashboard_monthly as
select
  c.id            as category_id,
  c.group_name,
  c.label,
  c.unit,
  c.direction,
  c.is_auto,
  c.sort_order,
  t.target_month  as month,
  t.target_value,
  a.actual_value,
  a.source_note,
  a.is_auto       as actual_is_auto,
  -- achievement_rate (%): up → actual/target*100, down → target/actual*100
  -- ZERO 달성 케이스: target=0 and actual=0 → 100
  case
    when t.target_value is null or a.actual_value is null then null
    when t.target_value = 0 and a.actual_value = 0 then 100
    when c.direction = 'up' and t.target_value <> 0
      then round(a.actual_value * 100.0 / t.target_value, 1)
    when c.direction = 'down' and a.actual_value <> 0
      then round(t.target_value * 100.0 / a.actual_value, 1)
    when c.direction = 'down' and t.target_value = 0 and a.actual_value > 0
      then 0
    else null
  end as achievement_rate
from kpi_categories c
left join kpi_targets t on t.category_id = c.id
left join kpi_actuals a
  on a.category_id  = c.id
 and a.target_month = t.target_month
 and a.week_number is null
where c.active = true;

-- ── 끝 ─────────────────────────────────────────────────────────────────────
