-- ============================================================
-- DSC FMS Portal — Parts & Inventory Module (확장)
-- 파일: 16_parts_module.sql
-- 전제: 07_spare_parts.sql 이미 실행됨
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. vendors
-- ─────────────────────────────────────────────────────────────
create table if not exists vendors (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  name_short    text,
  country       text not null default 'India',
  city          text,
  contact_name  text,
  contact_phone text,
  contact_email text,
  address       text,
  lead_time_days integer,
  payment_terms text,
  currency      text not null default 'INR',
  is_active     boolean not null default true,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_vendors_name on vendors(name);
create index if not exists idx_vendors_active on vendors(is_active);

-- ─────────────────────────────────────────────────────────────
-- 2. spare_parts 컬럼 보완
-- ─────────────────────────────────────────────────────────────
alter table spare_parts
  add column if not exists vendor_id        uuid references vendors(id) on delete set null,
  add column if not exists unit_price       numeric(12,2),
  add column if not exists currency         text default 'INR',
  add column if not exists lead_time_days   integer,
  add column if not exists specs            text,
  add column if not exists maker            text,
  add column if not exists image_url        text,
  add column if not exists updated_at       timestamptz not null default now(),
  add column if not exists low_stock_notified_at timestamptz;

create index if not exists idx_spare_parts_vendor on spare_parts(vendor_id);
create index if not exists idx_spare_parts_low_stock
  on spare_parts(quantity, min_quantity)
  where quantity <= min_quantity;

-- ─────────────────────────────────────────────────────────────
-- 3. stock_movements 컬럼 보완
-- ─────────────────────────────────────────────────────────────
alter table stock_movements
  add column if not exists bm_event_id      uuid references bm_events(id) on delete set null,
  add column if not exists performed_by_uid uuid references auth.users(id) on delete set null,
  add column if not exists vendor_id        uuid references vendors(id) on delete set null,
  add column if not exists unit_price       numeric(12,2),
  add column if not exists currency         text default 'INR',
  add column if not exists reference_no     text;

create index if not exists idx_stock_movements_bm on stock_movements(bm_event_id) where bm_event_id is not null;
create index if not exists idx_stock_movements_vendor on stock_movements(vendor_id) where vendor_id is not null;

-- ─────────────────────────────────────────────────────────────
-- 4. updated_at trigger
-- ─────────────────────────────────────────────────────────────
create or replace function parts_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_spare_parts_updated_at on spare_parts;
create trigger trg_spare_parts_updated_at
  before update on spare_parts
  for each row execute function parts_set_updated_at();

drop trigger if exists trg_vendors_updated_at on vendors;
create trigger trg_vendors_updated_at
  before update on vendors
  for each row execute function parts_set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 5. 재고 자동 증감 트리거
-- ─────────────────────────────────────────────────────────────
create or replace function apply_stock_movement()
returns trigger language plpgsql as $$
begin
  if NEW.movement_type = 'IN' then
    update spare_parts
       set quantity = quantity + NEW.quantity
     where id = NEW.part_id;
  elsif NEW.movement_type = 'OUT' then
    if (select quantity from spare_parts where id = NEW.part_id) < NEW.quantity then
      raise exception 'INSUFFICIENT_STOCK: current=% requested=%',
        (select quantity from spare_parts where id = NEW.part_id), NEW.quantity;
    end if;
    update spare_parts
       set quantity = quantity - NEW.quantity
     where id = NEW.part_id;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_stock_movement_apply on stock_movements;
create trigger trg_stock_movement_apply
  after insert on stock_movements
  for each row execute function apply_stock_movement();

-- ─────────────────────────────────────────────────────────────
-- 6. v_low_stock view
-- ─────────────────────────────────────────────────────────────
create or replace view v_low_stock as
select
  sp.id,
  sp.part_number,
  sp.name_ko,
  sp.name_en,
  sp.category,
  sp.quantity,
  sp.min_quantity,
  sp.unit,
  sp.location,
  sp.vendor_id,
  v.name        as vendor_name,
  v.contact_phone as vendor_phone,
  sp.lead_time_days,
  sp.low_stock_notified_at,
  (sp.min_quantity - sp.quantity) as shortage
from spare_parts sp
left join vendors v on v.id = sp.vendor_id
where sp.quantity <= sp.min_quantity
  and sp.min_quantity > 0
order by (sp.min_quantity - sp.quantity) desc, sp.name_ko;

-- ─────────────────────────────────────────────────────────────
-- 7. v_stock_monthly
-- ─────────────────────────────────────────────────────────────
create or replace view v_stock_monthly as
select
  date_trunc('month', sm.performed_at) as month,
  sm.movement_type,
  sp.category,
  count(*)                              as tx_count,
  sum(sm.quantity)                      as total_qty,
  sum(sm.quantity * coalesce(sm.unit_price, sp.unit_price, 0)) as total_value
from stock_movements sm
join spare_parts sp on sp.id = sm.part_id
group by 1, 2, 3
order by 1 desc, 2, 3;

-- ─────────────────────────────────────────────────────────────
-- 8. RLS vendors
-- ─────────────────────────────────────────────────────────────
alter table vendors enable row level security;

drop policy if exists "vendors: read" on vendors;
create policy "vendors: read" on vendors for select using (true);

drop policy if exists "vendors: write" on vendors;
create policy "vendors: write" on vendors for all
  to authenticated using (true) with check (true);

-- spare_parts DELETE
drop policy if exists "auth users delete spare_parts" on spare_parts;
create policy "auth users delete spare_parts"
  on spare_parts for delete
  to authenticated using (true);
