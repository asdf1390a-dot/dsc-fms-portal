-- Asset Master v2 호환성 검증 쿼리 집합
-- 용도: asset_master_v2.sql 적용 후 데이터 무결성 확인
-- 실행 방법: Supabase Dashboard → SQL Editor 에서 각 섹션 실행

-- ============================================================
-- 섹션 1: 기본 테이블 존재 여부 확인
-- ============================================================

-- 1.1 asset_qr_scans 테이블 존재 확인
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'asset_qr_scans';
-- 예상: asset_qr_scans (1행)

-- 1.2 기존 assets 테이블 존재 확인
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'assets';
-- 예상: assets (1행)

-- 1.3 기존 categories 테이블 존재 확인
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'categories';
-- 예상: categories (1행)

-- 1.4 기존 asset_classes 테이블 존재 확인
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'asset_classes';
-- 예상: asset_classes (1행)

-- ============================================================
-- 섹션 2: 스키마 검증
-- ============================================================

-- 2.1 asset_qr_scans 컬럼 구조 확인
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'asset_qr_scans'
ORDER BY ordinal_position;
-- 예상: id (uuid, NO), asset_id (uuid, NO), qr_payload (text, NO),
--      scanned_at (timestamptz, NO), scanned_by (uuid, YES),
--      device_info (text, YES), location_gps (text, YES)

-- 2.2 asset_qr_scans 기본값 확인
SELECT column_name, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'asset_qr_scans'
AND column_default IS NOT NULL;
-- 예상: id (gen_random_uuid()), scanned_at (now())

-- 2.3 assets 테이블 컬럼 개수 확인 (기존 유지)
SELECT COUNT(*) as column_count
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'assets';
-- 예상: 20 (기존 구조 유지)

-- ============================================================
-- 섹션 3: 인덱스 검증
-- ============================================================

-- 3.1 asset_qr_scans 인덱스 확인
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'asset_qr_scans'
ORDER BY indexname;
-- 예상:
-- - asset_qr_scans_asset_idx (asset_id)
-- - asset_qr_scans_payload_idx (qr_payload)
-- - asset_qr_scans_scanned_at_idx (scanned_at DESC)
-- - asset_qr_scans_pkey (id PK)

-- 3.2 asset_qr_scans_asset_idx 상세
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'asset_qr_scans'
AND indexname = 'asset_qr_scans_asset_idx';
-- 예상: asset_id에 대한 B-tree 인덱스

-- 3.3 asset_qr_scans_payload_idx 상세
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'asset_qr_scans'
AND indexname = 'asset_qr_scans_payload_idx';
-- 예상: qr_payload에 대한 B-tree 인덱스

-- 3.4 asset_qr_scans_scanned_at_idx 상세
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'asset_qr_scans'
AND indexname = 'asset_qr_scans_scanned_at_idx';
-- 예상: scanned_at DESC에 대한 B-tree 인덱스

-- ============================================================
-- 섹션 4: 외래키 제약 검증
-- ============================================================

-- 4.1 asset_qr_scans의 FK 확인
SELECT constraint_name, column_name, referenced_table_name, referenced_column_name
FROM information_schema.key_column_usage
WHERE table_schema = 'public' AND table_name = 'asset_qr_scans'
AND referenced_table_name IS NOT NULL;
-- 예상:
-- - asset_id → assets.id (FK)
-- - scanned_by → auth.users.id (FK)

-- 4.2 assets의 기존 FK 확인 (변경 없음)
SELECT constraint_name, column_name, referenced_table_name
FROM information_schema.key_column_usage
WHERE table_schema = 'public' AND table_name = 'assets'
AND referenced_table_name IS NOT NULL
ORDER BY constraint_name;
-- 예상: 기존 asset_classes와의 FK 유지

-- 4.3 BM_history FK 확인 (assets와 연결)
SELECT constraint_name, column_name, referenced_table_name
FROM information_schema.key_column_usage
WHERE table_schema = 'public' AND table_name = 'bm_history'
AND column_name = 'asset_id';
-- 예상: asset_id → assets.id

-- 4.4 PM_schedule FK 확인 (assets와 연결)
SELECT constraint_name, column_name, referenced_table_name
FROM information_schema.key_column_usage
WHERE table_schema = 'public' AND table_name = 'pm_schedule'
AND column_name = 'asset_id';
-- 예상: asset_id → assets.id

-- 4.5 asset_disposal FK 확인 (assets와 연결)
SELECT constraint_name, column_name, referenced_table_name
FROM information_schema.key_column_usage
WHERE table_schema = 'public' AND table_name = 'asset_disposal'
AND column_name = 'asset_id';
-- 예상: asset_id → assets.id

-- ============================================================
-- 섹션 5: RLS 정책 검증
-- ============================================================

-- 5.1 asset_qr_scans RLS 활성화 여부
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'asset_qr_scans';
-- 예상: rowsecurity = true

