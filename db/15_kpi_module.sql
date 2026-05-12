-- ============================================================
-- DSC FMS Portal — KPI Report Module
-- 파일: 15_kpi_module.sql
-- 실행: Supabase Dashboard → SQL Editor → 순서대로 실행
-- 전제: 01_schema.sql, 04_bm_module_v2.sql, 05_kpi_rpc.sql 실행 완료
-- 주의: admin 체크는 auth.users.raw_user_meta_data->>'role' 사용
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. kpi_categories (KPI 항목 마스터)
-- ─────────────────────────────────────────────────────────────
create table if not exists kpi_categories (
  id          text primary key,
  group_name  text not null,
  name_ko     text not null,
  name_en     text not null,
  unit        text not null,
  direction   text not null default 'up'
    check (direction in ('up','down')),
  is_auto     boolean not null default false,
  sort_order  int not null default 0,
  is_active   boolean not null default true
);

comment on table kpi_categories is 'KPI 항목 정의 마스터. is_auto=true인 항목은 bm_events RPC로 집계.';

insert into kpi_categories (id, group_name, name_ko, name_en, unit, direction, is_auto, sort_order) values
  ('production_volume',   '생산', '생산량',      'Production Volume',  'EA',  'up',   false, 10),
  ('oee',                 '생산', '설비종합효율', 'OEE',                '%',   'up',   false, 20),
  ('plan_achievement',    '생산', '계획달성률',   'Plan Achievement',   '%',   'up',   false, 30),
  ('defect_ppm',          '품질', '불량률',       'Defect Rate',        'PPM', 'down', false, 40),
  ('customer_return',     '품질', '고객반품',     'Customer Return',    '건',  'down', false, 50),
  ('mttr',                '보전', '평균수리시간', 'MTTR',               'h',   'down', true,  60),
  ('mtbf',                '보전', '평균고장간격', 'MTBF',               'h',   'up',   true,  70),
  ('pm_achievement',      '보전', 'PM달성률',     'PM Achievement',     '%',   'up',   false, 80),
  ('accident_count',      '안전', '재해건수',     'Accident Count',     '건',  'down', false, 90),
  ('near_miss_count',     '안전', '아차사고',     'Near Miss Count',    '건',  'down', false, 100),
  ('pm_completed',        '보전', 'PM완료건수',   'PM Completed',       '건',  'up',   false, 110)
on conflict (id) do nothing;


-- ─────────────────────────────────────────────────────────────
-- 2. kpi_targets
-- ─────────────────────────────────────────────────────────────
create table if not exists kpi_targets (
  id           uuid primary key default gen_random_uuid(),
  category_id  text not null references kpi_categories(id) on delete cascade,
  target_month date not null,
  target_value numeric(12,2) not null,
  note         text,
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (category_id, target_month)
);

create index if not exists kpi_targets_month_idx on kpi_targets(target_month desc);
create index if not exists kpi_targets_category_idx on kpi_targets(category_id);


-- ─────────────────────────────────────────────────────────────
-- 3. kpi_actuals
-- ─────────────────────────────────────────────────────────────
create table if not exists kpi_actuals (
  id           uuid primary key default gen_random_uuid(),
  category_id  text not null references kpi_categories(id) on delete cascade,
  target_month date not null,
  week_number  int,
  actual_value numeric(12,2) not null,
  is_auto      boolean not null default false,
  source_note  text,
  note         text,
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (category_id, target_month, week_number)
);

create index if not exists kpi_actuals_month_idx on kpi_actuals(target_month desc);
create index if not exists kpi_actuals_category_idx on kpi_actuals(category_id);


-- ─────────────────────────────────────────────────────────────
-- 4. kpi_comments
-- ─────────────────────────────────────────────────────────────
create table if not exists kpi_comments (
  id           uuid primary key default gen_random_uuid(),
  category_id  text not null references kpi_categories(id) on delete cascade,
  target_month date not null,
  body         text not null,
  author_name  text,
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now()
);

create index if not exists kpi_comments_month_idx on kpi_comments(target_month desc);


-- ─────────────────────────────────────────────────────────────
-- 5. updated_at trigger
-- ─────────────────────────────────────────────────────────────
create or replace function kpi_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_kpi_targets_updated_at on kpi_targets;
create trigger trg_kpi_targets_updated_at
  before update on kpi_targets
  for each row execute function kpi_set_updated_at();

