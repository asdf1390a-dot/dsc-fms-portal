-- ─────────────────────────────────────────────────────────
-- Asset Master v2 Phase 2 — Migration
-- Scope: Import batches + validation tracking + enhanced indexes
-- Created: 2026-05-16 09:00 KST
-- ─────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════
-- Phase 2: 신규 테이블 (Import Batches & Items)
-- ═══════════════════════════════════════════════════════════

-- 1. asset_import_batches — Excel 배치 추적
create table if not exists public.asset_import_batches (
  id uuid primary key default gen_random_uuid(),

  -- 배치 메타
  batch_name text not null,
  batch_date date default current_date,

  -- 파일 정보
  file_name text,
  file_size_bytes int,
  file_hash text,

  -- 진행 상태
  status text default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  total_rows int,
  processed_count int default 0,
  success_count int default 0,
  error_count int default 0,

  -- 결과
  import_result jsonb,

  -- 메타
  org_id uuid references organizations(id),
  created_at timestamptz default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz default now(),
  updated_by uuid references auth.users(id)
);

create index if not exists asset_import_batches_status_idx
  on asset_import_batches(status);
create index if not exists asset_import_batches_created_at_idx
  on asset_import_batches(created_at desc);
create index if not exists asset_import_batches_file_hash_idx
  on asset_import_batches(file_hash);
create index if not exists asset_import_batches_org_id_idx
  on asset_import_batches(org_id);

-- P0-3: RLS 정책
alter table asset_import_batches enable row level security;

create policy "auth_all_import_batches" on asset_import_batches
  for all to authenticated
  using (org_id = (auth.jwt() ->> 'org_id')::uuid)
  with check (org_id = (auth.jwt() ->> 'org_id')::uuid);

-- ─────────────────────────────────────────────────────────

-- 2. asset_import_items — 각 행의 검증 상태
create table if not exists public.asset_import_items (
  id uuid primary key default gen_random_uuid(),

  -- 배치 링크
  batch_id uuid not null references asset_import_batches(id) on delete cascade,

  -- 행 번호 & 상태
  row_number int not null,
  status text default 'pending' check (status in ('pending', 'validating', 'success', 'error', 'skipped')),

  -- 원본 데이터 (JSON)
  raw_data jsonb not null,

  -- 검증 결과
  validation_errors text[],
  validation_warnings text[],

  -- 처리 결과
  asset_id uuid references assets(id),
  action text check (action in ('create', 'update', 'skip')),

  -- 메타
  created_at timestamptz default now(),
  processed_at timestamptz
);

create index if not exists asset_import_items_batch_idx
  on asset_import_items(batch_id);
create index if not exists asset_import_items_status_idx
  on asset_import_items(status);
create index if not exists asset_import_items_asset_idx
  on asset_import_items(asset_id);
create index if not exists asset_import_items_batch_status_idx
  on asset_import_items(batch_id, status);

-- P0-3: RLS 정책
alter table asset_import_items enable row level security;

create policy "auth_all_import_items" on asset_import_items
  for all to authenticated
  using (
    batch_id in (
      select id from asset_import_batches
      where org_id = (auth.jwt() ->> 'org_id')::uuid
    )
  )
  with check (
    batch_id in (
      select id from asset_import_batches
      where org_id = (auth.jwt() ->> 'org_id')::uuid
    )
  );

-- ═══════════════════════════════════════════════════════════
-- Phase 2: 기존 assets 테이블 — 신규 인덱스 추가
-- ═══════════════════════════════════════════════════════════

-- P0-1: 인덱스 충돌 해결
-- 기존 인덱스 (01_schema.sql에 있음):
--   - assets_status_idx (이미 존재)
--   - assets_search_idx (이미 존재, FTS)
-- 신규 추가 인덱스만 생성 (IF NOT EXISTS)

create index if not exists assets_location_idx
  on assets(location);

create index if not exists assets_updated_at_idx
  on assets(updated_at desc);

create index if not exists assets_class_code_idx
  on assets(asset_class_code);

-- Excel 헤더 검증 (P0-2 수정):
-- machine_asset_number (UNIQUE constraint 이미 존재)
-- name_en (NOT NULL, 이미 존재)
-- name_ta (컬럼 이미 존재, 인덱스 추가 검토)
-- model, make, year_of_manufacture, asset_class_code (모두 이미 존재)
-- serial_no (이미 존재)
-- location (이미 존재)
-- status (이미 존재)
-- remark (이미 존재)