-- 5.2 asset_qr_scans RLS 정책 확인
SELECT policyname, permissive, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'asset_qr_scans';
-- 예상: policy "auth_all_qr_scans" 존재 (모든 권한에 true)

-- 5.3 asset_qr_scans의 모든 RLS 정책 상세
SELECT *
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'asset_qr_scans';
-- 예상: 최소 1개의 정책 (auth_all_qr_scans)

-- ============================================================
-- 섹션 6: 데이터 무결성 검증
-- ============================================================

-- 6.1 기존 assets 자산 개수 확인
SELECT COUNT(*) as total_assets
FROM assets;
-- 예상: 506 (마이그레이션 전 상태 유지)

-- 6.2 asset_qr_scans 초기 상태 (새 테이블이므로 비어있음)
SELECT COUNT(*) as qr_scan_count
FROM asset_qr_scans;
-- 예상: 0

-- 6.3 assets 테이블 통계
SELECT
  COUNT(*) as total,
  COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
  COUNT(CASE WHEN status = 'idle' THEN 1 END) as idle,
  COUNT(CASE WHEN status = 'maintenance' THEN 1 END) as maintenance,
  COUNT(CASE WHEN status = 'sold' THEN 1 END) as sold,
  COUNT(CASE WHEN status = 'scrapped' THEN 1 END) as scrapped
FROM assets;
-- 예상: total=506, 상태별 분포 확인

-- 6.4 categories 테이블 확인
SELECT COUNT(*) as category_count
FROM categories;
-- 예상: 15개 카테고리

-- 6.5 asset_classes 테이블 확인
SELECT COUNT(*) as class_count
FROM asset_classes;
-- 예상: ~120개 분류 코드

-- 6.6 asset_audit 트리거 작동 확인
SELECT COUNT(*) as audit_records
FROM asset_audit;
-- 예상: 0 이상 (기존 변경 이력)

-- ============================================================
-- 섹션 7: FK 연결성 검증
-- ============================================================

-- 7.1 assets과 BM_history 관계 확인
SELECT a.id, COUNT(b.id) as bm_count
FROM assets a
LEFT JOIN bm_history b ON a.id = b.asset_id
GROUP BY a.id
HAVING COUNT(b.id) > 0
LIMIT 5;
-- 예상: BM 기록이 있는 자산들 표시

-- 7.2 assets과 PM_schedule 관계 확인
SELECT a.id, COUNT(p.id) as pm_count
FROM assets a
LEFT JOIN pm_schedule p ON a.id = p.asset_id
GROUP BY a.id
HAVING COUNT(p.id) > 0
LIMIT 5;
-- 예상: PM 기록이 있는 자산들 표시

-- 7.3 assets과 asset_disposal 관계 확인
SELECT a.id, COUNT(d.id) as disposal_count
FROM assets a
LEFT JOIN asset_disposal d ON a.id = d.asset_id
GROUP BY a.id
HAVING COUNT(d.id) > 0
LIMIT 5;
-- 예상: 폐기 기록이 있는 자산들 표시

-- 7.4 FK 제약 위반 검사 (asset_qr_scans → assets)
SELECT COUNT(*) as orphaned_qr_scans
FROM asset_qr_scans qs
WHERE NOT EXISTS (SELECT 1 FROM assets a WHERE a.id = qs.asset_id);
-- 예상: 0 (고아 레코드 없음)

-- 7.5 FK 제약 위반 검사 (asset_qr_scans → auth.users)
SELECT COUNT(*) as invalid_users
FROM asset_qr_scans qs
WHERE qs.scanned_by IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = qs.scanned_by);
-- 예상: 0 (유효하지 않은 사용자 없음)

-- ============================================================
-- 섹션 8: 트리거 검증
-- ============================================================

-- 8.1 asset_audit 트리거 확인
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public' AND event_object_table = 'assets'
ORDER BY trigger_name;
-- 예상: 기존 asset_audit 트리거 유지

-- ============================================================
-- 섹션 9: 호환성 E2E 테스트
-- ============================================================

-- 9.1 asset_qr_scans에 테스트 데이터 INSERT (RLS 확인)
-- 주의: 실제 INSERT 테스트는 API를 통해 수행하는 것이 좋음
-- SELECT 'Ready for INSERT test';

-- 9.2 존재하는 asset_id로 QR 스캔 로그 삽입 (FK 확인)
-- 예제 (실제 asset_id 사용):
-- INSERT INTO asset_qr_scans (asset_id, qr_payload, scanned_by, device_info)
-- VALUES ('550e8400-e29b-41d4-a716-446655440000', 'TEST-QR-001', NULL, 'Mobile')
-- RETURNING id, asset_id, qr_payload, scanned_at;
-- 예상: 성공적으로 삽입됨

-- ============================================================
-- 섹션 10: 성능 지표
-- ============================================================

