-- Asset Master v2 — QR Scanning and Incremental Features
-- Applied after: 01_schema.sql (assets table)
-- Goal: Add QR scan logging without changing existing asset structure
-- Preserves all 506 existing assets + FK chains (BM/PM/Disposal)

-- ============================================================
-- 1. New Table: asset_qr_scans — QR scan audit trail
-- ============================================================

create table if not exists public.asset_qr_scans (
  id uuid primary key default gen_random_uuid(),

  -- Link to asset
  asset_id uuid not null references assets(id) on delete cascade,

  -- QR code data
  qr_payload text not null,

  -- Scan metadata
  scanned_at timestamptz not null default now(),
  scanned_by uuid references auth.users(id),
  device_info text,        -- Mobile/Tablet device identifier
  location_gps text        -- Optional GPS coordinates (lat,lon)
);

-- Indexes for common queries
create index if not exists asset_qr_scans_asset_idx on asset_qr_scans(asset_id);
create index if not exists asset_qr_scans_payload_idx on asset_qr_scans(qr_payload);
create index if not exists asset_qr_scans_scanned_at_idx on asset_qr_scans(scanned_at desc);

-- ============================================================
-- 2. RLS Policy for asset_qr_scans
-- ============================================================

alter table public.asset_qr_scans enable row level security;

drop policy if exists "auth_all_qr_scans" on asset_qr_scans;
create policy "auth_all_qr_scans" on asset_qr_scans
  for all to authenticated using (true) with check (true);

-- ============================================================
-- 3. Verification: existing asset structure unchanged
-- ============================================================
-- The following should all remain as-is:
-- - assets table: all existing columns (id, asset_class_code, etc.)
-- - asset_classes, categories tables: unchanged
-- - asset_audit triggers: continue to work
-- - FK chains: BM_history, PM_schedule, asset_disposal all still reference assets(id)

-- To verify after apply:
-- SELECT COUNT(*) FROM assets;  -- should be 506 (or existing count)
-- SELECT COUNT(*) FROM asset_qr_scans;  -- should be 0 (newly created)
-- SELECT constraint_name FROM information_schema.table_constraints
--   WHERE table_name='assets' AND constraint_type='FOREIGN KEY';
