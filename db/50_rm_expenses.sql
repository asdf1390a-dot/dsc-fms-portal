-- ============================================================
-- 50_rm_expenses.sql — R&M Monthly Cost portal (final design)
-- Created: 2026-06-10
-- Purpose: Single canonical table covering all 16 monthly cost
--          categories (R&M 1.1~1.7, 부자재 2.1/3.1~3.5,
--          Power 4.1, 기타 4.2/4.3).
-- Note: keeps existing `rm_monthly_costs` & `rm_workbooks`
--       tables untouched. This is the new portal-facing table.
-- ============================================================

create table if not exists public.rm_expenses (
  id              bigserial primary key,
  category_code   varchar(10) not null,             -- "1.1" .. "4.3"
  category_name   varchar(120) not null,
  category_name_ko varchar(120),
  category_group  varchar(20)  not null,            -- 'R&M' | '부자재' | '전력' | '기타'
  is_read_only    boolean not null default false,   -- 4.1, 4.2, 4.3 = true
  sort_order      int  not null default 0,

  jan_amount      bigint default 0,
  feb_amount      bigint default 0,
  mar_amount      bigint default 0,
  apr_amount      bigint default 0,
  may_amount      bigint default 0,
  jun_amount      bigint default 0,
  jul_amount      bigint default 0,
  aug_amount      bigint default 0,
  sep_amount      bigint default 0,
  oct_amount      bigint default 0,
  nov_amount      bigint default 0,
  dec_amount      bigint default 0,

  unit            varchar(10) not null default 'Rs', -- 'Rs' | 'KG'
  year            int  not null default 2026,
  source          varchar(50),                       -- 'tally' | 'manual' | 'operational'
  note            text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  unique (year, category_code)
);

create index if not exists idx_rm_expenses_year on public.rm_expenses(year);
create index if not exists idx_rm_expenses_group on public.rm_expenses(category_group);

create or replace function public.touch_rm_expenses() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists trg_touch_rm_expenses on public.rm_expenses;
create trigger trg_touch_rm_expenses
  before update on public.rm_expenses
  for each row execute function public.touch_rm_expenses();

-- RLS: anon read, authenticated write — but read-only rows must NOT
-- be updatable from the client. The portal API uses service_role and
-- enforces the check at the API layer; we still add a defensive RLS
-- guard so direct anon writes can't bypass it.
alter table public.rm_expenses enable row level security;

drop policy if exists rmex_select_all on public.rm_expenses;
create policy rmex_select_all on public.rm_expenses for select using (true);

drop policy if exists rmex_insert_auth on public.rm_expenses;
create policy rmex_insert_auth on public.rm_expenses
  for insert to authenticated with check (true);

drop policy if exists rmex_update_auth on public.rm_expenses;
create policy rmex_update_auth on public.rm_expenses
  for update to authenticated
  using (is_read_only = false) with check (is_read_only = false);

drop policy if exists rmex_delete_auth on public.rm_expenses;
create policy rmex_delete_auth on public.rm_expenses
  for delete to authenticated using (is_read_only = false);

-- ============================================================
-- Seed: 16 categories for year=2026 (Jan–Apr from TALLY DOWNLOAD)
-- ============================================================
insert into public.rm_expenses
  (category_code, category_name, category_name_ko, category_group, is_read_only,
   sort_order, jan_amount, feb_amount, mar_amount, apr_amount,
   unit, year, source, note)
values
  -- R&M group (editable)
  ('1.1', 'Maintenance',         '유지관리',           'R&M',  false, 11, 1626734, 2499061, 1694056, 1803358, 'Rs', 2026, 'tally', null),
  ('1.2', 'JIG',                 '지그',               'R&M',  false, 12,  266756,  862805,  320060,  396872, 'Rs', 2026, 'tally', null),
  ('1.3', 'MOULD',               '몰드',               'R&M',  false, 13,  136271,  476973,   30210,       0, 'Rs', 2026, 'tally', null),
  ('1.4', 'Fabrication',         '제작',               'R&M',  false, 14,  211699,  498430,  193721,  208524, 'Rs', 2026, 'tally', null),
  ('1.5', 'Other Team',          '다른팀',             'R&M',  false, 15,   77723,  105218,  185196,  197796, 'Rs', 2026, 'tally', null),
  ('1.6', 'Factory Maintenance', '공장유지보수',       'R&M',  false, 16, 1855155,  777104,  180474, 1415103, 'Rs', 2026, 'tally', null),
  ('1.7', 'STP & Cooling Tower', 'STP·냉각탑',         'R&M',  false, 17,   56400,   31100,   31100,   31100, 'Rs', 2026, 'tally', null),

  -- 부자재 group (editable)
  ('2.1', 'Consumable Items',    '소모품',             '부자재', false, 21,  424070,  413205,  327411,  357836, 'Rs', 2026, 'tally', null),
  ('3.1', 'CO2 Gas',             'CO2 가스',           '부자재', false, 31,  289800,  356800,  350000,  302400, 'Rs', 2026, 'tally', null),
  ('3.2', 'Argon Gas',           '아르곤 가스',        '부자재', false, 32,  547347,  661942,  733441,  689366, 'Rs', 2026, 'tally', null),
  ('3.3', 'Nitrogen Gas',        '질소 가스',          '부자재', false, 33,  143222,  151882,  164026,  158957, 'Rs', 2026, 'tally', null),
  ('3.4', 'Welding Coil',        '용접 코일',          '부자재', false, 34, 1658955, 1977099, 2786791, 1701169, 'Rs', 2026, 'tally', null),
  ('3.5', 'AP3 Grease',          '그리스',             '부자재', false, 35,   69840,  174600,  192060,  457200, 'Rs', 2026, 'tally', null),

  -- 전력 group (read-only)
  ('4.1', 'Power Cost',          '전력 비용',          '전력',  true,  41, 4061508, 4301639, 4522807, 4229235, 'Rs', 2026, 'tally', '공장 전체 고정비 — 기술팀 관제 외'),

  -- 기타 group (read-only / reference)
  ('4.2', 'Daily Consumption',   '일일 부자재 소비',   '기타',  true,  42,       0,       0,       0,       0, 'KG', 2026, 'operational', 'KG 단위 운영 지표 (참고용)'),
  ('4.3', 'Other Expenses',      '기타 비용',          '기타',  true,  43, 1104240,   72000,       0,       0, 'Rs', 2026, 'manual',      '디젤·STP 인력 등 기타 (참고용)')
on conflict (year, category_code) do update set
  category_name    = excluded.category_name,
  category_name_ko = excluded.category_name_ko,
  category_group   = excluded.category_group,
  is_read_only     = excluded.is_read_only,
  sort_order       = excluded.sort_order,
  unit             = excluded.unit,
  source           = excluded.source,
  note             = excluded.note,
  jan_amount       = excluded.jan_amount,
  feb_amount       = excluded.feb_amount,
  mar_amount       = excluded.mar_amount,
  apr_amount       = excluded.apr_amount;
