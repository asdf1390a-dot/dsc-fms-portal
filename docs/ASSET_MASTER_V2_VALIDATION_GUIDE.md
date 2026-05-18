# Asset Master v2 호환성 검증 가이드

**버전:** 1.0  
**작성일:** 2026-05-15  
**대상:** Web-Builder (웹개발자), Evaluator (평가자)  
**상태:** Asset Master v2 구현 전 사전 검증

---

## 개요

이 문서는 Asset Master v2 마이그레이션이 정상적으로 적용되었는지 확인하는 방법을 설명합니다.

### 검증 범위

- ✅ 신규 테이블 (asset_qr_scans) 생성 확인
- ✅ 인덱스 생성 확인
- ✅ RLS 정책 활성화 확인
- ✅ 기존 자산 506개 보존 확인
- ✅ 외래키 체인 무결성 확인
- ✅ 트리거 작동 확인

---

## 1단계: Supabase 접속

### 방법 1: Supabase Dashboard (권장)

1. https://supabase.com에 로그인
2. 프로젝트 선택 (DSC Mannur)
3. 왼쪽 메뉴에서 **SQL Editor** 클릭
4. 새로운 쿼리 탭 열기

### 방법 2: supabase-cli

```bash
cd /home/jeepney/.openclaw/workspace-dev/dsc-fms-portal
supabase db remote set
supabase db pull  # 원격 스키마 동기화
```

---

## 2단계: 마이그레이션 적용

### 2.1 마이그레이션 파일 위치

```
dsc-fms-portal/db/28_asset_master_v2.sql
```

### 2.2 마이그레이션 실행 (선택 방법 중 하나)

**옵션 A: Supabase Dashboard SQL Editor**

1. SQL Editor 열기
2. `db/28_asset_master_v2.sql` 파일 내용 복사
3. 에디터에 붙여넣기
4. **Run** 버튼 클릭
5. 완료 메시지 확인

**옵션 B: supabase-cli**

```bash
supabase db push
```

**옵션 C: 수동 (한 번에 한 섹션)** — 오류 추적에 좋음

1. SQL Editor에서 "섹션 1: New Table" 실행
2. "섹션 2: RLS Policy" 실행
3. 각 단계마다 에러 확인

---

## 3단계: 호환성 검증 쿼리 실행

### 파일 위치

```
dsc-fms-portal/db/ASSET_MASTER_V2_VALIDATION_QUERIES.sql
```

### 실행 순서

마이그레이션 적용 직후, 다음 순서대로 검증 쿼리를 실행하세요.

---

### 섹션 1: 기본 테이블 존재 확인

**목적:** 신규 테이블과 기존 테이블 모두 존재하는지 확인

**쿼리:**

```sql
-- 1.1 asset_qr_scans 테이블 존재 확인
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'asset_qr_scans';

-- 1.2 기존 assets 테이블 존재 확인
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'assets';

-- 1.3 기존 categories 테이블 존재 확인
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'categories';

-- 1.4 기존 asset_classes 테이블 존재 확인
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'asset_classes';
```

**예상 결과:** 4행 (asset_qr_scans, assets, categories, asset_classes)

**체크리스트:**

- [ ] asset_qr_scans 테이블 존재
- [ ] assets 테이블 존재 (기존)
- [ ] categories 테이블 존재 (기존)
- [ ] asset_classes 테이블 존재 (기존)

---

### 섹션 2: 스키마 검증

**목적:** asset_qr_scans 컬럼 구조 확인

**쿼리:**

```sql
-- 2.1 asset_qr_scans 컬럼 구조
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'asset_qr_scans'
ORDER BY ordinal_position;
```

**예상 결과:**

| column_name | data_type        | is_nullable |
|-------------|------------------|-------------|
| id          | uuid             | NO          |
| asset_id    | uuid             | NO          |
| qr_payload  | text             | NO          |
| scanned_at  | timestamp with timezone | NO |
| scanned_by  | uuid             | YES         |
| device_info | text             | YES         |
| location_gps| text             | YES         |

