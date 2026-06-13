-- ════════════════════════════════════════════════════════════════════════════
-- Asset Master Phase 3 — Detail Page Support
--
-- Tables:
--   1. asset_edit_history   — per-field change timeline for the detail page
--   2. asset_disposals      — disposal tracking (already partly covered by
--                             columns on assets, this gives a normalized log)
--
-- Run in: Supabase SQL Editor
-- Idempotent: yes (uses IF NOT EXISTS / DROP+CREATE for policies)
--
-- Note: db/30 slot is occupied by 30_portfolio_career.sql and 30_travel_phase2.sql.
-- This Phase 3 schema is filed at db/46 (next free slot).
-- ════════════════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────────────────
-- 1. asset_edit_history
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.asset_edit_history (
  id           uuid primary key default gen_random_uuid(),
  asset_id     uuid not null references public.assets(id) on delete cascade,
  field_name   text not null,
  old_value    text,
  new_value    text,
  changed_by   uuid references auth.users(id) on delete set null,
  changed_at   timestamptz not null default now(),
  note         text
);

create index if not exists idx_asset_edit_history_asset_changed
  on public.asset_edit_history(asset_id, changed_at desc);
create index if not exists idx_asset_edit_history_changed_by
  on public.asset_edit_history(changed_by);

alter table public.asset_edit_history enable row level security;

drop policy if exists "aeh_select_all" on public.asset_edit_history;
drop policy if exists "aeh_insert_auth" on public.asset_edit_history;

-- Read: anon + authenticated (matches existing asset read pattern)
create policy "aeh_select_all" on public.asset_edit_history
  for select using (true);

-- Insert: authenticated users only
create policy "aeh_insert_auth" on public.asset_edit_history
  for insert with check (auth.role() = 'authenticated');

-- ────────────────────────────────────────────────────────────────────────────
-- 2. asset_disposals
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.asset_disposals (
  id              uuid primary key default gen_random_uuid(),
  asset_id        uuid not null references public.assets(id) on delete cascade,
  disposal_reason text not null,
  disposal_price  numeric,
  buyer_name      text,
  buyer_contact   text,
  disposed_at     timestamptz not null default now(),
  disposed_by     uuid references auth.users(id) on delete set null,
  note            text,
  disposal_certificate_url text,
  created_at      timestamptz not null default now()
);

-- Phase 3-3: idempotently add disposal_certificate_url if table existed without it
alter table public.asset_disposals
  add column if not exists disposal_certificate_url text;

create index if not exists idx_asset_disposals_asset
  on public.asset_disposals(asset_id, disposed_at desc);

alter table public.asset_disposals enable row level security;

drop policy if exists "ad_select_all" on public.asset_disposals;
drop policy if exists "ad_insert_auth" on public.asset_disposals;

create policy "ad_select_all" on public.asset_disposals
  for select using (true);

create policy "ad_insert_auth" on public.asset_disposals
  for insert with check (auth.role() = 'authenticated');

-- ════════════════════════════════════════════════════════════════════════════
-- Verification
-- ════════════════════════════════════════════════════════════════════════════
-- SELECT table_name FROM information_schema.tables
--  WHERE table_schema = 'public'
--    AND table_name IN ('asset_edit_history','asset_disposals');
