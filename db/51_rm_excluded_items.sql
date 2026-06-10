-- ============================================================
-- 51_rm_excluded_items.sql — R&M 포털 제외 항목 관리
-- Created: 2026-06-10
-- Purpose: 기술팀 직접 관리 영역 밖의 항목을 명시적으로 분리.
--          UI에서 "제외 항목 (참고용)" 섹션으로 별도 노출.
-- ============================================================

create table if not exists public.rm_excluded_items (
  id              bigserial primary key,
  item_code       varchar(20)  not null,             -- 'EX-POWER', 'EX-DAILY', ...
  item_name       varchar(120) not null,             -- "전력비"
  item_name_en    varchar(120),
  category_group  varchar(40)  not null,             -- '고정비/모니터링' 등
  reason          text         not null,             -- 제외 사유
  linked_code     varchar(10),                       -- rm_expenses.category_code 참조 (있을 경우)
  sort_order      int          not null default 0,
  active          boolean      not null default true,

  created_at      timestamptz  not null default now(),
  updated_at      timestamptz  not null default now(),

  unique (item_code)
);

create index if not exists idx_rm_excluded_items_group
  on public.rm_excluded_items(category_group);

create or replace function public.touch_rm_excluded_items() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists trg_touch_rm_excluded_items on public.rm_excluded_items;
create trigger trg_touch_rm_excluded_items
  before update on public.rm_excluded_items
  for each row execute function public.touch_rm_excluded_items();

-- RLS
alter table public.rm_excluded_items enable row level security;

drop policy if exists rmex_excl_select_all on public.rm_excluded_items;
create policy rmex_excl_select_all on public.rm_excluded_items
  for select using (true);

drop policy if exists rmex_excl_insert_auth on public.rm_excluded_items;
create policy rmex_excl_insert_auth on public.rm_excluded_items
  for insert to authenticated with check (true);

drop policy if exists rmex_excl_update_auth on public.rm_excluded_items;
create policy rmex_excl_update_auth on public.rm_excluded_items
  for update to authenticated using (true) with check (true);

drop policy if exists rmex_excl_delete_auth on public.rm_excluded_items;
create policy rmex_excl_delete_auth on public.rm_excluded_items
  for delete to authenticated using (true);

-- ============================================================
-- Seed: 4개 제외 항목
-- ============================================================
insert into public.rm_excluded_items
  (item_code, item_name, item_name_en, category_group, reason, linked_code, sort_order)
values
  ('EX-POWER', '전력비',        'Power Cost',         '고정비/모니터링',
   '공장 전체 고정비. 기술팀 관제 외 영역이며 별도 전력 모니터링 시스템에서 관리.',
   '4.1', 10),
  ('EX-DAILY', '일일소비량',    'Daily Consumption',  '운영지표/모니터링',
   'KG 단위 일일 부자재 소비 운영지표. 비용이 아니라 사용량 추적용 — 별도 KPI 대시보드.',
   '4.2', 20),
  ('EX-TALLY', 'Tally 원본',    'Tally Raw Data',     '회계원장/모니터링',
   'Tally ERP 원본 다운로드. 가공 전 회계 데이터로 포털에서는 가공 후 값만 노출.',
   null, 30),
  ('EX-DASH',  '분석 대시보드', 'Analysis Dashboard', '분석/모니터링',
   '비용 데이터 가공·시각화는 별도 분석 대시보드에서 처리. R&M 포털은 입력·집계 전용.',
   null, 40)
on conflict (item_code) do update set
  item_name      = excluded.item_name,
  item_name_en   = excluded.item_name_en,
  category_group = excluded.category_group,
  reason         = excluded.reason,
  linked_code    = excluded.linked_code,
  sort_order     = excluded.sort_order;