**체크리스트:**

- [ ] id (uuid, NOT NULL) — Primary Key
- [ ] asset_id (uuid, NOT NULL) — Foreign Key
- [ ] qr_payload (text, NOT NULL)
- [ ] scanned_at (timestamptz, NOT NULL)
- [ ] scanned_by (uuid, NULLABLE)
- [ ] device_info (text, NULLABLE)
- [ ] location_gps (text, NULLABLE)

---

### 섹션 3: 인덱스 검증

**목적:** 성능 최적화 인덱스 생성 확인

**쿼리:**

```sql
-- 3.1 asset_qr_scans 인덱스 확인
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'asset_qr_scans'
ORDER BY indexname;
```

**예상 결과:** 4개 인덱스

| indexname                      |
|--------------------------------|
| asset_qr_scans_asset_idx       |
| asset_qr_scans_payload_idx     |
| asset_qr_scans_pkey            |
| asset_qr_scans_scanned_at_idx  |

**체크리스트:**

- [ ] asset_qr_scans_asset_idx — asset_id 조회 성능
- [ ] asset_qr_scans_payload_idx — QR 페이로드 조회 성능
- [ ] asset_qr_scans_scanned_at_idx — 시간순 정렬 성능
- [ ] asset_qr_scans_pkey — Primary Key 인덱스

---

### 섹션 4: 외래키 제약 검증

**목적:** FK 체인 무결성 확인

**쿼리:**

```sql
-- 4.1 asset_qr_scans의 FK 확인
SELECT constraint_name, column_name, referenced_table_name, referenced_column_name
FROM information_schema.key_column_usage
WHERE table_schema = 'public' AND table_name = 'asset_qr_scans'
AND referenced_table_name IS NOT NULL;
```

**예상 결과:**

| constraint_name | column_name | referenced_table_name | referenced_column_name |
|-----------------|-------------|----------------------|------------------------|
| asset_qr_scans_asset_id_fkey | asset_id | assets | id |
| asset_qr_scans_scanned_by_fkey | scanned_by | users | id |

**추가 쿼리:**

```sql
-- 4.2 기존 FK 확인: BM_history → assets
SELECT constraint_name
FROM information_schema.key_column_usage
WHERE table_schema = 'public' AND table_name = 'bm_history'
AND column_name = 'asset_id' AND referenced_table_name = 'assets';

-- 4.3 기존 FK 확인: PM_schedule → assets
SELECT constraint_name
FROM information_schema.key_column_usage
WHERE table_schema = 'public' AND table_name = 'pm_schedule'
AND column_name = 'asset_id' AND referenced_table_name = 'assets';

-- 4.4 기존 FK 확인: asset_disposal → assets
SELECT constraint_name
FROM information_schema.key_column_usage
WHERE table_schema = 'public' AND table_name = 'asset_disposal'
AND column_name = 'asset_id' AND referenced_table_name = 'assets';
```

**체크리스트:**

- [ ] asset_qr_scans.asset_id → assets.id (FK 존재)
- [ ] asset_qr_scans.scanned_by → auth.users.id (FK 존재)
- [ ] bm_history.asset_id → assets.id (FK 유지)
- [ ] pm_schedule.asset_id → assets.id (FK 유지)
- [ ] asset_disposal.asset_id → assets.id (FK 유지)

---

### 섹션 5: RLS 정책 검증

**목적:** 데이터 접근 제어 확인

**쿼리:**

```sql
-- 5.1 asset_qr_scans RLS 활성화 확인
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'asset_qr_scans';
```

**예상 결과:**

| tablename     | rowsecurity |
|---------------|-------------|
| asset_qr_scans| true        |

**추가 쿼리:**

```sql
-- 5.2 RLS 정책 확인
SELECT policyname, permissive, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'asset_qr_scans';
```