drop trigger if exists trg_kpi_actuals_updated_at on kpi_actuals;
create trigger trg_kpi_actuals_updated_at
  before update on kpi_actuals
  for each row execute function kpi_set_updated_at();


-- ─────────────────────────────────────────────────────────────
-- 6. RLS
-- ─────────────────────────────────────────────────────────────
alter table kpi_categories enable row level security;
drop policy if exists "kpi_categories: read" on kpi_categories;
create policy "kpi_categories: read" on kpi_categories for select using (true);

alter table kpi_targets enable row level security;
drop policy if exists "kpi_targets: read" on kpi_targets;
create policy "kpi_targets: read" on kpi_targets for select using (true);
drop policy if exists "kpi_targets: write" on kpi_targets;
create policy "kpi_targets: write" on kpi_targets for all
  to authenticated using (true) with check (true);

alter table kpi_actuals enable row level security;
drop policy if exists "kpi_actuals: read" on kpi_actuals;
create policy "kpi_actuals: read" on kpi_actuals for select using (true);
drop policy if exists "kpi_actuals: write" on kpi_actuals;
create policy "kpi_actuals: write" on kpi_actuals for all
  to authenticated using (true) with check (true);

alter table kpi_comments enable row level security;
drop policy if exists "kpi_comments: read" on kpi_comments;
create policy "kpi_comments: read" on kpi_comments for select using (true);
drop policy if exists "kpi_comments: write" on kpi_comments;
create policy "kpi_comments: write" on kpi_comments for all
  to authenticated using (true) with check (true);


-- ─────────────────────────────────────────────────────────────
-- 7. RPC: kpi_auto_sync
-- ─────────────────────────────────────────────────────────────
create or replace function kpi_auto_sync(target_month text default to_char(now(), 'YYYY-MM-01'))
returns void language plpgsql security definer as $$
declare
  v_month date := date_trunc('month', target_month::timestamptz)::date;
  v_mttr  numeric;
  v_mtbf  numeric;
  v_kpi   record;
begin
  -- Reuse existing get_monthly_kpi RPC if available
  begin
    select * into v_kpi from get_monthly_kpi(v_month::text) limit 1;
    v_mttr := round((v_kpi.mttr_min / 60.0)::numeric, 2);
    v_mtbf := round((v_kpi.mtbf_min / 60.0)::numeric, 2);
  exception when others then
    v_mttr := null;
    v_mtbf := null;
  end;

  if v_mttr is not null then
    insert into kpi_actuals (category_id, target_month, actual_value, is_auto, source_note)
    values ('mttr', v_month, v_mttr, true, 'BM 이력 자동 집계')
    on conflict (category_id, target_month, week_number) do update
      set actual_value = excluded.actual_value,
          is_auto      = true,
          updated_at   = now();
  end if;

  if v_mtbf is not null then
    insert into kpi_actuals (category_id, target_month, actual_value, is_auto, source_note)
    values ('mtbf', v_month, v_mtbf, true, 'BM 이력 자동 집계')
    on conflict (category_id, target_month, week_number) do update
      set actual_value = excluded.actual_value,
          is_auto      = true,
          updated_at   = now();
  end if;
end;
$$;


-- ─────────────────────────────────────────────────────────────
-- 8. VIEW: kpi_dashboard_monthly
-- ─────────────────────────────────────────────────────────────
create or replace view kpi_dashboard_monthly as
select
  a.target_month,
  c.id            as category_id,
  c.group_name,
  c.name_ko,
  c.name_en,
  c.unit,
  c.direction,
  c.is_auto,
  c.sort_order,
  t.target_value,
  a.actual_value,
  case
    when t.target_value is null or t.target_value = 0 then null
    when c.direction = 'up'
      then round(a.actual_value / t.target_value * 100, 1)
    else
      round(t.target_value / nullif(a.actual_value, 0) * 100, 1)
  end as achievement_rate,
  a.is_auto       as actual_is_auto,
  a.source_note
from kpi_actuals a
join kpi_categories c on c.id = a.category_id
left join kpi_targets t
  on t.category_id = a.category_id
 and t.target_month = a.target_month
where a.week_number is null
  and c.is_active = true;
