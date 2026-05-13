-- ────────────────────────────────────────────────────────────────────────
-- 20_asset_attachments.sql
-- 고정자산·처분 첨부파일 통합 이력 테이블
--
-- 목적:
--   - 자산 등록·매각·폐기 과정의 사진/파일 첨부 이력 통합 관리
--   - 누가·언제·무엇을 첨부했는지 감사 추적 (audit trail)
--   - 현황 페이지에서 첨부 통계 집계
--
-- 관계:
--   asset_id     → assets.id              (등록·일반 자산용, nullable)
--   disposal_id  → fixed_asset_disposals.id (매각·폐기 처분용, nullable)
--   둘 중 하나는 반드시 NOT NULL (CHECK 제약)
--
-- 안전 실행: CREATE IF NOT EXISTS / DROP IF EXISTS
-- ────────────────────────────────────────────────────────────────────────

-- ── 1. 테이블 ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS asset_attachments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 관계 (둘 중 하나)
  asset_id     uuid REFERENCES assets(id) ON DELETE CASCADE,
  disposal_id  uuid REFERENCES fixed_asset_disposals(id) ON DELETE CASCADE,

  -- 파일 정보
  file_url     text NOT NULL,
  file_name    text NOT NULL,
  file_type    text,                          -- MIME type (image/jpeg, application/pdf …)
  file_size    bigint,                        -- bytes
  storage_path text,                          -- 버킷 내 경로 (삭제 용)

  -- 분류
  kind         text DEFAULT 'attachment'
                    CHECK (kind IN ('photo','attachment')),
  context      text DEFAULT 'register'
                    CHECK (context IN ('register','sale','scrap','other')),

  -- 메타
  uploaded_by  uuid REFERENCES auth.users(id),
  created_at   timestamptz DEFAULT now(),

  -- 최소 하나의 관계 필수
  CONSTRAINT attachment_has_target
    CHECK (asset_id IS NOT NULL OR disposal_id IS NOT NULL)
);

-- ── 2. 인덱스 ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_attachments_asset_id    ON asset_attachments (asset_id);
CREATE INDEX IF NOT EXISTS idx_attachments_disposal_id ON asset_attachments (disposal_id);
CREATE INDEX IF NOT EXISTS idx_attachments_created_at  ON asset_attachments (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_attachments_context     ON asset_attachments (context);

-- ── 3. RLS ────────────────────────────────────────────────────────────
ALTER TABLE asset_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attachments_select_all"   ON asset_attachments;
DROP POLICY IF EXISTS "attachments_insert_auth"  ON asset_attachments;
DROP POLICY IF EXISTS "attachments_delete_auth"  ON asset_attachments;

-- 모두 SELECT 가능
CREATE POLICY "attachments_select_all" ON asset_attachments
  FOR SELECT USING (true);

-- 인증된 사용자만 INSERT
CREATE POLICY "attachments_insert_auth" ON asset_attachments
  FOR INSERT TO authenticated WITH CHECK (true);

-- 인증된 사용자만 DELETE (uploader 본인 또는 admin role)
CREATE POLICY "attachments_delete_auth" ON asset_attachments
  FOR DELETE TO authenticated USING (
    uploaded_by = auth.uid()
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- ── 4. Storage 버킷 ──────────────────────────────────────────────────
-- service_role 키로 실행 필요. Supabase Studio > Storage에서 수동 생성도 가능.
INSERT INTO storage.buckets (id, name, public)
  VALUES ('asset-attachments', 'asset-attachments', true)
  ON CONFLICT (id) DO NOTHING;

-- ── 완료 ─────────────────────────────────────────────────────────────
-- 확인:
--   SELECT count(*) FROM asset_attachments;
--   SELECT context, count(*) FROM asset_attachments GROUP BY context;
--   SELECT * FROM storage.buckets WHERE id = 'asset-attachments';
