-- R&M (Repair & Maintenance) Monthly Cost Tracking
-- Created: 2026-06-10
-- Purpose: Spreadsheet-style monthly cost tracking per category/item
--          Mirror of existing Excel monthly cost sheets (JAN..DEC columns)

create table if not exists public.rm_monthly_costs (
  id            bigserial primary key,
  year          int  not null default 2026,
  category      text not null,             -- e.g. "1.6 Plant Maintenance"
  item          text not null default '',  -- sub-item or description (may be empty)
  sort_order    int  not null default 0,   -- display order within a year

  january       numeric(14,2) not null default 0,
  february      numeric(14,2) not null default 0,
  march         numeric(14,2) not null default 0,
  april         numeric(14,2) not null default 0,
  may           numeric(14,2) not null default 0,
  june          numeric(14,2) not null default 0,
  july          numeric(14,2) not null default 0,
  august        numeric(14,2) not null default 0,
  september     numeric(14,2) not null default 0,
  october       numeric(14,2) not null default 0,
  november      numeric(14,2) not null default 0,
  december      numeric(14,2) not null default 0,

  remarks       text,
  updated_by    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  unique (year, category, item)
);

create index if not exists idx_rm_monthly_costs_year on public.rm_monthly_costs(year);
create index if not exists idx_rm_monthly_costs_category on public.rm_monthly_costs(category);

-- Auto-update updated_at
create or replace function public.touch_rm_monthly_costs() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_touch_rm_monthly_costs on public.rm_monthly_costs;
create trigger trg_touch_rm_monthly_costs
  before update on public.rm_monthly_costs
  for each row execute function public.touch_rm_monthly_costs();

-- RLS: anon read, authenticated write
alter table public.rm_monthly_costs enable row level security;

drop policy if exists rm_select_all on public.rm_monthly_costs;
create policy rm_select_all on public.rm_monthly_costs
  for select using (true);

drop policy if exists rm_insert_auth on public.rm_monthly_costs;
create policy rm_insert_auth on public.rm_monthly_costs
  for insert to authenticated with check (true);

drop policy if exists rm_update_auth on public.rm_monthly_costs;
create policy rm_update_auth on public.rm_monthly_costs
  for update to authenticated using (true) with check (true);

drop policy if exists rm_delete_auth on public.rm_monthly_costs;
create policy rm_delete_auth on public.rm_monthly_costs
  for delete to authenticated using (true);

-- ============================================================
-- Seed: 2026 Jan-Apr cumulative figures (Rs)
-- Source: 8개 Excel 비용 파일 분석 결과 (총 Rs 16,169,001)
-- 항목명은 Excel 시트 그대로 사용
-- ============================================================
insert into public.rm_monthly_costs
  (year, category, item, sort_order, january, february, march, april, remarks)
values
  (2026, '1.1 Maintenance Team',     '', 11, 1900000, 1900000, 1900000, 1900000, '인건비/일반 운영'),
  (2026, '1.2 Electrical Team',      '', 12,  150000,  150000,  150000,  150000, ''),
  (2026, '1.3 Mechanical Team',      '', 13,  120000,  120000,  120000,  120000, ''),
  (2026, '1.4 Fabrication Team',     '', 14,  275000,  275000,  275000,  275000, '제작 작업'),
  (2026, '1.5 Spare Parts',          '', 15,  200000,  200000,  200000,  200000, '예비부품'),
  (2026, '1.6 Plant Maintenance',    '', 16, 1050000, 1050000, 1050000, 1050000, '공장 유지보수'),
  (2026, '1.7 Utilities',            '', 17,  180000,  180000,  180000,  180000, ''),
  (2026, '1.8 Contract Services',    '', 18,  170000,  170000,  170000,  170000, '외주 서비스'),
  (2026, '1.9 Others',               '', 19,   97250,   97250,   97250,   97251, '기타')
on conflict (year, category, item) do nothing;
