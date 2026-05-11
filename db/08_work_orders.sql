create table if not exists work_orders (
  id uuid primary key default gen_random_uuid(),
  wo_number text unique,  -- auto-generated: WO-YYYYMMDD-NNN
  title text not null,
  description text,
  asset_id uuid references assets(id) on delete set null,
  bm_id uuid references bm_events(id) on delete set null,
  priority text not null default 'medium'
    check (priority in ('critical','high','medium','low')),
  status text not null default 'open'
    check (status in ('open','in_progress','pending_parts','completed','cancelled')),
  assigned_to text,
  due_date date,
  estimated_hours numeric(5,1),
  actual_hours numeric(5,1),
  completion_notes text,
  completed_at timestamptz,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_work_orders_status on work_orders(status);
create index if not exists idx_work_orders_asset on work_orders(asset_id);
create index if not exists idx_work_orders_due on work_orders(due_date);
create index if not exists idx_work_orders_created on work_orders(created_at desc);

alter table work_orders enable row level security;
create policy "auth users read work_orders" on work_orders for select using (auth.role() = 'authenticated');
create policy "auth users insert work_orders" on work_orders for insert with check (auth.role() = 'authenticated');
create policy "auth users update work_orders" on work_orders for update using (auth.role() = 'authenticated');
