-- DSC FMS Portal — Asset Master schema
-- Target: Supabase Postgres (public schema for auto-generated PostgREST API)
-- Run this in: Supabase Dashboard → SQL Editor → New query → paste → Run

-- ─────────────────────────────────────────────────────────
-- 1. Reference: 15 categories (UTILITY, PROCESS, ...)
-- ─────────────────────────────────────────────────────────
create table if not exists categories (
  code text primary key,            -- '01' .. '15'
  name_en text not null,            -- 'UTILITY'
  name_ko text,                     -- '유틸리티'
  display_order int generated always as ((case when code ~ '^[0-9]+$' then code::int else 99 end)) stored
);

-- ─────────────────────────────────────────────────────────
-- 2. Reference: asset classes (sub-categories like '01.001 POWER SUPPLY')
-- ─────────────────────────────────────────────────────────
create table if not exists asset_classes (
  code text primary key,            -- '01.001', '01.001A'
  category_code text not null references categories(code),
  name_en text not null,            -- 'POWER SUPPLY FACILITY (COMMON)'
  name_ko text,
  expected_qty int                  -- per-class headcount from Excel (informational)
);

create index if not exists asset_classes_category_idx on asset_classes(category_code);

-- ─────────────────────────────────────────────────────────
-- 3. Main: assets
-- ─────────────────────────────────────────────────────────
create table if not exists assets (
  id uuid primary key default gen_random_uuid(),

  -- Identity (mirrors existing Excel master)
  asset_class_code text references asset_classes(code),     -- '01.001'
  machine_asset_code text unique,                           -- '01.001.001' numeric code
  machine_asset_number text unique not null,                -- 'DCMI-UTL-PSF-01' physical tag
  serial_no text,

  -- Naming (multilingual)
  name_en text not null,
  name_ta text,                                             -- Tamil (operator-facing)

  -- Specs
  model text,
  make text,
  year_of_manufacture int,

  -- Location
  location text,

  -- Status
  status text not null default 'active'
    check (status in ('active', 'idle', 'maintenance', 'sold', 'scrapped')),

  -- Digital extensions
  qr_payload text,                                          -- defaults to machine_asset_number
  photos text[] default '{}',                               -- Supabase Storage object URLs
  remark text,

  -- Category-specific overflow (jig/mould/robot fields, etc.)
  extra jsonb default '{}'::jsonb,

  -- Audit
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create index if not exists assets_class_idx on assets(asset_class_code);
create index if not exists assets_status_idx on assets(status);
create index if not exists assets_make_idx on assets(make);
create index if not exists assets_search_idx on assets
  using gin (to_tsvector('simple',
    coalesce(name_en, '') || ' ' ||
    coalesce(name_ta, '') || ' ' ||
    coalesce(model, '') || ' ' ||
    coalesce(make, '') || ' ' ||
    coalesce(machine_asset_number, '') || ' ' ||
    coalesce(serial_no, '')
  ));

-- updated_at trigger
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists assets_set_updated_at on assets;
create trigger assets_set_updated_at before update on assets
  for each row execute function set_updated_at();

-- default qr_payload = machine_asset_number on insert if not provided
create or replace function set_qr_payload_default() returns trigger as $$
begin
  if new.qr_payload is null or new.qr_payload = '' then
    new.qr_payload = new.machine_asset_number;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists assets_set_qr_payload on assets;
create trigger assets_set_qr_payload before insert on assets
  for each row execute function set_qr_payload_default();

-- ─────────────────────────────────────────────────────────
-- 4. Audit log (every change to an asset)
-- ─────────────────────────────────────────────────────────
create table if not exists asset_audit (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid references assets(id) on delete cascade,
  changed_at timestamptz not null default now(),
  changed_by uuid references auth.users(id),
  action text not null check (action in ('insert', 'update', 'delete', 'status_change')),
  diff jsonb                                                -- {before, after, fields_changed}
);

create index if not exists asset_audit_asset_idx on asset_audit(asset_id);
create index if not exists asset_audit_at_idx on asset_audit(changed_at desc);

-- audit trigger
create or replace function asset_audit_log() returns trigger as $$
declare
  changed_fields text[];
  before_json jsonb;
  after_json jsonb;
begin
  if (tg_op = 'INSERT') then
    insert into asset_audit (asset_id, changed_by, action, diff)
    values (new.id, new.created_by, 'insert', jsonb_build_object('after', to_jsonb(new)));
    return new;

  elsif (tg_op = 'UPDATE') then
    before_json = to_jsonb(old);
    after_json = to_jsonb(new);
    select array_agg(key) into changed_fields
      from jsonb_each(before_json) o
      where (after_json -> o.key) is distinct from o.value
        and key not in ('updated_at', 'updated_by');
    if changed_fields is null or array_length(changed_fields, 1) = 0 then
      return new;  -- no real change
    end if;
    insert into asset_audit (asset_id, changed_by, action, diff)
    values (
      new.id,
      new.updated_by,
      case when 'status' = any(changed_fields) then 'status_change' else 'update' end,
      jsonb_build_object(
        'before', before_json,
        'after', after_json,
        'fields_changed', changed_fields
      )
    );
    return new;

  elsif (tg_op = 'DELETE') then
    insert into asset_audit (asset_id, changed_by, action, diff)
    values (old.id, old.updated_by, 'delete', jsonb_build_object('before', to_jsonb(old)));
    return old;
  end if;
  return null;
end;
$$ language plpgsql;

drop trigger if exists assets_audit on assets;
create trigger assets_audit
  after insert or update or delete on assets
  for each row execute function asset_audit_log();

-- ─────────────────────────────────────────────────────────
-- 5. RLS — basic policy: any authenticated user can read & write
--    (refine later when role system is added)
-- ─────────────────────────────────────────────────────────
alter table categories enable row level security;
alter table asset_classes enable row level security;
alter table assets enable row level security;
alter table asset_audit enable row level security;

drop policy if exists "auth_read_categories" on categories;
create policy "auth_read_categories" on categories
  for select to authenticated using (true);
drop policy if exists "auth_read_classes" on asset_classes;
create policy "auth_read_classes" on asset_classes
  for select to authenticated using (true);
drop policy if exists "auth_all_assets" on assets;
create policy "auth_all_assets" on assets
  for all to authenticated using (true) with check (true);
drop policy if exists "auth_read_audit" on asset_audit;
create policy "auth_read_audit" on asset_audit
  for select to authenticated using (true);
-- writes to asset_audit are trigger-only, no policy needed for INSERT from app
