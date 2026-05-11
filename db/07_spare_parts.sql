-- spare_parts table
create table if not exists spare_parts (
  id uuid primary key default gen_random_uuid(),
  part_number text,
  name_ko text not null,
  name_en text,
  category text not null default 'consumable'
    check (category in ('consumable','mechanical','electrical','hydraulic','other')),
  asset_id uuid references assets(id) on delete set null,
  quantity integer not null default 0,
  min_quantity integer not null default 5,
  unit text not null default 'EA',
  location text,
  notes text,
  created_at timestamptz not null default now()
);

-- stock_movements table
create table if not exists stock_movements (
  id uuid primary key default gen_random_uuid(),
  part_id uuid not null references spare_parts(id) on delete cascade,
  movement_type text not null check (movement_type in ('IN','OUT')),
  quantity integer not null check (quantity > 0),
  reason text,
  performed_by text,
  performed_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_spare_parts_category on spare_parts(category);
create index if not exists idx_spare_parts_asset on spare_parts(asset_id);
create index if not exists idx_stock_movements_part on stock_movements(part_id);
create index if not exists idx_stock_movements_at on stock_movements(performed_at desc);

-- RLS
alter table spare_parts enable row level security;
alter table stock_movements enable row level security;

create policy "auth users read spare_parts" on spare_parts for select using (auth.role() = 'authenticated');
create policy "auth users insert spare_parts" on spare_parts for insert with check (auth.role() = 'authenticated');
create policy "auth users update spare_parts" on spare_parts for update using (auth.role() = 'authenticated');

create policy "auth users read stock_movements" on stock_movements for select using (auth.role() = 'authenticated');
create policy "auth users insert stock_movements" on stock_movements for insert with check (auth.role() = 'authenticated');
