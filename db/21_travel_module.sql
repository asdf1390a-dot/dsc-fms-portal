-- ────────────────────────────────────────────────────────────────────────
-- DSC Hub — Travel Records Module
-- Tables: travel_records, travel_schedules, travel_costs, travel_routes
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run
-- Status: Idempotent (safe to re-run)
-- ────────────────────────────────────────────────────────────────────────

-- ── Updated_at trigger function ─────────────────────────────────────────
create or replace function public.travel_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── Main: travel_records ────────────────────────────────────────────────
create table if not exists public.travel_records (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,

  -- Basic info
  title           text not null,                -- "India Visit 2026-05"
  description     text,                        -- Purpose/notes
  start_date      date not null,
  end_date        date not null,
  country         text default 'India',

  -- Statistics
  total_distance_km   integer default 0,       -- Calculated distance (km)
  total_cost_inr      decimal(12,2) default 0,  -- Total cost (INR)
  total_cost_krw      decimal(14,2) default 0,  -- Total cost (KRW)

  -- Status
  status          text default 'planning'
    check (status in ('planning', 'ongoing', 'completed', 'cancelled')),

  -- Attachments
  photos          text[] default '{}',         -- Supabase Storage URLs
  documents       text[] default '{}',         -- Travel documents (visas, etc)

  -- Audit
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  created_by      uuid references auth.users(id),
  updated_by      uuid references auth.users(id)
);

create index if not exists idx_travel_user on public.travel_records(user_id);
create index if not exists idx_travel_date on public.travel_records(start_date desc);
create index if not exists idx_travel_status on public.travel_records(status);

drop trigger if exists trg_travel_updated_at on public.travel_records;
create trigger trg_travel_updated_at
  before update on public.travel_records
  for each row execute function public.travel_set_updated_at();

