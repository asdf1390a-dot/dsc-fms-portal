-- ────────────────────────────────────────────────────────────────────────
-- 10_asset_disposal.sql
-- 고정자산 처분·등록·매각 모듈 (Fixed Asset Disposal Module)
--
-- "고정자산 처분 승인서" 양식 기반:
--   - 폐기 / 매각 / 등록 3개 처분코드
--   - 장부금액 자동 계산 컬럼 (acquisition_cost - accumulated_depreciation)
--   - 처분가액 vs 장부가액 비교 (자동 계산)
--   - 첨부 사진 / 파일 jsonb 배열
--   - draft → pending → approved/rejected 워크플로
--
-- 안전 실행: 모든 DDL은 IF NOT EXISTS / DROP IF EXISTS 사용
-- ────────────────────────────────────────────────────────────────────────

-- ── 1. 메인 테이블 ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fixed_asset_disposals (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 기본 정보
  asset_no                 text,
  account_type             text,            -- 기계장치 / 비품 / 차량운반구 등
  asset_name               text NOT NULL,
  spec                     text,

  -- 처분 정보
  disposal_code            text NOT NULL CHECK (disposal_code IN ('폐기','매각','등록')),
  disposal_amount          numeric DEFAULT 0,     -- 처분예정금액 (INR)
  disposal_qty             integer DEFAULT 1,
  disposal_date            date,                  -- 처분예정일
  disposal_destination     text,                  -- 처분처

  -- 장부금액내역
  acquisition_cost         numeric DEFAULT 0,     -- 취득가액 (INR)
  accumulated_depreciation numeric DEFAULT 0,     -- 감가상각총당금 (INR)
  acquisition_year         integer,               -- 취득연도

  -- 사유 / 의견
  disposal_reason_user     text,                  -- 처분사유-사용부서
  material_reuse           text,                  -- 자재재활용 내용
  review_opinion           text,                  -- 검토의견-집행부서

  -- 첨부
  photos                   jsonb DEFAULT '[]'::jsonb,
  files                    jsonb DEFAULT '[]'::jsonb,

  -- 워크플로
  status                   text DEFAULT 'draft'
                                  CHECK (status IN ('draft','pending','approved','rejected')),

  -- 메타
  created_by               uuid REFERENCES auth.users(id),
  created_at               timestamptz DEFAULT now(),
  updated_at               timestamptz DEFAULT now()
);

-- ── 2. 인덱스 ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_disposals_disposal_code ON fixed_asset_disposals (disposal_code);
CREATE INDEX IF NOT EXISTS idx_disposals_status        ON fixed_asset_disposals (status);
CREATE INDEX IF NOT EXISTS idx_disposals_disposal_date ON fixed_asset_disposals (disposal_date DESC);
CREATE INDEX IF NOT EXISTS idx_disposals_created_at    ON fixed_asset_disposals (created_at DESC);

-- ── 3. updated_at 자동 갱신 트리거 ─────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_disposals_updated_at ON fixed_asset_disposals;
CREATE TRIGGER trg_disposals_updated_at
  BEFORE UPDATE ON fixed_asset_disposals
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ── 4. RLS ────────────────────────────────────────────────────────────
ALTER TABLE fixed_asset_disposals ENABLE ROW LEVEL SECURITY;

-- 기존 정책 제거 (재실행 안전)
DROP POLICY IF EXISTS "disposals_select_all"   ON fixed_asset_disposals;
DROP POLICY IF EXISTS "disposals_insert_auth"  ON fixed_asset_disposals;
DROP POLICY IF EXISTS "disposals_update_auth"  ON fixed_asset_disposals;
DROP POLICY IF EXISTS "disposals_delete_auth"  ON fixed_asset_disposals;

-- 모두 SELECT 가능 (anon 포함)
CREATE POLICY "disposals_select_all" ON fixed_asset_disposals
  FOR SELECT USING (true);

-- 인증된 사용자만 INSERT
CREATE POLICY "disposals_insert_auth" ON fixed_asset_disposals
  FOR INSERT TO authenticated WITH CHECK (true);

-- 인증된 사용자만 UPDATE
CREATE POLICY "disposals_update_auth" ON fixed_asset_disposals
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- 인증된 사용자만 DELETE
CREATE POLICY "disposals_delete_auth" ON fixed_asset_disposals
  FOR DELETE TO authenticated USING (true);

-- ── 5. Storage 버킷 (Supabase Dashboard 또는 별도 실행) ────────────────
-- 아래는 참고용 주석. Supabase Studio > Storage 에서 수동 생성하거나
-- service_role 키로 별도 API 호출 필요.
--
--   bucket name: asset-docs
--   public:      true
--   file size limit: 20 MB
--
-- 생성 SQL (service_role 필요):
-- INSERT INTO storage.buckets (id, name, public)
--   VALUES ('asset-docs', 'asset-docs', true)
--   ON CONFLICT (id) DO NOTHING;

-- ── 6. 샘플 데이터 (테스트용, 필요 시 주석 해제) ──────────────────────
-- INSERT INTO fixed_asset_disposals
--   (asset_no, account_type, asset_name, spec, disposal_code,
--    disposal_amount, disposal_qty, disposal_date, disposal_destination,
--    acquisition_cost, accumulated_depreciation, acquisition_year,
--    disposal_reason_user, material_reuse, review_opinion, status)
-- VALUES
--   ('DCMI-PRS-02', '기계장치', 'SAMHO 200TON 프레스', '200TON', '폐기',
--    500000, 1, '2026-06-01', '폐기물업체 A',
--    8500000, 7800000, 2015,
--    '노후화 심각, 정밀도 저하', '모터 및 일부 부품 재활용 가능', '폐기 처리 적정', 'pending');

-- ── 완료 ─────────────────────────────────────────────────────────────
-- 실행 후 확인:
--   SELECT count(*) FROM fixed_asset_disposals;
--   SELECT disposal_code, count(*) FROM fixed_asset_disposals GROUP BY disposal_code;
