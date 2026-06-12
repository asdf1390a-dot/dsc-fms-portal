-- ════════════════════════════════════════════════════════════════════════════
-- Expense Master Module — Phase 1 DB Migration
--
-- Source design: EXPENSE_MASTER_DESIGN_SPECIFICATION.md (sec. 2)
--
-- Tables (6):
--   1. expense_master           — code catalogue (1.1 ~ 4.1), 20 codes
--   2. expense_ledgers          — monthly transaction ledger (partitioned)
--   3. expense_validation       — 7-rule validation gate results
--   4. expense_history_drift    — past-month edit-detection snapshots
--   5. expense_kpi              — monthly aggregate cache (per code)
--   6. expense_audit_log        — generic audit trail (who/when/what)
--
-- Indexes:    12+
-- RLS:        5 policies (ledgers ×4 + validation ×1 baseline; extras for
--             master/kpi/audit/drift read-everyone, write-authenticated)
-- Triggers:   2 (update_expense_kpi, detect_history_drift)
-- Seed:       20 expense_master codes (1.1 ~ 4.1) + initial month partition
--
-- Run in:    Supabase SQL Editor
-- Idempotent: yes (IF NOT EXISTS / DROP+CREATE for policies & triggers)
--
-- Slot note: db/48 .. db/51 already taken — filed at db/52.
-- ════════════════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────────────────
-- 0. Extensions
-- ────────────────────────────────────────────────────────────────────────────
create extension if not exists pgcrypto;