-- ── travel_schedules ────────────────────────────────────────────────────
create table if not exists public.travel_schedules (
  id              uuid primary key default gen_random_uuid(),
  travel_id       uuid not null references travel_records(id) on delete cascade,

  -- Schedule entry
  date            date not null,
  event_name      text not null,               -- "HQ Meeting", "Plant Tour"
  location        text not null,               -- City name
  description     text,

  -- Time
  start_time      time,
  end_time        time,

  -- Map coordinates
  latitude        decimal(9,6),                -- For Google Maps
  longitude       decimal(9,6),

  -- Order
  sort_order      integer default 0,

  -- Audit
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists idx_schedule_travel on public.travel_schedules(travel_id);
create index if not exists idx_schedule_date on public.travel_schedules(date asc);

drop trigger if exists trg_schedule_updated_at on public.travel_schedules;
create trigger trg_schedule_updated_at
  before update on public.travel_schedules
  for each row execute function public.travel_set_updated_at();

-- ── travel_costs ────────────────────────────────────────────────────────
create table if not exists public.travel_costs (
  id              uuid primary key default gen_random_uuid(),
  travel_id       uuid not null references travel_records(id) on delete cascade,

  -- Cost entry
  cost_type       text not null,               -- flight, hotel, meal, transport, other
  description     text,                       -- "Seoul-Chennai flight ticket"

  amount          decimal(12,2) not null,
  currency        text default 'INR'
    check (currency in ('INR', 'KRW', 'USD')),

  -- Exchange rate (at time of record)
  exchange_rate   decimal(8,4),                -- INR to KRW rate used

  -- Approval workflow
  is_approved     boolean default false,
  approved_by     uuid references auth.users(id),
  approved_at     timestamptz,

  -- Receipt
  receipt_url     text,                       -- Receipt image

  -- Date
  date            date not null,

  -- Audit
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  created_by      uuid references auth.users(id)
);

create index if not exists idx_cost_travel on public.travel_costs(travel_id);
create index if not exists idx_cost_date on public.travel_costs(date desc);
create index if not exists idx_cost_type on public.travel_costs(cost_type);

drop trigger if exists trg_cost_updated_at on public.travel_costs;
create trigger trg_cost_updated_at
  before update on public.travel_costs
  for each row execute function public.travel_set_updated_at();

-- ── travel_routes ────────────────────────────────────────────────────────
create table if not exists public.travel_routes (
  id              uuid primary key default gen_random_uuid(),
  travel_id       uuid not null references travel_records(id) on delete cascade,

  -- Locations
  from_location   text not null,               -- "Chennai"
  to_location     text not null,               -- "Hyderabad"

  -- Coordinates
  from_lat        decimal(9,6) not null,
  from_lon        decimal(9,6) not null,
  to_lat          decimal(9,6) not null,
  to_lon          decimal(9,6) not null,

  -- Distance/Duration
  distance_km     integer,
  duration_hours  decimal(5,2),

  -- Transport mode
  transport_mode  text default 'car'
    check (transport_mode in ('car', 'flight', 'train', 'bus', 'other')),

  -- Travel date
  travel_date     date not null,

  -- Polyline (Google Maps encoded polyline)
  polyline        text,

  -- Audit
  created_at      timestamptz default now()
);

create index if not exists idx_route_travel on public.travel_routes(travel_id);
create index if not exists idx_route_date on public.travel_routes(travel_date);

-- ── Row Level Security ──────────────────────────────────────────────────

-- Enable RLS
alter table public.travel_records enable row level security;
alter table public.travel_schedules enable row level security;
alter table public.travel_costs enable row level security;
alter table public.travel_routes enable row level security;

-- travel_records: User sees only their own records
create policy travel_select on public.travel_records for select
  using (user_id = auth.uid());

create policy travel_insert on public.travel_records for insert
  with check (user_id = auth.uid());

create policy travel_update on public.travel_records for update
  using (user_id = auth.uid());

create policy travel_delete on public.travel_records for delete
  using (user_id = auth.uid());

-- travel_schedules: Accessible if travel_records is accessible
create policy schedule_all on public.travel_schedules for all
  using (travel_id in (
    select id from public.travel_records where user_id = auth.uid()
  ));

-- travel_costs: Accessible if travel_records is accessible
create policy cost_all on public.travel_costs for all
  using (travel_id in (
    select id from public.travel_records where user_id = auth.uid()
  ));

-- travel_routes: Accessible if travel_records is accessible
create policy route_all on public.travel_routes for all
  using (travel_id in (
    select id from public.travel_records where user_id = auth.uid()
  ));

-- ── Views (optional) ────────────────────────────────────────────────────

-- Travel cost summary (by travel)
create or replace view public.v_travel_cost_summary as
  select
    travel_id,
    count(*) as cost_count,
    sum(amount) as total_amount,
    string_agg(distinct currency, ',') as currencies,
    min(date) as first_cost_date,
    max(date) as last_cost_date
  from public.travel_costs
  group by travel_id;

-- Travel schedule count (by travel)
create or replace view public.v_travel_schedule_count as
  select
    travel_id,
    count(*) as schedule_count,
    min(date) as first_day,
    max(date) as last_day
  from public.travel_schedules
  group by travel_id;

-- Travel routes summary
create or replace view public.v_travel_route_summary as
  select
    travel_id,
    count(*) as route_count,
    sum(distance_km) as total_distance_km,
    sum(duration_hours) as total_duration_hours
  from public.travel_routes
  group by travel_id;

-- Combined travel summary
create or replace view public.v_travel_full_summary as
  select
    t.id,
    t.user_id,
    t.title,
    t.start_date,
    t.end_date,
    t.country,
    t.status,
    coalesce(cs.schedule_count, 0) as schedule_count,
    coalesce(cs.first_day, t.start_date) as first_schedule_day,
    coalesce(cs.last_day, t.end_date) as last_schedule_day,
    coalesce(cost.cost_count, 0) as cost_count,
    coalesce(cost.total_amount, 0) as total_cost_inr,
    t.total_cost_krw,
    coalesce(route.route_count, 0) as route_count,
    coalesce(route.total_distance_km, 0) as total_distance_km,
    t.created_at,
    t.updated_at
  from public.travel_records t
  left join public.v_travel_schedule_count cs on t.id = cs.travel_id
  left join public.v_travel_cost_summary cost on t.id = cost.travel_id
  left join public.v_travel_route_summary route on t.id = route.travel_id;

-- ────────────────────────────────────────────────────────────────────────
-- Notes:
-- - All tables have user_id-based RLS (users see only their own data)
-- - travel_schedules, travel_costs, travel_routes cascade on delete
-- - Views are optional (for convenience in queries)
-- - Exchange rates stored at cost creation time (for audit trail)
-- - Polyline field: Can be populated by Google Maps Directions API
-- ────────────────────────────────────────────────────────────────────────