-- ═══════════════════════════════════════════════════════════
-- Supabase RPC 함수 (대량 처리 최적화)
-- ═══════════════════════════════════════════════════════════

-- bulk_insert_assets: Excel 대량 입력 (트랜잭션)
create or replace function public.bulk_insert_assets(
  p_batch_id uuid,
  p_items_data jsonb
)
returns jsonb
language plpgsql
as $$
declare
  v_result jsonb := '{"success": 0, "errors": 0, "details": []}'::jsonb;
  v_item_id uuid;
  v_asset_id uuid;
  v_machine_asset_number text;
  v_error text;
begin
  -- 배치 상태 업데이트: pending → processing
  update asset_import_batches
  set status = 'processing', updated_at = now()
  where id = p_batch_id;

  -- 각 item 처리 (jsonb 배열)
  for v_item in select * from jsonb_to_recordset(p_items_data) as x(
    item_id uuid,
    row_number int,
    machine_asset_number text,
    name_en text,
    name_ta text,
    asset_class_code text,
    location text,
    status text,
    model text,
    make text,
    serial_no text,
    year_of_manufacture int,
    remark text
  ) loop
    begin
      -- 자산 생성
      insert into public.assets (
        machine_asset_number, name_en, name_ta, asset_class_code,
        location, status, model, make, serial_no, year_of_manufacture, remark,
        created_by, updated_by
      )
      values (
        v_item.machine_asset_number, v_item.name_en, v_item.name_ta, v_item.asset_class_code,
        v_item.location, v_item.status, v_item.model, v_item.make, v_item.serial_no, v_item.year_of_manufacture, v_item.remark,
        auth.uid(), auth.uid()
      )
      returning id into v_asset_id;

      -- item 업데이트: success
      update asset_import_items
      set
        status = 'success',
        asset_id = v_asset_id,
        action = 'create',
        processed_at = now()
      where id = v_item.item_id;

      v_result := jsonb_set(v_result, '{success}', ((v_result->>'success')::int + 1)::text::jsonb);

    exception when others then
      v_error := sqlerrm;

      -- item 업데이트: error
      update asset_import_items
      set
        status = 'error',
        validation_errors = array[v_error],
        processed_at = now()
      where id = v_item.item_id;

      v_result := jsonb_set(v_result, '{errors}', ((v_result->>'errors')::int + 1)::text::jsonb);
      v_result := jsonb_set(v_result, '{details}',
        v_result->'details' || jsonb_build_object('row', v_item.row_number, 'error', v_error));
    end;
  end loop;

  -- 배치 상태 업데이트: processing → completed
  update asset_import_batches
  set
    status = 'completed',
    processed_count = (v_result->>'success')::int + (v_result->>'errors')::int,
    success_count = (v_result->>'success')::int,
    error_count = (v_result->>'errors')::int,
    import_result = v_result,
    updated_at = now()
  where id = p_batch_id;

  return v_result;
end;
$$;

-- ═══════════════════════════════════════════════════════════
-- Audit & Logging (REMOVED)
-- ═══════════════════════════════════════════════════════════

-- B2-BLOCKER FIX: audit trigger 제거
-- 원인: asset_audit 스키마 불일치
--   - 설계: (table_name, record_id, operation, old_values, new_values, change_description)
--   - 기존: (asset_id, changed_at, changed_by, action, diff)
-- 해결: 기존 asset_audit_log() 함수 재사용 (01_schema.sql에서)
--
-- import_batches/items는 RLS 정책으로만 관리
-- 필요시 별도 audit 테이블 생성 (이후 단계)

-- ═══════════════════════════════════════════════════════════
-- Cleanup & Validation
-- ═══════════════════════════════════════════════════════════

-- 1. 마이그레이션 체크: 기존 인덱스 확인
-- verify command (run in SQL Editor to check):
-- SELECT indexname FROM pg_indexes WHERE tablename='assets' AND indexname LIKE 'assets_%';
-- Expected: assets_status_idx, assets_search_idx, assets_location_idx, assets_updated_at_idx, etc.

-- 2. RLS 활성화 확인
-- SELECT tablename FROM pg_tables WHERE tablename IN ('asset_import_batches', 'asset_import_items');
-- Then verify: SELECT schemaname, tablename FROM pg_tables WHERE rowsecurity = true;

-- ═══════════════════════════════════════════════════════════
-- Done
-- ═══════════════════════════════════════════════════════════
-- Run this script in Supabase SQL Editor to apply Phase 2 schema
