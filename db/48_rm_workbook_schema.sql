-- R&M Workbook (Excel-mirror) schema
-- Created: 2026-06-10
-- Purpose: Faithful in-portal mirror of the 7 R&M Excel workbooks.
--          One row per Excel data row, columns kept as JSONB so different
--          workbooks (1.1 MAINTENANCE / 1.2 JIG / 1.3 MOULD / 1.4 FAB /
--          1.5 OTHER / 1.6 FACTORY / 1.7 STP) can each retain their own
--          native column layout exactly as in Excel.
--
-- Run order: AFTER 47_rm_monthly_costs.sql (independent schema, no FK).

-- ────────────────────────────────────────────────────────────────
-- rm_workbooks: catalogue of the 7 R&M workbooks
-- ────────────────────────────────────────────────────────────────
create table if not exists public.rm_workbooks (
  key         text primary key,           -- '1.1', '1.2', ... '1.7'
  title_en    text not null,
  title_ko    text not null,
  sort_order  int  not null default 0,
  columns     jsonb not null default '[]'::jsonb,
  -- columns is an array of {key,label_en,label_ko,type,width}
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────────
-- rm_monthly_rows: one row per Excel data row, per workbook+month
-- ────────────────────────────────────────────────────────────────
create table if not exists public.rm_monthly_rows (
  id            bigserial primary key,
  workbook_key  text not null references public.rm_workbooks(key) on delete cascade,
  year          int  not null default 2026,
  month         int  not null check (month between 1 and 12),
  row_index     int  not null,                   -- order within the month
  data          jsonb not null default '{}'::jsonb,   -- {colKey: value}
  hyperlinks    jsonb not null default '{}'::jsonb,   -- {colKey: url}
  source        text not null default 'excel',   -- 'excel' | 'manual'
  created_by    text,
  updated_by    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_rm_monthly_rows_wb_month
  on public.rm_monthly_rows(workbook_key, year, month, row_index);

-- ────────────────────────────────────────────────────────────────
-- Triggers: keep updated_at fresh
-- ────────────────────────────────────────────────────────────────
create or replace function public.touch_rm_workbooks() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists trg_touch_rm_workbooks on public.rm_workbooks;
create trigger trg_touch_rm_workbooks
  before update on public.rm_workbooks
  for each row execute function public.touch_rm_workbooks();

create or replace function public.touch_rm_monthly_rows() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists trg_touch_rm_monthly_rows on public.rm_monthly_rows;
create trigger trg_touch_rm_monthly_rows
  before update on public.rm_monthly_rows
  for each row execute function public.touch_rm_monthly_rows();

-- ────────────────────────────────────────────────────────────────
-- RLS: anon read, authenticated write
-- ────────────────────────────────────────────────────────────────
alter table public.rm_workbooks    enable row level security;
alter table public.rm_monthly_rows enable row level security;

drop policy if exists rmwb_select_all on public.rm_workbooks;
create policy rmwb_select_all on public.rm_workbooks for select using (true);
drop policy if exists rmwb_write_auth on public.rm_workbooks;
create policy rmwb_write_auth on public.rm_workbooks
  for all to authenticated using (true) with check (true);

drop policy if exists rmrow_select_all on public.rm_monthly_rows;
create policy rmrow_select_all on public.rm_monthly_rows for select using (true);
drop policy if exists rmrow_write_auth on public.rm_monthly_rows;
create policy rmrow_write_auth on public.rm_monthly_rows
  for all to authenticated using (true) with check (true);

-- ────────────────────────────────────────────────────────────────
-- Seed the 7 workbooks (columns will be overwritten by importer)
-- ────────────────────────────────────────────────────────────────
insert into public.rm_workbooks (key, title_en, title_ko, sort_order) values
  ('1.1', 'R&M Maintenance',     'R&M 유지보수',      11),
  ('1.2', 'JIG R&M',             '지그 R&M',          12),
  ('1.3', 'MOULD R&M',           '몰드 R&M',          13),
  ('1.4', 'Fabrication R&M',     '제작 R&M',          14),
  ('1.5', 'Other Team R&M',      '다른 팀 R&M',       15),
  ('1.6', 'Factory Maintenance', '공장 유지보수',     16),
  ('1.7', 'STP & Cooling Tower', 'STP 및 냉각탑',     17)
on conflict (key) do nothing;