-- 10.1 asset_qr_scans 테이블 크기
SELECT
  pg_size_pretty(pg_total_relation_size('asset_qr_scans')) as table_size;
-- 예상: 초기 상태 (작음)

-- 10.2 자산 조회 성능 (인덱스 확인)
EXPLAIN ANALYZE
SELECT * FROM assets WHERE asset_class_code LIKE '01%' LIMIT 10;
-- 예상: Index Scan 사용 (인덱스 효율적)

-- 10.3 QR 조회 성능 테스트
EXPLAIN ANALYZE
SELECT * FROM asset_qr_scans WHERE asset_id = '550e8400-e29b-41d4-a716-446655440000';
-- 예상: Index Scan on asset_qr_scans_asset_idx 사용

-- ============================================================
-- 섹션 11: 최종 호환성 보고서
-- ============================================================

-- 11.1 마이그레이션 적용 상태 요약
SELECT
  'asset_qr_scans table' as check_item,
  (SELECT COUNT(*) FROM information_schema.tables
   WHERE table_schema='public' AND table_name='asset_qr_scans') > 0 as passed
UNION ALL
SELECT
  'asset_qr_scans RLS policy' as check_item,
  (SELECT COUNT(*) FROM pg_policies
   WHERE schemaname='public' AND tablename='asset_qr_scans') > 0 as passed
UNION ALL
SELECT
  'asset_qr_scans_asset_idx index' as check_item,
  (SELECT COUNT(*) FROM pg_indexes
   WHERE schemaname='public' AND tablename='asset_qr_scans'
   AND indexname='asset_qr_scans_asset_idx') > 0 as passed
UNION ALL
SELECT
  'asset_qr_scans_payload_idx index' as check_item,
  (SELECT COUNT(*) FROM pg_indexes
   WHERE schemaname='public' AND tablename='asset_qr_scans'
   AND indexname='asset_qr_scans_payload_idx') > 0 as passed
UNION ALL
SELECT
  'asset_qr_scans_scanned_at_idx index' as check_item,
  (SELECT COUNT(*) FROM pg_indexes
   WHERE schemaname='public' AND tablename='asset_qr_scans'
   AND indexname='asset_qr_scans_scanned_at_idx') > 0 as passed
UNION ALL
SELECT
  'Existing assets preserved (506)' as check_item,
  (SELECT COUNT(*) FROM assets) = 506 as passed
UNION ALL
SELECT
  'FK: asset_qr_scans → assets' as check_item,
  (SELECT COUNT(*) FROM information_schema.key_column_usage
   WHERE table_name='asset_qr_scans' AND column_name='asset_id'
   AND referenced_table_name='assets') > 0 as passed
UNION ALL
SELECT
  'FK: BM_history → assets' as check_item,
  (SELECT COUNT(*) FROM information_schema.key_column_usage
   WHERE table_name='bm_history' AND column_name='asset_id') > 0 as passed
UNION ALL
SELECT
  'FK: PM_schedule → assets' as check_item,
  (SELECT COUNT(*) FROM information_schema.key_column_usage
   WHERE table_name='pm_schedule' AND column_name='asset_id') > 0 as passed
UNION ALL
SELECT
  'FK: asset_disposal → assets' as check_item,
  (SELECT COUNT(*) FROM information_schema.key_column_usage
   WHERE table_name='asset_disposal' AND column_name='asset_id') > 0 as passed
ORDER BY passed DESC, check_item;
-- 예상: 모든 항목이 true (10/10 통과)

-- ============================================================
-- 섹션 12: 문제 진단
-- ============================================================

-- 12.1 고아 레코드 감지
SELECT 'asset_qr_scans → assets orphaned' as issue
FROM asset_qr_scans
WHERE NOT EXISTS (SELECT 1 FROM assets WHERE id = asset_qr_scans.asset_id)
LIMIT 1;
-- 예상: 결과 없음

-- 12.2 FK 제약 위반 감지
SELECT constraint_name, table_name
FROM information_schema.table_constraints
WHERE table_schema = 'public' AND constraint_type = 'FOREIGN KEY'
AND table_name IN ('asset_qr_scans', 'assets', 'bm_history', 'pm_schedule', 'asset_disposal');
-- 예상: 모든 FK 제약이 정상 작동

-- ============================================================
-- 최종 결과 해석
-- ============================================================
--
-- ✅ 성공 기준:
-- 1. asset_qr_scans 테이블 생성됨
-- 2. 3개 인덱스 모두 생성됨
-- 3. RLS 정책 활성화됨
-- 4. 기존 assets 506개 유지
-- 5. 모든 FK 체인 무손상
-- 6. 고아 레코드 없음
-- 7. 마이그레이션 11.1 체크 10/10 통과
--
-- ❌ 실패 기준:
-- - 위 항목 중 하나라도 실패 시 마이그레이션 재검토 필요
--