-- ════════════════════════════════════════════════════════════════════════════
-- 1. expense_master
-- ════════════════════════════════════════════════════════════════════════════
create table if not exists public.expense_master (
  id                    uuid primary key default gen_random_uuid(),
  code                  varchar(10) not null unique,
  code_name_en          text        not null,
  code_name_ta          text,
  code_name_ko          text,
  category_type         varchar(50) not null
    check (category_type in ('R&M','CONSUMABLE','RAW_MATERIAL','POWER','OTHER')),

  annual_budget         numeric(15,2) default 0 check (annual_budget >= 0),
  monthly_plan          numeric(15,2) default 0 check (monthly_plan  >= 0),
  ytd_actual            numeric(15,2) default 0,
  ytd_variance          numeric(15,2) default 0,

  is_active             boolean     not null default true,
  last_transaction_date date,
  transaction_count     int         not null default 0,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists idx_expense_master_code on public.expense_master(code);
create index if not exists idx_expense_master_type on public.expense_master(category_type);
create index if not exists idx_expense_master_active on public.expense_master(is_active);

-- ════════════════════════════════════════════════════════════════════════════
-- 2. expense_ledgers  (LIST partitioned by period_month)
--
-- Note: dcmi_code is a soft reference to assets (no FK; column may not yet
-- exist on assets across all environments). Validation is enforced in the
-- application/validation layer.
-- ════════════════════════════════════════════════════════════════════════════
create table if not exists public.expense_ledgers (
  id                    bigserial,
  transaction_no        int         not null,
  transaction_date      date        not null,
  period_month          varchar(7)  not null
    check (period_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),

  expense_code          varchar(10) not null
    references public.expense_master(code) on update cascade,
  dcmi_code             int,

  machine_code          varchar(50),
  line_id               varchar(20),
  maker_name            varchar(100),
  model_name            varchar(100),
  system_name           varchar(100),
  summary_category      varchar(100),
  part_name             varchar(255),
  problem_description   text,

  quantity              numeric(10,2) check (quantity is null or quantity >= 0),
  unit_price            numeric(15,2) check (unit_price is null or unit_price >= 0),
  total_amount          numeric(15,2) check (total_amount is null or total_amount >= 0),
  currency              varchar(3)  not null default 'INR',

  supplier_name         varchar(255),
  transaction_ref       varchar(100),
  remarks               text,

  status                varchar(50) not null default 'DRAFT'
    check (status in ('DRAFT','SUBMITTED','APPROVED','REJECTED','FINAL')),
  approval_by           uuid references auth.users(id) on delete set null,
  approved_at           timestamptz,

  created_by            uuid not null references auth.users(id) on delete restrict,
  created_at            timestamptz not null default now(),
  updated_by            uuid references auth.users(id) on delete set null,
  updated_at            timestamptz not null default now(),

  primary key (id, period_month),
  unique (period_month, transaction_no)
) partition by list (period_month);

-- Indexes on parent propagate to all partitions
create index if not exists idx_expense_ledgers_period      on public.expense_ledgers(period_month);
create index if not exists idx_expense_ledgers_code        on public.expense_ledgers(expense_code);
create index if not exists idx_expense_ledgers_date        on public.expense_ledgers(transaction_date);
create index if not exists idx_expense_ledgers_dcmi        on public.expense_ledgers(dcmi_code);
create index if not exists idx_expense_ledgers_status      on public.expense_ledgers(status);
create index if not exists idx_expense_ledgers_created_by  on public.expense_ledgers(created_by);

-- Initial partitions: current + next 12 months (2026-06 .. 2027-06)
do $$
declare
  m date := date '2026-06-01';
  tag text;
begin
  for i in 0..12 loop
    tag := to_char(m + (i || ' month')::interval, 'YYYY_MM');
    execute format(
      'create table if not exists public.expense_ledgers_%s partition of public.expense_ledgers for values in (%L);',
      tag,
      to_char(m + (i || ' month')::interval, 'YYYY-MM')
    );
  end loop;
end$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. expense_validation
-- ════════════════════════════════════════════════════════════════════════════
create table if not exists public.expense_validation (
  id                   bigserial primary key,
  period_month         varchar(7)  not null
    check (period_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  expense_code         varchar(10) not null,

  rule_id              varchar(50) not null
    check (rule_id in (
      'TALLY_DIFF','PLAN_EXCEED','INVENTORY_MISMATCH','RECEIPT_CONTINUITY',
      'LEDGER_TOTAL','PURCHASE_LINK','DOCUMENT_COMPLETENESS'
    )),
  rule_name_en         text,
  rule_name_ko         text,

  is_passed            boolean not null default false,
  severity             varchar(20) not null default 'INFO'
    check (severity in ('INFO','WARNING','ERROR')),

  expected_value       numeric(15,2),
  actual_value         numeric(15,2),
  variance_value       numeric(15,2),
  variance_percent     numeric(7,2),
  threshold_limit      numeric(15,2),

  message_en           text,
  message_ko           text,
  affected_transactions int default 0,

  approval_required    boolean not null default false,
  approved_by          uuid references auth.users(id) on delete set null,
  approved_at          timestamptz,
  approval_comment     text,

  detected_at          timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists idx_validation_period   on public.expense_validation(period_month);
create index if not exists idx_validation_rule     on public.expense_validation(rule_id);
create index if not exists idx_validation_status   on public.expense_validation(is_passed);
create index if not exists idx_validation_approval on public.expense_validation(approval_required);

-- ════════════════════════════════════════════════════════════════════════════
-- 4. expense_history_drift
--
-- transaction_id references expense_ledgers(id) — but the parent table's PK
-- includes period_month for partitioning. We store id only as a logical
-- reference (no FK) plus the period_month for navigation.
-- ════════════════════════════════════════════════════════════════════════════
create table if not exists public.expense_history_drift (
  id                  bigserial primary key,
  period_month        varchar(7) not null,
  transaction_id      bigint     not null,

  previous_snapshot   jsonb,
  new_snapshot        jsonb,
  changed_fields      text[],
  change_reason       text,

  approval_required   boolean not null default true,
  approved_by         uuid references auth.users(id) on delete set null,
  approved_at         timestamptz,

  detected_at         timestamptz not null default now()
);

create index if not exists idx_drift_period      on public.expense_history_drift(period_month);
create index if not exists idx_drift_transaction on public.expense_history_drift(transaction_id);
create index if not exists idx_drift_approval    on public.expense_history_drift(approval_required);

-- ════════════════════════════════════════════════════════════════════════════
-- 5. expense_kpi
-- ════════════════════════════════════════════════════════════════════════════
create table if not exists public.expense_kpi (
  id                          uuid primary key default gen_random_uuid(),
  period_month                varchar(7)  not null,
  expense_code                varchar(10) not null,

  total_amount                numeric(15,2) not null default 0,
  transaction_count           int           not null default 0,

  vs_plan_variance            numeric(7,2),
  vs_previous_month_variance  numeric(7,2),
  vs_budget_variance          numeric(7,2),

  per_unit_consumption        numeric(15,4),
  production_volume           int,

  calculation_date            timestamptz not null default now(),

  unique(period_month, expense_code)
);

create index if not exists idx_kpi_period on public.expense_kpi(period_month);
create index if not exists idx_kpi_code   on public.expense_kpi(expense_code);

-- ════════════════════════════════════════════════════════════════════════════
-- 6. expense_audit_log
-- ════════════════════════════════════════════════════════════════════════════
create table if not exists public.expense_audit_log (
  id           bigserial primary key,
  table_name   varchar(64)  not null,
  record_id    text         not null,
  action       varchar(20)  not null
    check (action in ('INSERT','UPDATE','DELETE','APPROVE','REJECT','SUBMIT')),
  actor_id     uuid references auth.users(id) on delete set null,
  before_data  jsonb,
  after_data   jsonb,
  context      jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists idx_audit_table_record on public.expense_audit_log(table_name, record_id);
create index if not exists idx_audit_actor        on public.expense_audit_log(actor_id);
create index if not exists idx_audit_created      on public.expense_audit_log(created_at desc);

-- ════════════════════════════════════════════════════════════════════════════
-- 7. Triggers
-- ════════════════════════════════════════════════════════════════════════════

-- 7-1. update_expense_kpi: recompute aggregate on ledger insert/update/delete
create or replace function public.update_expense_kpi()
returns trigger
language plpgsql
as $$
declare
  v_period text;
  v_code   text;
begin
  v_period := coalesce(new.period_month, old.period_month);
  v_code   := coalesce(new.expense_code, old.expense_code);

  insert into public.expense_kpi (period_month, expense_code, total_amount, transaction_count, calculation_date)
  select
    v_period,
    v_code,
    coalesce(sum(total_amount), 0),
    count(*),
    now()
  from public.expense_ledgers
  where period_month = v_period
    and expense_code = v_code
  on conflict (period_month, expense_code) do update
    set total_amount      = excluded.total_amount,
        transaction_count = excluded.transaction_count,
        calculation_date  = now();

  return coalesce(new, old);
end;
$$;

drop trigger if exists tr_expense_kpi_update on public.expense_ledgers;
create trigger tr_expense_kpi_update
  after insert or update or delete on public.expense_ledgers
  for each row
  execute function public.update_expense_kpi();

-- 7-2. detect_history_drift: snapshot any UPDATE on a past month
create or replace function public.detect_history_drift()
returns trigger
language plpgsql
as $$
declare
  current_period text := to_char(now() at time zone 'UTC', 'YYYY-MM');
  changed text[];
begin
  if new.period_month < current_period then
    select array_agg(key)
      into changed
      from jsonb_each(to_jsonb(new)) e(key, val)
      where val is distinct from (to_jsonb(old) -> e.key);

    insert into public.expense_history_drift (
      period_month, transaction_id, previous_snapshot, new_snapshot,
      changed_fields, approval_required
    ) values (
      new.period_month, new.id, to_jsonb(old), to_jsonb(new),
      coalesce(changed, array[]::text[]), true
    );
  end if;
  return new;
end;
$$;

drop trigger if exists tr_history_drift_detect on public.expense_ledgers;
create trigger tr_history_drift_detect
  after update on public.expense_ledgers
  for each row
  execute function public.detect_history_drift();

-- ════════════════════════════════════════════════════════════════════════════
-- 8. RLS
-- ════════════════════════════════════════════════════════════════════════════

-- 8-1. expense_master — read all, write authenticated
alter table public.expense_master enable row level security;
drop policy if exists "expense_master_select" on public.expense_master;
drop policy if exists "expense_master_write"  on public.expense_master;
create policy "expense_master_select" on public.expense_master
  for select to anon, authenticated using (true);
create policy "expense_master_write" on public.expense_master
  for all to authenticated using (true) with check (true);

-- 8-2. expense_ledgers — 4 policies
alter table public.expense_ledgers enable row level security;
drop policy if exists "expense_ledgers_read"   on public.expense_ledgers;
drop policy if exists "expense_ledgers_insert" on public.expense_ledgers;
drop policy if exists "expense_ledgers_update" on public.expense_ledgers;
drop policy if exists "expense_ledgers_delete" on public.expense_ledgers;

create policy "expense_ledgers_read" on public.expense_ledgers
  for select to authenticated
  using (
    period_month = to_char(now() at time zone 'UTC', 'YYYY-MM')
    or status = 'FINAL'
    or created_by = auth.uid()
  );

create policy "expense_ledgers_insert" on public.expense_ledgers
  for insert to authenticated
  with check (created_by = auth.uid() and status = 'DRAFT');

create policy "expense_ledgers_update" on public.expense_ledgers
  for update to authenticated
  using (
    created_by = auth.uid()
    or exists (
      select 1 from auth.users
      where id = auth.uid()
        and raw_user_meta_data->>'role' = 'admin'
    )
  )
  with check (updated_by = auth.uid() or auth.uid() is not null);

create policy "expense_ledgers_delete" on public.expense_ledgers
  for delete to authenticated
  using (created_by = auth.uid() and status = 'DRAFT');

-- 8-3. expense_validation
alter table public.expense_validation enable row level security;
drop policy if exists "validation_read"   on public.expense_validation;
drop policy if exists "validation_write"  on public.expense_validation;
drop policy if exists "validation_update" on public.expense_validation;
create policy "validation_read" on public.expense_validation
  for select to anon, authenticated using (true);
create policy "validation_write" on public.expense_validation
  for insert to authenticated with check (true);
create policy "validation_update" on public.expense_validation
  for update to authenticated
  using (
    approved_by = auth.uid()
    or exists (
      select 1 from auth.users
      where id = auth.uid()
        and raw_user_meta_data->>'role' = 'admin'
    )
  );

-- 8-4. expense_history_drift — admin/author read+approve
alter table public.expense_history_drift enable row level security;
drop policy if exists "drift_read"   on public.expense_history_drift;
drop policy if exists "drift_write"  on public.expense_history_drift;
drop policy if exists "drift_update" on public.expense_history_drift;
create policy "drift_read" on public.expense_history_drift
  for select to authenticated using (true);
create policy "drift_write" on public.expense_history_drift
  for insert to authenticated with check (true);
create policy "drift_update" on public.expense_history_drift
  for update to authenticated using (
    exists (select 1 from auth.users where id = auth.uid()
            and raw_user_meta_data->>'role' = 'admin')
  );

-- 8-5. expense_kpi — read everyone, write service role / trigger
alter table public.expense_kpi enable row level security;
drop policy if exists "kpi_read"  on public.expense_kpi;
drop policy if exists "kpi_write" on public.expense_kpi;
create policy "kpi_read" on public.expense_kpi
  for select to anon, authenticated using (true);
create policy "kpi_write" on public.expense_kpi
  for all to authenticated using (true) with check (true);

-- 8-6. expense_audit_log — read auth, insert via service role (open to authed)
alter table public.expense_audit_log enable row level security;
drop policy if exists "audit_read"   on public.expense_audit_log;
drop policy if exists "audit_insert" on public.expense_audit_log;
create policy "audit_read" on public.expense_audit_log
  for select to authenticated using (true);
create policy "audit_insert" on public.expense_audit_log
  for insert to authenticated with check (true);

-- ════════════════════════════════════════════════════════════════════════════
-- 9. Seed: expense_master 20 codes (1.1 ~ 4.1)
-- ════════════════════════════════════════════════════════════════════════════
insert into public.expense_master (code, code_name_en, code_name_ko, code_name_ta, category_type) values
  ('1.1', 'R&M - Parts Purchase',          '수선유지 - 부품 구매',     'R&M - பாகங்கள் வாங்குதல்',     'R&M'),
  ('1.2', 'R&M - Service & Labor',          '수선유지 - 서비스/공임',   'R&M - சேவை மற்றும் கூலி',      'R&M'),
  ('1.3', 'R&M - Equipment Rental',         '수선유지 - 장비 임대',     'R&M - உபகரண வாடகை',           'R&M'),
  ('1.4', 'R&M - Scrap Sales',              '수선유지 - 폐기 매각',     'R&M - கழிவு விற்பனை',         'R&M'),
  ('1.5', 'R&M - Tools & Jigs',             '수선유지 - 공구/지그',     'R&M - கருவிகள் / ஜிக்',        'R&M'),
  ('1.6', 'R&M - Sub-contract',             '수선유지 - 외주',          'R&M - உப ஒப்பந்தம்',           'R&M'),
  ('1.7', 'R&M - Misc.',                    '수선유지 - 기타',          'R&M - இதர',                    'R&M'),
  ('2.1', 'Consumables',                    '소모품',                   'நுகர்பொருட்கள்',               'CONSUMABLE'),
  ('3.1', 'Raw Material - Steel',           '부자재 - 강철',            'மூலப்பொருள் - இரும்பு',        'RAW_MATERIAL'),
  ('3.2', 'Raw Material - PP',              '부자재 - PP',              'மூலப்பொருள் - PP',             'RAW_MATERIAL'),
  ('3.3', 'Raw Material - PU',              '부자재 - PU',              'மூலப்பொருள் - PU',             'RAW_MATERIAL'),
  ('3.4', 'Raw Material - Packaging',       '부자재 - 포장재',          'மூலப்பொருள் - பேக்கேஜிங்',     'RAW_MATERIAL'),
  ('3.5', 'Raw Material - Others',          '부자재 - 기타',            'மூலப்பொருள் - இதர',            'RAW_MATERIAL'),
  ('4.1', 'Power - Electricity',            '전력 - 전기',              'மின்சாரம்',                    'POWER'),
  ('4.2', 'Power - Gas',                    '전력 - 가스',              'எரிவாயு',                      'POWER'),
  ('4.3', 'Power - Water',                  '전력 - 용수',              'நீர்',                         'POWER'),
  ('5.1', 'Other - Safety',                 '기타 - 안전',              'பாதுகாப்பு',                   'OTHER'),
  ('5.2', 'Other - Environmental (CO2)',    '기타 - 환경(CO2)',         'சுற்றுச்சூழல் (CO2)',          'OTHER'),
  ('5.3', 'Other - Logistics',              '기타 - 물류',              'தளவாடம்',                      'OTHER'),
  ('5.4', 'Other - Misc.',                  '기타 - 기타',              'இதர',                          'OTHER')
on conflict (code) do nothing;

-- ════════════════════════════════════════════════════════════════════════════
-- 10. Verification queries (run manually after migration)
-- ════════════════════════════════════════════════════════════════════════════
-- select code, code_name_en, category_type from public.expense_master order by code;
-- select tablename from pg_tables where schemaname='public' and tablename like 'expense_%';
-- select indexname from pg_indexes where schemaname='public' and tablename like 'expense_%';
-- select policyname, tablename from pg_policies where schemaname='public' and tablename like 'expense_%';
-- select tgname, tgrelid::regclass from pg_trigger where tgname like 'tr_expense%' or tgname like 'tr_history%';
