-- Productivity Workbook (Excel-mirror) schema
-- Created: 2026-06-10
-- Purpose: Faithful in-portal mirror of the monthly 생산성 집계 Excel sheet.
--          One workbook = one full B2:Y44 matrix. Columns include the
--          2026 target, 2025-11/12 actuals, 2026 Jan~Dec actuals, total,
--          remarks, improvement plan. Rows = productivity metrics
--          (생산효율 / 비가동 / Loss).
--
-- Run order: AFTER 48_rm_workbook_schema.sql (independent, no FK).

-- ────────────────────────────────────────────────────────────────
-- productivity_workbooks: catalogue (currently a single workbook)
-- ────────────────────────────────────────────────────────────────
create table if not exists public.productivity_workbooks (
  key         text primary key,           -- e.g. 'PROD-2026'
  title_en    text not null,
  title_ko    text not null,
  year        int  not null default 2026,
  sort_order  int  not null default 0,
  columns     jsonb not null default '[]'::jsonb,
  -- columns: array of {key,label_en,label_ko,group,month,year,width,type}
  --   group ∈ {'meta','target','actual','summary','note'}
  --   month/year set when this column represents a specific period
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────────
-- productivity_monthly_rows: one row per Excel data row (B2:Y44).
--   Each row holds the full horizontal slice across all months.
-- ────────────────────────────────────────────────────────────────
create table if not exists public.productivity_monthly_rows (
  id            bigserial primary key,
  workbook_key  text not null references public.productivity_workbooks(key) on delete cascade,
  row_index     int  not null,                   -- 1..N order in sheet
  row_type      text not null default 'data',    -- 'data' | 'subtotal' | 'ratio' | 'summary'
  data          jsonb not null default '{}'::jsonb,   -- {colKey: value}
  hyperlinks    jsonb not null default '{}'::jsonb,   -- {colKey: url}
  source        text not null default 'excel',   -- 'excel' | 'manual'
  created_by    text,
  updated_by    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_productivity_rows_wb_idx
  on public.productivity_monthly_rows(workbook_key, row_index);

-- ────────────────────────────────────────────────────────────────
-- Triggers
-- ────────────────────────────────────────────────────────────────
create or replace function public.touch_productivity_workbooks() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists trg_touch_prod_wb on public.productivity_workbooks;
create trigger trg_touch_prod_wb
  before update on public.productivity_workbooks
  for each row execute function public.touch_productivity_workbooks();

create or replace function public.touch_productivity_rows() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists trg_touch_prod_rows on public.productivity_monthly_rows;
create trigger trg_touch_prod_rows
  before update on public.productivity_monthly_rows
  for each row execute function public.touch_productivity_rows();

-- ────────────────────────────────────────────────────────────────
-- RLS
-- ────────────────────────────────────────────────────────────────
alter table public.productivity_workbooks    enable row level security;
alter table public.productivity_monthly_rows enable row level security;

drop policy if exists prodwb_select_all on public.productivity_workbooks;
create policy prodwb_select_all on public.productivity_workbooks for select using (true);
drop policy if exists prodwb_write_auth on public.productivity_workbooks;
create policy prodwb_write_auth on public.productivity_workbooks
  for all to authenticated using (true) with check (true);

drop policy if exists prodrow_select_all on public.productivity_monthly_rows;
create policy prodrow_select_all on public.productivity_monthly_rows for select using (true);
drop policy if exists prodrow_write_auth on public.productivity_monthly_rows;
create policy prodrow_write_auth on public.productivity_monthly_rows
  for all to authenticated using (true) with check (true);

-- ────────────────────────────────────────────────────────────────
-- Seed the workbook (columns filled by importer)
-- ────────────────────────────────────────────────────────────────
insert into public.productivity_workbooks (key, title_en, title_ko, year, sort_order) values
  ('PROD-2026', 'Mannur Productivity 2026', '만누르법인 생산성 2026', 2026, 1)
on conflict (key) do nothing;
