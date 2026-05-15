# Asset Master v2 Phase 2 설계 (1차 스켈톤)

> **작성일:** 2026-05-15 18:00 KST  
> **상태:** 1차 스켈톤 (DB 스키마 + API 목록)  
> **마감:** 2026-05-19 18:00 KST  
> **범위:** Phase 1 연장 (파일 업로드) → Phase 2 (대량 등록/조회/수정)

---

## 📋 목차

1. [Phase 2 범위](#phase-2-범위)
2. [DB 스키마 설계](#db-스키마-설계)
3. [API 엔드포인트 (25개)](#api-엔드포인트-25개)
4. [UI 화면 4개](#ui-화면-4개)
5. [의존성 & 블로킹](#의존성--블로킹)

---

## Phase 2 범위

### ✅ Phase 1 완료 (2026-05-15)
- 기본 CRUD API (POST/GET/PUT/DELETE /assets)
- 파일 첨부 (asset_documents 테이블)
- 기본 UI (목록, 상세, 신규 추가)

### 🟡 Phase 2 추가 기능 (2026-05-16 ~ 05-19)
| # | 기능 | 필요성 | 범위 |
|---|------|--------|------|
| 1 | **대량 등록 (Excel)** | 신규 자산 500+ 건 일괄 입력 | API + UI |
| 2 | **고급 검색 & 필터** | 카테고리/상태/위치별 조회 | API + UI |
| 3 | **일괄 수정** | 상태/위치 대량 변경 | API + UI |
| 4 | **데이터 검증** | 중복 제거, 필드 검증 | API |
| 5 | **내보내기 (Excel)** | 기존 목록 추출 | API + UI |
| 6 | **자산 이력 (History)** | asset_audit 기반 변경 추적 | API + UI |
| 7 | **통계 대시보드** | 자산 수/상태별 집계 | API + UI |

---

## DB 스키마 설계

### 변경 범위 (최소화 원칙)

**변경 없음:**
- `categories` 테이블 (15개 대분류)
- `asset_classes` 테이블 (~120개 세부분류)
- `assets` 테이블 (기존 컬럼 유지)
- `asset_audit` 테이블 (기존 감시 로그)
- `asset_documents` 테이블 (Phase 1)

**신규 추가:**
1. `asset_import_batches` — Excel 대량 입력 배치 추적
2. `asset_import_items` — 각 행의 입력 상태 & 검증 결과
3. `asset_validation_rules` — 필드별 검증 규칙 (선택)

### 신규 테이블 1: asset_import_batches

```sql
create table if not exists public.asset_import_batches (
  id uuid primary key default gen_random_uuid(),
  
  -- 배치 메타
  batch_name text not null,        -- "2026-05 Monthly Import"
  batch_date date default now(),
  
  -- 파일 정보
  file_name text,
  file_size_bytes int,
  file_hash text,                  -- SHA256 (중복 방지)
  
  -- 진행 상태
  status text default 'pending',   -- pending | processing | completed | failed
  total_rows int,                  -- 엑셀 행 수
  processed_count int default 0,   -- 처리 완료한 행 수
  success_count int default 0,     -- 성공한 행 수
  error_count int default 0,       -- 실패한 행 수
  
  -- 결과
  import_result jsonb,             -- {summary, errors, warnings}
  
  -- 메타
  created_at timestamptz default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz default now(),
  updated_by uuid references auth.users(id)
);

create index if not exists asset_import_batches_status_idx on asset_import_batches(status);
create index if not exists asset_import_batches_created_at_idx on asset_import_batches(created_at desc);
create index if not exists asset_import_batches_file_hash_idx on asset_import_batches(file_hash);
```

**용도:**
- Excel 업로드 시 배치 ID 생성
- 진행 상태 추적 (처리 중 → 완료 → 오류)
- 중복 파일 감지 (file_hash 비교)

### 신규 테이블 2: asset_import_items

```sql
create table if not exists public.asset_import_items (
  id uuid primary key default gen_random_uuid(),
  
  -- 배치 링크
  batch_id uuid not null references asset_import_batches(id) on delete cascade,
  
  -- 행 번호 & 상태
  row_number int not null,         -- Excel 행 번호 (헤더 제외)
  status text default 'pending',   -- pending | validating | success | error | skipped
  
  -- 원본 데이터 (JSON)
  raw_data jsonb not null,         -- {machine_asset_number, name_en, location, ...}
  
  -- 검증 결과
  validation_errors text[],        -- ["필드 A 필수", "필드 B 중복", ...]
  validation_warnings text[],      -- ["경고 메시지 1", ...]
  
  -- 처리 결과
  asset_id uuid references assets(id),  -- 생성된 자산 ID (성공 시)
  action text,                     -- create | update | skip
  
  -- 메타
  created_at timestamptz default now(),
  processed_at timestamptz
);

create index if not exists asset_import_items_batch_idx on asset_import_items(batch_id);
create index if not exists asset_import_items_status_idx on asset_import_items(status);
create index if not exists asset_import_items_asset_idx on asset_import_items(asset_id);
```

**용도:**
- Excel 각 행의 검증 상태 기록
- 실패한 행에 대한 오류 메시지 제공
- 부분 처리 후 실패한 행만 재시도 가능

### 기존 assets 테이블 (변경 사항)

**추가 인덱스 (조회 성능):**
```sql
-- 필터 쿼리 최적화
create index if not exists assets_status_idx on assets(status);
create index if not exists assets_location_idx on assets(location);
create index if not exists assets_updated_at_idx on assets(updated_at desc);

-- 전문 검색 (FTS)
create index if not exists assets_search_idx on assets using gin(
  to_tsvector('simple', 
    coalesce(machine_asset_number,'') || ' ' ||
    coalesce(name_en,'') || ' ' ||
    coalesce(model,'') ||
    coalesce(make,'')
  )
);
```

---

## API 엔드포인트 (25개)

### 카테고리 1: 기본 조회 (5개)

| # | Method | Endpoint | 설명 | 응답 |
|----|--------|----------|------|------|
| 1 | GET | `/api/assets` | 목록 (페이지네이션+필터) | `{ data: Asset[], total: int, page: int, per_page: int }` |
| 2 | GET | `/api/assets/:id` | 상세 조회 | `Asset` |
| 3 | GET | `/api/assets/search` | 전체 검색 (FTS) | `{ data: Asset[], total: int }` |
| 4 | GET | `/api/asset-categories` | 카테고리 목록 | `Category[]` |
| 5 | GET | `/api/assets/:id/history` | 자산 이력 (asset_audit) | `AssetAudit[]` |

**쿼리 파라미터 (GET /api/assets):**
```
?page=1&per_page=20
&category=01           — 카테고리 필터
&status=active         — 상태 필터 (active|idle|maintenance|sold|scrapped)
&location=EB YARD      — 위치 필터
&make=TRINITY          — 제조사 필터
&sort_by=updated_at    — 정렬 (updated_at|name_en|status)
&sort_order=desc       — 정렬 방향 (asc|desc)
```

### 카테고리 2: 생성/수정 (5개)

| # | Method | Endpoint | 설명 | 요청 본문 |
|----|--------|----------|------|---------|
| 6 | POST | `/api/assets` | 단건 생성 | `AssetCreateInput` |
| 7 | PUT | `/api/assets/:id` | 단건 수정 | `AssetUpdateInput` |
| 8 | DELETE | `/api/assets/:id` | 단건 삭제 | — |
| 9 | POST | `/api/assets/bulk-update` | 다중 수정 | `{ ids: uuid[], updates: object }` |
| 10 | DELETE | `/api/assets/bulk-delete` | 다중 삭제 | `{ ids: uuid[] }` |

### 카테고리 3: 대량 임포트 (Excel) (7개)

| # | Method | Endpoint | 설명 | 요청 본문 |
|----|--------|----------|------|---------|
| 11 | POST | `/api/assets/import/preview` | Excel 미리보기 | FormData (file) |
| 12 | POST | `/api/assets/import/validate` | 데이터 검증 | `{ batch_id: uuid }` |
| 13 | POST | `/api/assets/import/execute` | 일괄 입력 | `{ batch_id: uuid, confirm: boolean }` |
| 14 | GET | `/api/assets/import/batches` | 배치 목록 | — |
| 15 | GET | `/api/assets/import/batches/:batch_id` | 배치 상세 | — |
| 16 | GET | `/api/assets/import/batches/:batch_id/items` | 배치 아이템 (검증 결과) | `?page=1&per_page=50` |
| 17 | DELETE | `/api/assets/import/batches/:batch_id` | 배치 삭제 | — |

**Excel 템플릿 (헤더):**
```
machine_asset_number | name_en | name_ko | location | status | model | make | year_of_manufacture | category_code | serial_no | remark
DCMI-UTL-PSF-03      | SUB STATION | ... | EB YARD | active | EB - SUB STATION | TRINITY | 2015 | 01.001 | ... | ...
```

### 카테고리 4: 데이터 검증 & 정제 (5개)

| # | Method | Endpoint | 설명 | 요청/응답 |
|----|--------|----------|------|-----------|
| 18 | POST | `/api/assets/validate` | 필드 검증 | `{ fields: object } → { valid: bool, errors: string[] }` |
| 19 | GET | `/api/assets/deduplicate` | 중복 자산 감지 | `{ duplicates: [[Asset, Asset]] }` |
| 20 | GET | `/api/assets/validation-report` | 검증 리포트 | `{ total: int, valid: int, errors: { field: count } }` |
| 21 | POST | `/api/assets/merge` | 중복 병합 (병합, 삭제 선택) | `{ primary_id: uuid, duplicate_id: uuid, action: merge\|delete }` |
| 22 | GET | `/api/assets/missing-fields` | 필수 필드 누락 조회 | `{ assets: [ { id, missing_fields } ] }` |

### 카테고리 5: 내보내기 & 통계 (3개)

| # | Method | Endpoint | 설명 | 응답 |
|----|--------|----------|------|------|
| 23 | GET | `/api/assets/export/excel` | Excel 다운로드 | 바이너리 (xlsx) |
| 24 | GET | `/api/assets/statistics` | 통계 대시보드 | `{ total, by_status, by_category, by_location, ... }` |
| 25 | GET | `/api/assets/statistics/timeline` | 월별 추가 현황 | `{ labels: date[], values: int[] }` |

---

## UI 화면 (4개)

### 화면 1: 자산 목록 (개선) — `/assets`

**상단:**
- 검색 바 + 고급 필터 (카테고리, 상태, 위치, 제조사)
- 정렬 옵션 (수정일, 이름, 상태)

**본문:**
- 테이블 또는 카드 목록 (모바일 → 카드, 데스크톱 → 테이블)
- 페이지네이션 (20개/페이지)

**하단:**
- 총 자산 수
- [대량 등록] [내보내기] [통계] 버튼

---

### 화면 2: 대량 등록 (신규) — `/assets/bulk-import`

**Step 1: Excel 업로드**
- 파일 선택 + 드래그 앤 드롭
- 템플릿 다운로드 링크
- 파일 크기 제한 (10MB)

**Step 2: 미리보기 & 검증**
- 테이블 형식 미리보기 (첫 10행)
- 검증 결과 요약
  - 총 행 수
  - 유효한 행 / 오류 행
  - 오류 목록 (행별)

**Step 3: 확인 & 실행**
- 확인 버튼 → 일괄 입력 시작
- 진행률 표시 (처리 중)
- 완료 시 결과 요약

---

### 화면 3: 고급 검색 & 필터 (개선) — `/assets/search`

**필터 패널:**
- 카테고리 (체크박스)
- 상태 (라디오 또는 체크박스)
- 위치 (텍스트 입력 + 자동완성)
- 제조사 (드롭다운)
- 생산 연도 범위 (슬라이더)

**결과:**
- 필터 적용 후 자산 목록
- 결과 수 표시
- 필터 초기화 버튼

---

### 화면 4: 통계 대시보드 (신규) — `/assets/statistics`

**카드 형식:**
- 총 자산 수
- 상태별 분포 (Active / Idle / Maintenance / Sold / Scrapped)
- 카테고리별 분포 (바 차트)
- 위치별 분포 (지도 또는 테이블)
- 월별 추가 현황 (라인 차트)

---

## 의존성 & 블로킹

### ✅ 확인 완료
- Phase 1 DB 마이그레이션 (`db/28_asset_master_v2.sql`) ✅
- 기존 506개 자산 + 관계 테이블 (BM/PM/Disposal) ✅

### 🔌 기술 검증 필요
- [ ] Supabase 프로덕션 스키마에 Phase 1 적용 확인
- [ ] Excel 라이브러리 (xlsx) 현황 확인
- [ ] 대량 처리 성능 (1000+ 행) 테스트

### 📦 산출물 일정

| 단계 | 기간 | 담당 | 산출물 |
|------|------|------|--------|
| 1차 스켈톤 | 2026-05-15 18:00 | 플레너 | DB + API 목록 (✅ 현재) |
| 2차 상세 설계 | 2026-05-16~17 | 플레너 | 완전한 DESIGN.md + API_GUIDE.md |
| DB 마이그레이션 | 2026-05-18 | 플레너 | db/29_asset_master_v2_phase2.sql |
| **최종 완성** | **2026-05-19 18:00** | 플레너 | DESIGN.md + API_GUIDE.md + SQL + SUMMARY.md |

---

## 다음 단계 (2026-05-16)

1. **웹개발자 피드백 수집**
   - API 설계 적정성
   - 성능 우려사항
   - 기술 의존성

2. **상세 설계 작성**
   - 각 API 요청/응답 스키마
   - 검증 규칙 상세
   - 에러 처리 케이스

3. **DB 마이그레이션 완성**
   - 테이블 생성 SQL
   - 인덱스 및 RLS 정책

---

**상태:** 🟡 진행중 (1차 스켈톤 완료 → 2차 상세 설계 진행)