**예상 결과:** policy "auth_all_qr_scans" 존재 (모든 authenticated 사용자에게 모든 권한)

**체크리스트:**

- [ ] RLS 활성화됨 (rowsecurity = true)
- [ ] auth_all_qr_scans 정책 존재
- [ ] authenticated 사용자에게 모든 권한 (SELECT, INSERT, UPDATE, DELETE)

---

### 섹션 6: 데이터 무결성 검증

**목적:** 기존 자산 데이터 보존 확인

**쿼리:**

```sql
-- 6.1 기존 assets 자산 개수 확인
SELECT COUNT(*) as total_assets
FROM assets;
```

**예상 결과:** 506

**추가 쿼리:**

```sql
-- 6.2 asset_qr_scans 초기 상태 (새 테이블이므로 비어있음)
SELECT COUNT(*) as qr_scan_count
FROM asset_qr_scans;

-- 6.3 assets 통계
SELECT
  COUNT(*) as total,
  COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
  COUNT(CASE WHEN status = 'idle' THEN 1 END) as idle,
  COUNT(CASE WHEN status = 'maintenance' THEN 1 END) as maintenance,
  COUNT(CASE WHEN status = 'sold' THEN 1 END) as sold,
  COUNT(CASE WHEN status = 'scrapped' THEN 1 END) as scrapped
FROM assets;
```

**예상 결과:**

| total | active | idle | maintenance | sold | scrapped |
|-------|--------|------|-------------|------|----------|
| 506   | [상태별 분포] | ... | ... | ... | ... |

**체크리스트:**

- [ ] total_assets = 506 (기존 자산 100% 유지)
- [ ] qr_scan_count = 0 (신규 테이블 비어있음)
- [ ] 상태별 분포 유지 (변경 없음)

---

### 섹션 7: FK 연결성 검증

**목적:** 실제 데이터 관계 확인

**쿼리:**

```sql
-- 7.4 FK 제약 위반 검사 (asset_qr_scans → assets)
SELECT COUNT(*) as orphaned_qr_scans
FROM asset_qr_scans qs
WHERE NOT EXISTS (SELECT 1 FROM assets a WHERE a.id = qs.asset_id);

-- 7.5 FK 제약 위반 검사 (asset_qr_scans → auth.users)
SELECT COUNT(*) as invalid_users
FROM asset_qr_scans qs
WHERE qs.scanned_by IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = qs.scanned_by);
```

**예상 결과:** 모두 0 (고아 레코드 없음)

**체크리스트:**

- [ ] orphaned_qr_scans = 0
- [ ] invalid_users = 0

---

### 섹션 8: 최종 종합 검증

**목적:** 모든 항목 한 번에 확인

**쿼리:**

```sql
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
```

**예상 결과:** 10개 항목 모두 true (10/10 통과)

| check_item | passed |
|------------|--------|
| ... | true |
| ... | true |

**체크리스트:**

- [ ] 10개 항목 모두 통과 (10/10)

---

## 4단계: 결과 해석

### ✅ 성공 (10/10 통과)

모든 검증 항목이 통과한 경우:

1. **마이그레이션 적용 완료** ✓
2. **Asset Master v2 구현 준비 완료** ✓
3. **Web-Builder가 개발 시작 가능** ✓

**다음 단계:** Web-Builder에게 구현 시작 신호

### ❌ 실패 (1개 이상 미통과)

특정 항목이 실패한 경우:

| 실패 항목 | 원인 | 해결 방법 |
|---------|------|---------|
| asset_qr_scans table | 테이블 생성 실패 | 28_asset_master_v2.sql 재실행 |
| RLS policy | 정책 설정 실패 | RLS 섹션만 다시 실행 |
| Index | 인덱스 생성 실패 | 특정 인덱스만 수동 생성 |
| FK 제약 | 외래키 설정 오류 | 기존 테이블 구조 확인 |
| assets = 506 | 자산 데이터 손상 | 데이터베이스 백업 복구 필요 |

---

