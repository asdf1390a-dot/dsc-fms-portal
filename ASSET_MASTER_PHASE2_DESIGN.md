# Asset Master v2 Phase 2 — 최종 설계 문서

> **작성:** 2026-05-16 09:00 KST  
> **상태:** 최종 설계 (P0 수정 완료)  
> **범위:** MVP 16개 API + 3개 UI + Defer 9개 Phase 2.5  
> **마감:** 2026-05-19 18:00 KST

---

## 📋 목차

1. [Phase 2 범위 재정의](#phase-2-범위-재정의)
2. [DB 스키마 설계 (P0 수정)](#db-스키마-설계-p0-수정)
3. [API 엔드포인트 MVP 16개](#api-엔드포인트-mvp-16개)
4. [UI 화면 3개 (통합)](#ui-화면-3개-통합)
5. [구현 일정](#구현-일정)

---

## Phase 2 범위 재정의

### ✅ Phase 1 완료 (2026-05-15)
- 기본 CRUD API (POST/GET/PUT/DELETE /assets)
- 파일 첨부 (asset_documents 테이블)
- 기본 UI (목록, 상세, 신규 추가)

### 🟡 Phase 2 MVP 추가 기능 (2026-05-16 ~ 05-19)

| # | 기능 | 필요성 | 상태 |
|---|------|--------|------|
| 1 | **대량 등록 (Excel)** | 신규 자산 500+ 건 일괄 입력 | MVP |
| 2 | **검색 & 필터** | 카테고리/상태/위치별 조회 | MVP (목록 필터 드로어로 통합) |
| 3 | **일괄 수정** | 상태/위치 대량 변경 | MVP |
| 4 | **내보내기 (Excel)** | 기존 목록 추출 | MVP |
| 5 | **자산 이력 조회** | asset_audit 기반 변경 추적 | MVP |
| 6 | **통계 API** | 자산 수/상태별 집계 | MVP |

### 🟠 Phase 2.5 Defer (2026-05-22~)

| # | 기능 | 이유 | 예정 |
|---|------|------|------|
| 1 | 중복 감지 (deduplicate) | Machine asset number UNIQUE 제약으로 자동 차단 가능 | 05-22 |
| 2 | 자산 병합 (merge) | FK 재연결 복잡, 별도 설계 필요 | 05-23 |
| 3 | 실패행 재처리 (retry-failed) | 기본 import 후 필요성 판단 | 05-22 |
| 4 | 필드 검증 상세 (validate) | 11/12에 통합 가능 | 05-23 |
| 5 | 검증 리포트 (validation-report) | 24번 (statistics) 일부로 통합 | 05-24 |
| 6 | 필수 필드 누락 조회 (missing-fields) | 통계에 포함 가능 | 05-24 |
| 7 | 월별 추가 현황 (timeline) | 기본 통계 후 필요성 판단 | 05-25 |
| 8 | 배치 삭제 (DELETE /batches/:id) | 운영 빈도 낮음, 소프트 삭제 검토 | 05-25 |
| 9 | 배치 대량 삭제 (bulk-delete) | Phase 1 soft-delete와 통일 필요 | 05-26 |

---

## DB 스키마 설계 (P0 수정)

### 변경 범위 (최소화 원칙)

**변경 없음:**
- `categories` (15개 대분류)
- `asset_classes` (~120개 세부분류)
- `assets` (기존 컬럼 유지)
- `asset_audit` (기존 감시 로그)
- `asset_documents` (Phase 1)

**신규 추가:**
1. `asset_import_batches` — Excel 배치 추적
2. `asset_import_items` — 각 행의 검증/처리 상태

---

### 신규 테이블 1: asset_import_batches (P0-3: RLS 추가됨)

```sql
create table if not exists public.asset_import_batches (
  id uuid primary key default gen_random_uuid(),
  
  -- 배치 메타
  batch_name text not null,
  batch_date date default current_date,   -- P0-2 수정: now() → current_date
  
  -- 파일 정보
  file_name text,
  file_size_bytes int,
  file_hash text,
  
  -- 진행 상태
  status text default 'pending',
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

-- P0-3: RLS 정책 추가
alter table asset_import_batches enable row level security;

create policy "auth_all_import_batches" on asset_import_batches
  for all to authenticated 
  using (org_id = auth.jwt() ->> 'org_id') 
  with check (org_id = auth.jwt() ->> 'org_id');
```

---

### 신규 테이블 2: asset_import_items (P0-3: RLS 추가됨)

```sql
create table if not exists public.asset_import_items (
  id uuid primary key default gen_random_uuid(),
  
  -- 배치 링크
  batch_id uuid not null references asset_import_batches(id) on delete cascade,
  
  -- 행 번호 & 상태
  row_number int not null,
  status text default 'pending',   -- pending | validating | success | error | skipped
  
  -- 원본 데이터 (JSON)
  raw_data jsonb not null,
  
  -- 검증 결과
  validation_errors text[],
  validation_warnings text[],
  
  -- 처리 결과
  asset_id uuid references assets(id),
  action text,   -- create | update | skip
  
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

-- P0-3: RLS 정책 추가
alter table asset_import_items enable row level security;

create policy "auth_all_import_items" on asset_import_items
  for all to authenticated
  using (
    batch_id in (
      select id from asset_import_batches 
      where org_id = auth.jwt() ->> 'org_id'
    )
  )
  with check (
    batch_id in (
      select id from asset_import_batches 
      where org_id = auth.jwt() ->> 'org_id'
    )
  );
```

---

### 기존 assets 테이블 (P0-1: 인덱스 충돌 해결)

**기존 인덱스 (01_schema.sql에서):**
- ✅ `assets_status_idx` on assets(status)
- ✅ `assets_search_idx` using gin (FTS, simple, name_ko/name_ta/model/make/machine_asset_number/serial_no)

**신규 추가 인덱스 (29번 SQL에서):**
```sql
-- 존재 확인하고 중복 제거 (IF NOT EXISTS 사용)
create index if not exists assets_location_idx on assets(location);
create index if not exists assets_updated_at_idx on assets(updated_at desc);
create index if not exists assets_class_code_idx on assets(asset_class_code);

-- Excel 헤더 검증용 (P0-2 수정됨):
-- machine_asset_number (UNIQUE constraint 이미 존재)
-- name_en (NOT NULL)
-- name_ta (이미 테이블에 있음)
-- model, make, year_of_manufacture, asset_class_code
-- serial_no, location, status, remark
```

---

## API 엔드포인트 MVP 16개

### 기술 스택 (App Router 통일)
- **Router:** Next.js App Router (`app/api/`) — 기존 자산 API와 통일
- **구현 패턴:** `app/api/assets/route.ts` (root), `app/api/assets/[assetId]/route.ts` (동적), `app/api/assets/[assetId]/audit-log/route.ts` (nested)

### 1. 기본 조회 (5개)

| # | Method | Endpoint | 설명 | 상태 |
|----|--------|----------|------|------|
| 1 | GET | `/api/assets` | 목록 (페이지+필터+검색) | 신규 (filters/search 추가) |
| 2 | GET | `/api/assets/:id` | 상세 조회 | 기존 코드 재사용 |
| 3 | GET | `/api/asset-categories` | 카테고리 목록 | 신규 |
| 4 | GET | `/api/assets/:id/audit-log` | 자산 이력 (asset_audit) | 신규 (경로 변경) |
| 5 | GET | `/api/assets/locations` | 위치 자동완성 | 신규 |

**GET /api/assets — 쿼리 파라미터:**
```
?page=1&per_page=20
&q=DCMI              — 검색어 (FTS)
&category=01         — 카테고리 (prefix)
&status=active       — 상태 필터
&location=EB YARD    — 위치 필터
&make=TRINITY        — 제조사 필터
&sort_by=updated_at  — 정렬 (updated_at|name_en|status)
&sort_order=desc     — asc|desc
```

**응답:**
```json
{
  "data": [
    {
      "id": "uuid",
      "machine_asset_number": "DCMI-UTL-PSF-03",
      "name_en": "SUB STATION",
      "name_ta": "...",
      "category_code": "01",
      "asset_class_code": "01.001",
      "location": "EB YARD",
      "status": "active",
      "model": "EB - SUB STATION",
      "make": "TRINITY",
      "serial_no": "...",
      "year_of_manufacture": 2015,
      "created_at": "...",
      "updated_at": "..."
    }
  ],
  "total": 506,
  "page": 1,
  "per_page": 20
}
```

---

### 2. 생성/수정 (4개)

| # | Method | Endpoint | 설명 | 상태 |
|----|--------|----------|------|------|
| 6 | POST | `/api/assets` | 단건 생성 | 기존 코드 재사용 (`app/api/assets/route.ts`) |
| 7 | PUT | `/api/assets/:id` | 단건 수정 | 신규 (`app/api/assets/[assetId]/route.ts`) |
| 8 | DELETE | `/api/assets/:id` | 단건 삭제 | 신규 (`app/api/assets/[assetId]/route.ts`) |
| 9 | POST | `/api/assets/bulk-update` | 다중 수정 | 신규 |

**POST /api/assets 요청:**
```json
{
  "machine_asset_number": "DCMI-UTL-PSF-05",
  "name_en": "POWER SUPPLY",
  "name_ta": "...",
  "asset_class_code": "01.001",
  "location": "EB YARD",
  "status": "active",
  "model": "PSF-2000",
  "make": "TRINITY",
  "serial_no": "ABC123",
  "year_of_manufacture": 2015,
  "remark": "..."
}
```

**POST /api/assets/bulk-update 요청:**
```json
{
  "ids": ["uuid-1", "uuid-2", "uuid-3"],
  "updates": {
    "status": "idle",
    "location": "WAREHOUSE"
  }
}
```

---

### 3. 대량 임포트 (Excel) (7개)

| # | Method | Endpoint | 설명 |
|----|--------|----------|------|
| 10 | GET | `/api/assets/import/template.xlsx` | 템플릿 다운로드 |
| 11 | POST | `/api/assets/import/preview` | Excel 미리보기 + 검증 |
| 12 | POST | `/api/assets/import/execute` | 일괄 입력 실행 |
| 13 | GET | `/api/assets/import/batches` | 배치 목록 |
| 14 | GET | `/api/assets/import/batches/:batch_id` | 배치 상세 |
| 15 | GET | `/api/assets/import/batches/:batch_id/items` | 배치 아이템 |
| 16 | POST | `/api/assets/import/batches/:batch_id/items` | 아이템 부분 조회 |

**POST /api/assets/import/preview — FormData:**
```
file: <multipart File>
```

**응답:**
```json
{
  "batch_id": "uuid",
  "file_name": "assets_2026_05.xlsx",
  "file_hash": "sha256...",
  "total_rows": 120,
  "preview": [
    { "row_number": 1, "raw_data": {...}, "validation_errors": [] },
    { "row_number": 2, "raw_data": {...}, "validation_errors": ["필드 A 필수"] }
  ],
  "summary": {
    "total": 120,
    "valid": 118,
    "errors": 2,
    "error_details": {
      "missing_machine_asset_number": 1,
      "duplicate_machine_asset_number": 1
    }
  }
}
```

**Excel 템플릿 헤더 (P0-2 수정):**
```
machine_asset_number | name_en | name_ta | location | status | model | make | year_of_manufacture | asset_class_code | serial_no | remark
DCMI-UTL-PSF-03      | SUB STATION | ... | EB YARD | active | EB - SUB STATION | TRINITY | 2015 | 01.001 | ... | ...
```

---

### 4. 내보내기 & 통계 (2개)

| # | Method | Endpoint | 설명 |
|----|--------|----------|------|
| 17 | GET | `/api/assets/export/excel` | Excel 다운로드 |
| 18 | GET | `/api/assets/statistics` | 통계 API |

**GET /api/assets/statistics 응답:**
```json
{
  "total": 506,
  "by_status": {
    "active": 450,
    "idle": 40,
    "maintenance": 10,
    "sold": 5,
    "scrapped": 1
  },
  "by_category": {
    "01 (UTILITY)": 120,
    "02 (PROCESS)": 200,
    ...
  },
  "by_location": {
    "EB YARD": 200,
    "WAREHOUSE": 150,
    ...
  },
  "by_make": {
    "TRINITY": 300,
    "OTHER": 206
  }
}
```

---

## UI 화면 3개 (통합)

### 화면 1: 자산 목록 개선 — `/assets`

**구조:**
- 상단: 검색바 + [필터 드로어] 버튼
- 본문: 테이블 또는 카드 (모바일 우선)
- 하단: 페이지네이션 + [대량 등록] [내보내기] [통계] 버튼

**필터 드로어 (P0 수정: 고급 검색 통합):**
- 카테고리 (체크박스)
- 상태 (라디오)
- 위치 (텍스트 입력 + 자동완성)
- 제조사 (드롭다운)
- 생산 연도 범위 (슬라이더)
- [필터 적용] [초기화] 버튼

---

### 화면 2: 대량 등록 마법사 — `/assets/bulk-import`

**Step 1: Excel 업로드**
- 파일 선택 + 드래그 앤 드롭
- [템플릿 다운로드] 링크
- 파일 크기 제한 (10MB)
- [다음] 버튼

**Step 2: 미리보기 & 검증**
- 검증 요약 (총 행 / 유효 / 오류)
- 오류 행 목록 (행 번호 + 에러 메시지)
- [오류 행 다운로드] 버튼 (P0 권장사항)
- 스크롤 가능한 미리보기 테이블 (첫 10행)
- [이전] [다음] 버튼

**Step 3: 확인 & 실행**
- 배치 정보 요약
- 진행률 표시 (처리 중)
- 완료 시 결과 요약
- [완료] 버튼

---

### 화면 3: 통계 대시보드 — `/assets/statistics`

**레이아웃:**
- 상단 요약 카드: 총 자산 수
- 그리드 레이아웃 (모바일 반응형):
  - 상태별 분포 (바 차트)
  - 카테고리별 분포 (바 차트)
  - 위치별 분포 (테이블)
  - 제조사별 분포 (테이블)

---

## 구현 일정

| 일자 | 작업 | 담당 | 산출물 |
|------|------|------|--------|
| 05-16 (금) | P0 설계 수정 완료 | 플레너 | DESIGN.md, API_GUIDE.md, db/29_*.sql |
| 05-16~17 | DB 마이그레이션 + GET endpoints | 웹개발자 | 1,2,3,4,5,17 구현 + 테스트 |
| 05-17~18 | POST/PUT/DELETE + bulk | 웹개발자 | 6,7,8,9 구현 |
| 05-18~19 | Import endpoints | 웹개발자 | 10,11,12,13,14,15,16 구현 |
| 05-19 | UI + 통계 + 배포 | 웹개발자 | 화면 1,2,3 + build + Vercel 배포 |

---

## 블로킹 & 위험요소

### ✅ 블로킹 해결 (P0 완료)
- 인덱스 충돌 제거 (IF NOT EXISTS)
- Excel 헤더 정정 (category_code → asset_class_code)
- RLS 정책 추가
- name_ta 컬럼 통일

### ⚠️ 성능 우려 (완화책)
- 1000+ 행 import: Supabase RPC 함수 사용 (단일 트랜잭션)
- FTS 인덱스: 506행 기준 무시 가능
- Audit trigger: 배치 단위 1 audit row 고려

### 📦 필수 의존성
- `xlsx` (읽기) — ✅ 설치됨
- `exceljs` (쓰기) — ✅ 설치됨
- `formidable` (업로드) — ✅ 설치됨
- Node `crypto` (해시) — ✅ 내장

---

**상태:** 🟢 설계 완료 (P0 3건 수정, MVP 16개 + Defer 9개 확정)
