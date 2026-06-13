-- 35_bm_p1_consolidated.sql
-- BM-P1: Breakdown Management Phase 1 — consolidated/idempotent migration
-- 작성: 2026-06-01
--
-- 목적:
--   • 04/11/12/14/33 마이그레이션 누적 결과를 최종 보강
--   • bm_events 누락 컬럼 추가 (action_taken / cause / symptom / symptom_ta /
--     resolved_by / resolver_name / technician_id / photos / downtime_minutes / severity)
--   • severity_idx / resolved_at_idx / asset_month_idx 3개 인덱스 보강
--   • RLS 정책 auth_all_bm_events 보장
--   • Storage bucket 'bm-photos' 보장 (public read / authenticated write)
--
-- 실행 위치: Supabase SQL Editor (service_role)
-- 멱등성: 모든 변경은 IF NOT EXISTS / DROP IF EXISTS 사용 — 반복 실행 안전

-- ═══════════════════════════════════════════════════════
-- 1. bm_events 컬럼 보강
-- ═══════════════════════════════════════════════════════
ALTER TABLE bm_events
  ADD COLUMN IF NOT EXISTS action_taken   text,
  ADD COLUMN IF NOT EXISTS cause          text,
  ADD COLUMN IF NOT EXISTS symptom        text,
  ADD COLUMN IF NOT EXISTS symptom_ta     text,
  ADD COLUMN IF NOT EXISTS resolved_by    uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS resolver_name  text,
  ADD COLUMN IF NOT EXISTS technician_id  uuid,
  ADD COLUMN IF NOT EXISTS photos         text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS severity       text DEFAULT 'normal';

-- technician_id FK (technicians 테이블 존재 시)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'technicians') THEN
    ALTER TABLE bm_events DROP CONSTRAINT IF EXISTS bm_events_technician_id_fkey;
    ALTER TABLE bm_events
      ADD CONSTRAINT bm_events_technician_id_fkey
      FOREIGN KEY (technician_id)
      REFERENCES technicians(id)
      ON DELETE SET NULL;
  END IF;
END$$;

-- severity CHECK 제약 (drop 후 재생성)
ALTER TABLE bm_events DROP CONSTRAINT IF EXISTS bm_events_severity_check;
ALTER TABLE bm_events
  ADD CONSTRAINT bm_events_severity_check
    CHECK (severity IN ('minor','normal','major','line_down'));

-- status CHECK 제약 (wontfix 허용)
ALTER TABLE bm_events DROP CONSTRAINT IF EXISTS bm_events_status_check;
ALTER TABLE bm_events
  ADD CONSTRAINT bm_events_status_check
    CHECK (status IN ('open','in_progress','pending_parts','resolved','cancelled','wontfix'));

-- ═══════════════════════════════════════════════════════
-- 2. downtime_minutes (GENERATED ALWAYS AS)
--    downtime_end - downtime_start 으로 계산
--    null 폴백: resolved_at - reported_at
-- ═══════════════════════════════════════════════════════
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'bm_events' AND column_name = 'downtime_minutes'
  ) THEN
    ALTER TABLE bm_events
      ADD COLUMN downtime_minutes integer
        GENERATED ALWAYS AS (
          CASE
            WHEN downtime_end IS NOT NULL AND downtime_start IS NOT NULL
              THEN (EXTRACT(EPOCH FROM (downtime_end - downtime_start))::integer / 60)
            WHEN resolved_at IS NOT NULL AND reported_at IS NOT NULL
              THEN (EXTRACT(EPOCH FROM (resolved_at - reported_at))::integer / 60)
            ELSE NULL
          END
        ) STORED;
  END IF;
END$$;

-- ═══════════════════════════════════════════════════════
-- 3. 인덱스 보강 (3개 신규)
-- ═══════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS bm_events_severity_idx
  ON bm_events(severity);

CREATE INDEX IF NOT EXISTS bm_events_resolved_at_idx
  ON bm_events(resolved_at DESC);

CREATE INDEX IF NOT EXISTS bm_events_asset_month_idx
  ON bm_events(asset_id, DATE_TRUNC('month', reported_at));

-- ═══════════════════════════════════════════════════════
-- 4. RLS 정책 보장
-- ═══════════════════════════════════════════════════════
ALTER TABLE bm_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all_bm_events" ON bm_events;
CREATE POLICY "auth_all_bm_events" ON bm_events
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- ═══════════════════════════════════════════════════════
-- 5. Storage bucket: bm-photos
--    public read / authenticated write
-- ═══════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'bm-photos',
  'bm-photos',
  true,
  10485760,  -- 10MB per file
  ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/heic']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 정책: anyone can read
DROP POLICY IF EXISTS "bm_photos_public_read" ON storage.objects;
CREATE POLICY "bm_photos_public_read"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'bm-photos');

-- 정책: authenticated can upload
DROP POLICY IF EXISTS "bm_photos_auth_insert" ON storage.objects;
CREATE POLICY "bm_photos_auth_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'bm-photos');

-- 정책: authenticated can update/delete own
DROP POLICY IF EXISTS "bm_photos_auth_update" ON storage.objects;
CREATE POLICY "bm_photos_auth_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'bm-photos');

DROP POLICY IF EXISTS "bm_photos_auth_delete" ON storage.objects;
CREATE POLICY "bm_photos_auth_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'bm-photos');

-- ═══════════════════════════════════════════════════════
-- 6. 검증
-- ═══════════════════════════════════════════════════════
DO $$
DECLARE
  v_cols      text;
  v_idx       integer;
  v_bucket    integer;
BEGIN
  SELECT string_agg(column_name, ', ' ORDER BY column_name)
    INTO v_cols
    FROM information_schema.columns
   WHERE table_name = 'bm_events'
     AND column_name IN (
       'action_taken','cause','symptom','symptom_ta',
       'resolved_by','resolver_name','technician_id',
       'photos','downtime_minutes','severity'
     );

  SELECT COUNT(*) INTO v_idx
    FROM pg_indexes
   WHERE tablename = 'bm_events'
     AND indexname IN (
       'bm_events_severity_idx',
       'bm_events_resolved_at_idx',
       'bm_events_asset_month_idx'
     );

  SELECT COUNT(*) INTO v_bucket
    FROM storage.buckets
   WHERE id = 'bm-photos';

  RAISE NOTICE '=== 35_bm_p1_consolidated 완료 ===';
  RAISE NOTICE 'bm_events 보강 컬럼: %', v_cols;
  RAISE NOTICE '신규 인덱스: %/3 적용', v_idx;
  RAISE NOTICE 'bm-photos bucket: %', CASE WHEN v_bucket = 1 THEN '✅ 존재' ELSE '❌ 누락' END;
END$$;