## 5단계: 문제 진단

### 5.1 마이그레이션 적용 실패

**증상:** "relation asset_qr_scans does not exist" 에러

**진단:**

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'asset_qr_scans';
```

**해결:**

1. Supabase Dashboard → SQL Editor 확인
2. 에러 메시지 전체 복사
3. `db/28_asset_master_v2.sql` 문법 확인
4. 한 섹션씩 나누어 재실행

### 5.2 FK 제약 위반

**증상:** "insert or update on table asset_qr_scans violates foreign key constraint"

**진단:**

```sql
SELECT COUNT(*) FROM assets;  -- 506 확인?
SELECT COUNT(*) FROM asset_qr_scans;  -- 레코드 있는지 확인?
```

**해결:**

- assets 테이블에 실제 레코드 있는지 확인
- asset_id가 유효한지 확인

### 5.3 RLS 정책 미적용

**증상:** authenticated 사용자가 INSERT 불가

**진단:**

```sql
SELECT policyname FROM pg_policies
WHERE schemaname='public' AND tablename='asset_qr_scans';
```

**해결:**

```sql
-- RLS 정책 재적용
drop policy if exists "auth_all_qr_scans" on asset_qr_scans;
create policy "auth_all_qr_scans" on asset_qr_scans
  for all to authenticated using (true) with check (true);
```

---

## 부록 A: 성능 벤치마크

마이그레이션 후 성능 지표 (선택 사항):

```sql
-- A.1 자산 조회 성능
EXPLAIN ANALYZE
SELECT * FROM assets WHERE asset_class_code LIKE '01%' LIMIT 10;
-- 예상: < 100ms

-- A.2 QR 스캔 로그 조회 성능
EXPLAIN ANALYZE
SELECT * FROM asset_qr_scans WHERE asset_id = '550e8400-e29b-41d4-a716-446655440000';
-- 예상: < 10ms (인덱스 사용)

-- A.3 테이블 크기
SELECT pg_size_pretty(pg_total_relation_size('asset_qr_scans')) as table_size;
-- 예상: < 1MB (초기 상태)
```

---

## 부록 B: 롤백 절차 (필요시)

마이그레이션을 되돌려야 하는 경우:

```sql
-- ⚠️ 주의: 신규 데이터 손실됨

DROP TABLE IF EXISTS public.asset_qr_scans CASCADE;

-- 확인
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'asset_qr_scans';
-- 예상: (결과 없음)
```

---

## 문의 & 피드백

검증 중 문제 발생:

1. **에러 메시지 전체 복사**
2. **실행한 쿼리 번호 기록** (예: 섹션 3.1)
3. **비서에게 보고**
4. **로그 파일 첨부** (Supabase → Logs)

---

## 요약 체크리스트

### Pre-Migration

- [ ] Supabase 백업 생성
- [ ] 마이그레이션 파일 위치 확인 (db/28_asset_master_v2.sql)
- [ ] 개발 환경 (테스트용) vs 프로덕션 환경 구분

### Migration

- [ ] 마이그레이션 파일 실행 (28_asset_master_v2.sql)
- [ ] 완료 메시지 확인

### Post-Migration Validation

- [ ] 섹션 1: 테이블 존재 확인 (4/4)
- [ ] 섹션 2: 스키마 검증 (7/7)
- [ ] 섹션 3: 인덱스 확인 (4/4)
- [ ] 섹션 4: FK 제약 확인 (5/5)
- [ ] 섹션 5: RLS 정책 확인 (2/2)
- [ ] 섹션 6: 데이터 무결성 (3/3)
- [ ] 섹션 8: 최종 종합 (10/10 통과)

### Go/No-Go Decision

- [ ] 10/10 통과 → **GO** (Web-Builder 개발 시작)
- [ ] 9/10 이하 → **NO-GO** (진단 및 수정 필요)

---

**버전:** 1.0 | **작성자:** Compatibility Test Agent | **상태:** Ready for Deployment
