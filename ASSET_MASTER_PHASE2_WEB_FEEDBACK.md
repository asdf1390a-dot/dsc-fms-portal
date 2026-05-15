# Asset Master v2 Phase 2 — 웹개발자 리뷰 피드백

> **작성:** 2026-05-15 (웹개발자)
> **대상:** ASSET_MASTER_PHASE2_DESIGN_SKELETON.md (1차 스켈톤)
> **결론:** 방향성 OK. 단, **범위 축소 + 일정 재조정 필요**. 25개 → 16개 우선, 나머지는 Phase 2.5로 이월 권장.

---

## 0. TL;DR (반드시 반영)

1. **DB 스키마 충돌:** `assets_status_idx`, `assets_search_idx`, `assets_location_idx` 는 `01_schema.sql` 에 **이미 존재**. SQL 파일에서 제거하지 않으면 마이그레이션 에러는 안 나도(IF NOT EXISTS) 혼선. FTS 인덱스는 기존 정의(`name_ko` 포함, `make` 누락)와 다르므로 **둘 중 하나로 통일** 필요.
2. **`category_code` 필드 부재:** 디자인의 Excel 헤더에 `category_code` 가 있으나 `assets` 테이블에는 `asset_class_code` 뿐. 카테고리는 class_code 의 prefix(`01.001` → category `01`)로 도출. **Excel 헤더를 `asset_class_code` 로 정정**해야 함.
3. **`name_ta` 누락:** Tamil 명칭 컬럼 존재. Excel 템플릿/검색/내보내기 모두 추가.
4. **Excel 라이브러리:** `xlsx`(SheetJS) + `exceljs` 가 이미 deps에 있음. 신규 추가 불필요. **읽기는 xlsx, 쓰기(스타일링)는 exceljs**로 역할 분리 권장.
5. **일정(05-19까지 25개):** 1인 기준 비현실적. **MVP 16개로 축소**하면 05-19 달성 가능.

---

## 1. API 구현 가능성 검토

### 1.1 우선순위 분류 (MVP=Phase 2 / Defer=Phase 2.5)

| # | Endpoint | 난이도 | 결정 | 사유 |
|----|----------|--------|------|------|
| 1 | GET /api/assets (페이지+필터) | 中 | **MVP** | 핵심. 기존 list 확장 |
| 2 | GET /api/assets/:id | 低 | **MVP** | 기존 존재 (대문자 `[assetId]`) |
| 3 | GET /api/assets/search (FTS) | 中 | **MVP** | 1과 통합 가능 (`?q=`) |
| 4 | GET /api/asset-categories | 低 | **MVP** | 정적, 캐시 |
| 5 | GET /api/assets/:id/history | 低 | **MVP** | 기존 history.js 활용 |
| 6 | POST /api/assets | 低 | **MVP** | 기존 |
| 7 | PUT /api/assets/:id | 低 | **MVP** | 기존 |
| 8 | DELETE /api/assets/:id | 低 | **MVP** | 기존 |
| 9 | POST /api/assets/bulk-update | 中 | **MVP** | RLS + audit trigger 고려 |
| 10 | DELETE /api/assets/bulk-delete | 中 | **Defer** | FK(BM/PM/Disposal) 위험. 단건 soft-delete가 안전 |
| 11 | POST /api/assets/import/preview | 高 | **MVP** | 핵심 신규 기능 |
| 12 | POST /api/assets/import/validate | 中 | **MVP** | 11과 합치는 게 깔끔 (preview=validate) |
| 13 | POST /api/assets/import/execute | 高 | **MVP** | 트랜잭션 + 부분 실패 처리 |
| 14 | GET /api/assets/import/batches | 低 | **MVP** | |
| 15 | GET /api/assets/import/batches/:id | 低 | **MVP** | |
| 16 | GET /api/assets/import/batches/:id/items | 低 | **MVP** | |
| 17 | DELETE /api/assets/import/batches/:id | 低 | **Defer** | 운영 빈도 낮음 |
| 18 | POST /api/assets/validate | 中 | **Defer** | 11/12에 흡수 가능 |
| 19 | GET /api/assets/deduplicate | 高 | **Defer** | machine_asset_number UNIQUE 제약으로 1차 차단. 휴리스틱 매칭은 후일 |
| 20 | GET /api/assets/validation-report | 中 | **Defer** | 24 (statistics)와 통합 가능 |
| 21 | POST /api/assets/merge | 高 | **Defer** | FK 재연결 위험. 별도 설계 필요 |
| 22 | GET /api/assets/missing-fields | 中 | **Defer** | 22 (statistics) 일부로 |
| 23 | GET /api/assets/export/excel | 中 | **MVP** | exceljs 스트리밍 |
| 24 | GET /api/assets/statistics | 中 | **MVP** | SQL 집계 RPC 권장 |
| 25 | GET /api/assets/statistics/timeline | 中 | **Defer** | 24 응답에 포함 가능 |

