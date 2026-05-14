-- DSC FMS Portal — Asset Master Phase 1: Document Management & Disposal
-- Target: Supabase Postgres
-- Run this in: Supabase Dashboard → SQL Editor → New query → paste → Run
-- Prerequisite: 01_schema.sql must be executed first

-- ─────────────────────────────────────────────────────────
-- 1. Extend assets table with disposal fields
-- ─────────────────────────────────────────────────────────
alter table assets add column if not exists disposal_reason text;      -- '노후화', '폐기', '기타'
alter table assets add column if not exists disposal_price numeric;    -- 매각 가격
alter table assets add column if not exists buyer_name text;           -- 구매자명
alter table assets add column if not exists buyer_contact text;        -- 구매자 연락처
alter table assets add column if not exists disposed_at timestamptz;   -- 매각 일시

-- ─────────────────────────────────────────────────────────
-- 2. Create asset_documents table for file management
-- ─────────────────────────────────────────────────────────
create table if not exists asset_documents (
  id uuid primary key default gen_random_uuid(),

  -- Reference
  asset_id uuid not null references assets(id) on delete cascade,

  -- File info
  document_type text not null check (document_type in ('photo', 'proof', 'invoice', 'other')),
  filename text not null,
  file_url text not null,  -- Supabase Storage URL
  file_size int,           -- bytes
  mime_type text,

  -- Metadata
  uploaded_at timestamptz not null default now(),
  uploaded_by uuid references auth.users(id),

  -- Audit
  created_at timestamptz not null default now()
);

-- Indexes for performance
create index if not exists asset_documents_asset_idx on asset_documents(asset_id);
create index if not exists asset_documents_type_idx on asset_documents(document_type);
create index if not exists asset_documents_created_idx on asset_documents(created_at desc);

-- ─────────────────────────────────────────────────────────
-- 3. RLS for asset_documents
-- ─────────────────────────────────────────────────────────
alter table asset_documents enable row level security;

drop policy if exists "auth_read_documents" on asset_documents;
create policy "auth_read_documents" on asset_documents
  for select to authenticated using (true);

drop policy if exists "auth_write_documents" on asset_documents
  for insert to authenticated with check (true);

drop policy if exists "auth_delete_documents" on asset_documents
  for delete to authenticated using (true);

-- ─────────────────────────────────────────────────────────
-- 4. Audit log extension for disposal actions
-- ─────────────────────────────────────────────────────────
-- No changes needed; existing asset_audit trigger will capture status changes

-- ─────────────────────────────────────────────────────────
-- 5. Verify constraints
-- ─────────────────────────────────────────────────────────
-- asset_documents depends on assets(id)
-- assets now has disposal columns and references to documents via implicit relationship