**MVP 합계: 16개 / Defer: 9개**

### 1.2 의존성 (라이브러리)

| 용도 | 라이브러리 | 상태 |
|------|----------|------|
| Excel 읽기 | `xlsx` ^0.18.5 | ✅ 설치됨 |
| Excel 쓰기 (스타일) | `exceljs` ^4.4.0 | ✅ 설치됨 |
| 파일 업로드 | `formidable` ^3.5.4 | ✅ 설치됨 |
| 스키마 검증 | `zod` ^4.4.3 | ✅ 설치됨 |
| 해시 (file_hash) | Node `crypto` 내장 | ✅ |

**신규 추가 불필요.**

### 1.3 성능 우려사항

| 우려 | 원인 | 완화책 |
|------|------|--------|
| 1000+ 행 import 타임아웃 | Vercel serverless 10s(hobby)/60s(pro) 제한 | (a) Supabase `rpc` 로 bulk insert 위임 (b) 100행 단위 chunk + 클라이언트 폴링 (c) batch row 사전 저장 후 background trigger |
| FTS gin 인덱스 빌드 시간 | 506행 → 무시 가능. 5000+ 시 수초 | 마이그레이션 1회만, 운영 영향 X |
| `to_tsvector('simple', ...)` 멀티언어 | Tamil/한글 토큰화 미흡 | MVP는 `simple` 유지. 추후 trigram(`pg_trgm`) 병행 검토 |
| audit trigger × bulk insert | 506→2000행 INSERT 시 audit rows 2000개 동시 발생 | INSERT 트리거 비활성 옵션? 또는 batch 단위 1 audit row |
| `import_result jsonb` 비대화 | 1000 행 × 에러 메시지 → MB 단위 | 에러는 `asset_import_items.validation_errors` 에만 두고 summary만 jsonb |

**권장:** import execute 는 **Supabase Postgres function (`rpc`)** 으로 작성. JS에서는 검증된 행 배열을 한 번에 넘기고 함수 내에서 `INSERT ... SELECT FROM jsonb_to_recordset(...)` 처리. → 단일 트랜잭션 + 빠름.

---

## 2. 기술 선택 피드백

### 2.1 Excel 라이브러리

| 선택지 | 평가 |
|--------|------|
| **xlsx (SheetJS)** | 읽기/파싱 최강. 한국어/Tamil 셀 안정. **import 파이프라인 채택** |
| **exceljs** | 스타일/머지/이미지 강함. 큰 파일 스트리밍 OK. **export 채택** |
| papaparse | CSV 전용. xlsx 못 읽음. 본 케이스 부적합 |

**결정:** 둘 다 유지. 신규 의존성 없음.

### 2.2 대량 처리 전략

**권장: 하이브리드 (배치 + 비동기)**

```
[Client]
  ↓ multipart upload
[POST /import/preview]   ← 파일 파싱 + asset_import_batches/items 저장 (status=pending)
  ↓ 응답: batch_id + 첫 20행 preview + 오류 요약
[Client 확인]
  ↓ POST /import/execute { batch_id, confirm:true }
[Server: 100행씩 chunk → supabase rpc bulk_insert_assets]
  ↓ items.status 업데이트
[Client polling GET /import/batches/:id (1초 간격)]
  ↓ status=completed
```

**핵심:** preview 단계에서 **모든 행을 DB에 임시 저장**(items 테이블) → execute 는 그 검증된 결과만 처리. 클라이언트 재연결 안정.

### 2.3 DB 인덱스 전략 — 충돌 분석

01_schema.sql 에 이미 존재:
- ✅ `assets_status_idx`
- ✅ `assets_search_idx` (FTS, simple, name_ko 포함)

스켈톤이 새로 만들겠다고 한 것:
- ❌ `assets_status_idx` — **중복**
- ❌ `assets_search_idx` — **중복이지만 정의 다름** (name_ko 빠지고 make 추가)
- ⚠️ `assets_location_idx` — 신규 OK
- ⚠️ `assets_updated_at_idx` — 신규 OK (단, `assets` 에 `updated_at` 컬럼 존재 여부 확인 필요)

**Action:**
1. 신규 SQL(`db/29_*`)에는 `DROP INDEX IF EXISTS assets_search_idx;` 후 재생성 — 또는 기존 유지하고 새 인덱스 이름 사용
2. FTS 토큰에 `name_ko`, `name_ta` 모두 포함하도록 통일
3. `assets.updated_at` 컬럼 존재 확인 (없으면 추가 + trigger)

### 2.4 추가 인덱스 권장

```sql
-- 카테고리 필터는 prefix 매칭(LIKE '01.%') 이므로 b-tree 로 충분
create index if not exists assets_class_code_idx on assets(asset_class_code);

-- bulk import 중복 사전 차단
create unique index if not exists assets_machine_asset_number_uidx 
  on assets(machine_asset_number);  -- 이미 UNIQUE constraint 있으면 skip
```

---

## 3. 일정 검증

### 3.1 Phase 1 DB(`28_asset_master_v2.sql`) — **이미 작은 변경**
- 내용: `asset_qr_scans` 테이블 1개만 추가. Phase 2 와 무관.
- **Phase 2 마이그레이션은 `db/29_asset_master_v2_phase2.sql` 신규 파일**로 분리하는 게 맞음. (스켈톤도 동일 의견)
- 적용 가능: ✅ 위험도 낮음. 단, 사용자에게 Supabase SQL Editor 1회 실행 요청 필요.

### 3.2 05-19까지 16개 MVP 달성 가능성

| 일자 | 작업 |
|------|------|
| 05-16 (금) | DB 마이그레이션 작성 + 사용자 적용 / GET endpoints (1,2,3,4,5) |
| 05-17 (토) | POST/PUT/DELETE + bulk-update (6,7,8,9) |
| 05-18 (일) | Import preview/validate/execute (11,12,13) + batches list (14,15,16) |
| 05-19 (월) | Export (23) + Statistics (24) + UI 통합 / 빌드 / 배포 |

**가능. 단 조건:**
- UI 4개 중 **2개(목록 개선, 대량 등록)만 05-19 완료**, 나머지 2개(고급 검색, 통계 대시보드)는 05-20~21
- Defer 9개는 Phase 2.5 (05-22~)로 명시

### 3.3 우선순위 조정 제안

1. **즉시 (05-16):** SQL 적용 + 충돌 인덱스 해소
2. **블로커 제거:** `assets.updated_at` 컬럼/트리거 확인
3. **Critical path:** import preview→execute → 사용자 가치 가장 큼

---

## 4. 우려사항 / 제안

### 4.1 누락된 엔드포인트

| 추가 권장 | 이유 |
|-----------|------|
| `GET /api/assets/import/template.xlsx` | 사용자가 다운로드할 빈 템플릿. exceljs 로 생성, 헤더+예시 1행 |
| `POST /api/assets/import/batches/:id/retry-failed` | 실패행만 재처리. items.status='error' 만 다시 |
| `GET /api/assets/locations` | 위치 자동완성용 distinct list |
| `GET /api/assets/makes` | 제조사 자동완성용 |

### 4.2 DB 스키마 문제점

1. **`asset_import_batches.batch_date date default now()`** — `date` 타입에 `now()` 는 명시적 cast 필요. `default current_date` 로 변경.
2. **`raw_data jsonb not null`** — Excel 컬럼 변경 시 호환성 떨어짐. OK이나, 키 정규화(공백→snake_case) 로직 클라이언트/서버 합의 필요.
3. **RLS 정책 누락** — 신규 2테이블에 RLS 명시 없음. 추가 필요:
   ```sql
   alter table asset_import_batches enable row level security;
   create policy "auth_all_import_batches" on asset_import_batches
     for all to authenticated using (true) with check (true);
   -- items 동일
   ```
4. **`created_by/updated_by`** — auth.users 참조하지만 service_role 작성 시 NULL 허용 OK인지 명시.
5. **삭제 cascade** — `asset_import_batches` 삭제 시 `asset_import_items` cascade 되지만, **생성된 assets 는 유지되어야 함** (현재 설계 OK, 다만 문서에 명시).

### 4.3 UI 화면 수정

| 화면 | 의견 |
|------|------|
| 화면 1 (목록) | 카드/테이블 토글 OK. 단 **모바일 우선** 원칙상 카드 기본, 데스크톱 768px+ 만 테이블 |
| 화면 2 (대량등록) | 3-step OK. **Step 2 검증 화면에서 에러 행 다운로드** 기능 추가 권장 (사용자가 Excel에서 수정 후 재업로드) |
| 화면 3 (고급검색) | `/assets/search` 분리는 과함. **목록(/assets)의 필터 드로어로 통합** 권장. 화면 줄어듦 |
| 화면 4 (통계) | recharts 이미 설치됨. 바차트/라인차트 OK. 지도는 일정상 제외 |

→ **UI 4개 → 3개로 축소** (화면3 통합)

### 4.4 보안/RLS

- `bulk-update`, `import/execute` 는 **반드시 server-side** (`pages/api/`) 에서 service_role 사용. 클라이언트 anon 으로 직접 호출 금지.
- `formidable` 파일 업로드 시 **MIME 화이트리스트** (`xlsx`, `xls` 만) + **크기 제한 10MB**.
- `file_hash` 중복 시 **400 또는 기존 batch_id 반환** 선택 — 정책 명시 필요.

### 4.5 i18n

- Excel 템플릿에 `name_ta` 컬럼 필수 추가.
- 검증 에러 메시지는 ko + en 둘 다 반환 (`{ ko: "...", en: "..." }`).

---

## 5. 우선순위 있는 변경사항 (반영 순서)

| 순위 | 변경 사항 | 담당 | 마감 |
|------|----------|------|------|
| 🔴 P0 | Excel 헤더 `category_code` → `asset_class_code` 로 정정 + `name_ta` 추가 | 플레너 | 05-16 AM |
| 🔴 P0 | 신규 SQL 에서 기존 인덱스(`assets_status_idx`, `assets_search_idx`) 충돌 해소 | 플레너 | 05-16 AM |
| 🔴 P0 | `asset_import_batches/items` RLS 정책 추가 | 플레너 | 05-16 AM |
| 🟡 P1 | API 25개 → 16개 MVP 축소, 9개 Phase 2.5로 이월 명시 | 플레너 | 05-16 |
| 🟡 P1 | 템플릿 다운로드 endpoint(`/import/template.xlsx`) 추가 | 플레너 | 05-16 |
| 🟡 P1 | `assets.updated_at` 컬럼 존재 확인 (없으면 추가 SQL) | 웹개발자 | 05-16 |
| 🟢 P2 | `/assets/search` 화면 → `/assets` 필터 드로어로 통합 | 플레너 | 05-17 |
| 🟢 P2 | import execute 를 Supabase rpc 함수로 작성 (성능) | 웹개발자 | 05-18 |
| 🟢 P2 | 실패행만 재처리 endpoint 추가 | 플레너 | 05-17 |
| 🟢 P2 | 위치/제조사 자동완성 endpoint 추가 | 플레너 | 05-17 |

---

## 6. 다음 단계 (웹개발자 액션)

1. 플레너 P0 반영 대기 (05-16 AM)
2. 반영 완료 후 `db/29_asset_master_v2_phase2.sql` 검증 + 사용자에게 적용 요청 안내
3. `pages/api/assets/import/*` 디렉터리 구조 잡고 preview 부터 구현 착수
4. 05-19 18:00 까지 MVP 16개 + UI 3개 빌드 통과 + Vercel 배포

---

**결론:** 설계 방향 OK. P0 3건만 즉시 수정하면 05-19 MVP 가능. Defer 9건은 Phase 2.5(05-22~)로 명시하고 진행.
