# Asset Master v2 API 명세서

> **작성일:** 2026-05-15  
> **버전:** v2.0 (Option A 증분 업그레이드)  
> **엔드포인트 수:** 25개  
> **기본 URL:** `https://dsc-fms-portal.vercel.app/api/assets`  

---

## 목차

1. [개요](#개요)
2. [인증 & 보안](#인증--보안)
3. [자산 CRUD](#자산-crud)
4. [QR 코드](#qr-코드)
5. [자산 이력](#자산-이력)
6. [검색 & 필터](#검색--필터)
7. [대량 임포트](#대량-임포트)
8. [QR 스캔 로그](#qr-스캔-로그)
9. [통계 & 보고](#통계--보고)
10. [내보내기](#내보내기)
11. [에러 처리](#에러-처리)
12. [성능 최적화](#성능-최적화)

---

## 개요

### 설계 원칙

1. **기존 호환성:** 506개 기존 자산 100% 유지
2. **모바일 우선:** 스마트폰/태블릿에서 QR 스캔 → 즉시 조회
3. **RESTful 표준:** GET, POST, PUT, DELETE 명확한 구분
4. **JSON 기반:** 모든 요청/응답은 JSON
5. **페이징:** 500개 자산도 성능 저하 없음 (20개/페이지)

### 기술 스택

- **호스팅:** Vercel (Next.js 14)
- **DB:** Supabase Postgres
- **인증:** Supabase Auth (JWT 토큰)
- **API 스타일:** Next.js API Routes + Supabase PostgREST

---

## 인증 & 보안

### 요청 헤더 (필수)

모든 요청에 다음 헤더를 포함해야 함:

```http
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**토큰 획득:**
```javascript
// 클라이언트 코드
const token = localStorage.getItem('sb-token');
// 또는 Supabase 세션에서:
const { data: { session } } = await supabase.auth.getSession();
```

### RLS 정책 (Row Level Security)

현재: 모든 authenticated 사용자 → 전체 접근 (READ/WRITE)

```sql
-- 예시 (향후 개선)
create policy "auth_all_assets" on assets
  for all to authenticated using (true) with check (true);
```

### 오류 응답

**401 Unauthorized:**
```json
{
  "success": false,
  "error": { "message": "Unauthorized" }
}
```

**403 Forbidden:**
```json
{
  "success": false,
  "error": { "message": "Forbidden" }
}
```

---

## 자산 CRUD

### 1. 자산 목록 조회

**요청:**
```http
GET /api/assets?page=1&limit=20&category=01&status=active&sort=updated_at.desc
Authorization: Bearer <TOKEN>
```

**쿼리 매개변수:**

| 매개변수 | 타입 | 기본값 | 설명 |
|---------|------|-------|------|
| `page` | int | 1 | 페이지 번호 |
| `limit` | int | 20 | 한 페이지당 행 수 (최대 100) |
| `category` | text | - | 카테고리 코드 필터 (예: '01') |
| `status` | text | - | 상태 필터 (active/idle/maintenance/sold/scrapped) |
| `location_like` | text | - | 위치 포함 검색 |
| `make` | text | - | 제조사 필터 |
| `sort` | text | created_at.desc | 정렬 (field.asc/desc) |

**응답 (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "asset_class_code": "01.001",
      "machine_asset_code": "01.001.001",
      "machine_asset_number": "DCMI-UTL-PSF-01",
      "serial_no": null,
      "name_en": "SUB STATION",
      "name_ta": null,
      "model": "EB - SUB STSTION",
      "make": null,
      "year_of_manufacture": null,
      "location": "EB YARD",
      "status": "active",
      "qr_payload": "DCMI-UTL-PSF-01",
      "photos": [],
      "remark": null,
      "extra": {},
      "created_at": "2026-05-01T10:00:00Z",
      "updated_at": "2026-05-15T10:00:00Z",
      "created_by": "user-uuid-1",
      "updated_by": "user-uuid-1"
    },
    ...
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 506,
    "pages": 26
  }
}
```

**에러 응답:**
- `400 Bad Request` — 잘못된 페이지 번호
- `401 Unauthorized` — 토큰 없음
- `500 Internal Server Error` — DB 오류

---

### 2. 자산 상세 조회

**요청:**
```http
GET /api/assets/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer <TOKEN>
```

**응답 (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "asset_class_code": "01.001",
    "machine_asset_code": "01.001.001",
    "machine_asset_number": "DCMI-UTL-PSF-01",
    "serial_no": null,
    "name_en": "SUB STATION",
    "name_ta": null,
    "model": "EB - SUB STSTION",
    "make": null,
    "year_of_manufacture": null,
    "location": "EB YARD",
    "status": "active",
    "qr_payload": "DCMI-UTL-PSF-01",
    "photos": [],
    "remark": null,
    "extra": {},
    "created_at": "2026-05-01T10:00:00Z",
    "updated_at": "2026-05-15T10:00:00Z",
    "created_by": "user-uuid-1",
    "updated_by": "user-uuid-1"
  }
}
```

**에러 응답:**
- `404 Not Found` — 자산 없음
- `401 Unauthorized` — 토큰 없음

---

### 3. 자산 신규 생성

**요청:**
```http
POST /api/assets
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "asset_class_code": "01.001",
  "machine_asset_number": "DCMI-UTL-PSF-99",
  "serial_no": null,
  "name_en": "NEW SUBSTATION",
  "name_ta": null,
  "model": "EB - SUBSTATION",
  "make": "TRINITY",
  "year_of_manufacture": 2026,
  "location": "EB YARD",
  "status": "active",
  "remark": "신규 설치",
  "photos": [],
  "qr_payload": "DCMI-UTL-PSF-99"
}
```

**필수 필드:**
- `asset_class_code` — 자산 분류 코드 (존재해야 함)
- `machine_asset_number` — 물리 태그 (유니크)
- `name_en` — 자산명 (영문)
- `location` — 위치
- `status` — 상태 (기본값: 'active')

**선택 필드:**
- `serial_no`, `name_ta`, `model`, `make`, `year_of_manufacture`, `remark`, `photos`, `qr_payload`

**검증 규칙:**
```
1. asset_class_code:
   - 필수
   - asset_classes 테이블에 존재해야 함 (FK)

2. machine_asset_number:
   - 필수
   - 기존 자산과 중복 불가 (UNIQUE)
   - 패턴: 영문 + 숫자 (예: DCMI-UTL-PSF-99)

3. name_en:
   - 필수
   - 최소 3자

4. status:
   - 기본값: 'active'
   - 허용값: 'active', 'idle', 'maintenance', 'sold', 'scrapped'
```

**응답 (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "new-asset-uuid",
    "asset_class_code": "01.001",
    "machine_asset_number": "DCMI-UTL-PSF-99",
    "name_en": "NEW SUBSTATION",
    "location": "EB YARD",
    "status": "active",
    "qr_payload": "DCMI-UTL-PSF-99",
    "created_at": "2026-05-15T10:00:00Z",
    "updated_at": "2026-05-15T10:00:00Z",
    "created_by": "user-uuid",
    "updated_by": "user-uuid"
  }
}
```

**에러 응답:**
- `400 Bad Request` — 필드 검증 실패
- `409 Conflict` — 중복 물리 태그
- `401 Unauthorized` — 토큰 없음

---

### 4. 자산 수정

**요청:**
```http
PUT /api/assets/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "location": "WORKSHOP",
  "status": "maintenance",
  "remark": "예방점검 중"
}
```

**부분 업데이트 지원:** 변경할 필드만 포함

**응답 (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "location": "WORKSHOP",
    "status": "maintenance",
    "remark": "예방점검 중",
    "updated_at": "2026-05-15T10:30:00Z",
    "updated_by": "user-uuid"
  }
}
```

**자동 감시:**
- `asset_audit` 테이블에 변경 사항 기록 (트리거)
- `updated_at` 자동 갱신

---

### 5. 자산 삭제

**요청:**
```http
DELETE /api/assets/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer <TOKEN>
```

**응답 (200 OK):**
```json
{
  "success": true,
  "message": "Asset deleted"
}
```

**삭제 전 검증:**
```
1. FK 체크: BM, PM, Disposal 이력이 있으면 삭제 거부
   → 응답: 409 Conflict
   → 메시지: "Cannot delete asset with related BM/PM records"
   → 대안: status를 'scrapped'로 변경

2. 권한 체크: admin 역할만 삭제 가능 (향후 추가)
```

**에러 응답:**
- `404 Not Found` — 자산 없음
- `409 Conflict` — FK 제약 위반 (관련 BM/PM 이력 존재)
- `401 Unauthorized` — 토큰 없음

---

## QR 코드

### 1. QR 페이로드로 자산 조회 (스캔)

**목적:** 모바일에서 QR 스캔 → 즉시 자산 상세 조회

**요청:**
```http
GET /api/assets/qr/DCMI-UTL-PSF-01
Authorization: Bearer <TOKEN>
```

**응답 (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "machine_asset_number": "DCMI-UTL-PSF-01",
    "name_en": "SUB STATION",
    "location": "EB YARD",
    "status": "active",
    ...
  }
}
```

**에러 응답:**
- `404 Not Found` — QR 페이로드가 일치하는 자산 없음

---

### 2. QR 페이로드 재생성

**목적:** 손상된 QR 코드 → 새로운 페이로드로 재지정

**요청:**
```http
PUT /api/assets/550e8400-e29b-41d4-a716-446655440000/qr
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "qr_payload": "DCMI-UTL-PSF-01-V2"
}
```

또는 자동 생성 (기본값 = machine_asset_number):

```http
PUT /api/assets/550e8400-e29b-41d4-a716-446655440000/qr
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "mode": "auto"
}
```

**응답 (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-...",
    "qr_payload": "DCMI-UTL-PSF-01-V2",
    "updated_at": "2026-05-15T10:30:00Z"
  }
}
```

---

### 3. QR 코드 이미지 생성

**목적:** PNG 또는 SVG 형식의 QR 코드 이미지 생성 → 다운로드/인쇄

**요청:**
```http
GET /api/assets/550e8400-e29b-41d4-a716-446655440000/qr/generate?format=png&size=300
Authorization: Bearer <TOKEN>
```

**쿼리 매개변수:**

| 매개변수 | 타입 | 기본값 | 설명 |
|---------|------|-------|------|
| `format` | text | png | 이미지 형식 (png/svg) |
| `size` | int | 200 | 픽셀 크기 (px) |
| `include_text` | bool | true | 자산명 텍스트 포함 여부 |

**응답 (200 OK):**
```
Content-Type: image/png
(바이너리 PNG 데이터)
```

**예시 (curl):**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://dsc-fms-portal.vercel.app/api/assets/550e8400-e29b-41d4-a716-446655440000/qr/generate?format=png&size=300" \
  -o qr_code.png
```

---

## 자산 이력

### 1. 변경 이력 조회 (타임라인)

**목적:** 자산의 모든 변경 기록 조회 (누가, 언제, 무엇을)

**요청:**
```http
GET /api/assets/550e8400-e29b-41d4-a716-446655440000/audit?limit=20&sort=changed_at.desc
Authorization: Bearer <TOKEN>
```

**쿼리 매개변수:**

| 매개변수 | 타입 | 기본값 | 설명 |
|---------|------|-------|------|
| `limit` | int | 20 | 최대 행 수 |
| `offset` | int | 0 | 시작 위치 |
| `sort` | text | changed_at.desc | 정렬 |
| `action` | text | - | 필터: insert/update/delete/status_change |

**응답 (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "audit-uuid-1",
      "asset_id": "550e8400-...",
      "action": "status_change",
      "changed_at": "2026-05-14T12:30:00Z",
      "changed_by": "user-uuid-kim",
      "diff": {
        "before": { "status": "active" },
        "after": { "status": "maintenance" },
        "fields_changed": ["status"]
      }
    },
    {
      "id": "audit-uuid-2",
      "asset_id": "550e8400-...",
      "action": "update",
      "changed_at": "2026-05-13T09:45:00Z",
      "changed_by": "user-uuid-lee",
      "diff": {
        "before": { "location": "EB YARD" },
        "after": { "location": "WORKSHOP" },
        "fields_changed": ["location"]
      }
    },
    {
      "id": "audit-uuid-3",
      "asset_id": "550e8400-...",
      "action": "insert",
      "changed_at": "2026-05-10T14:20:00Z",
      "changed_by": "user-uuid-admin",
      "diff": {
        "after": { "id": "...", "name_en": "SUB STATION", ... }
      }
    }
  ],
  "pagination": {
    "total": 3,
    "limit": 20,
    "offset": 0
  }
}
```

**동작:**
- `asset_audit` 트리거에서 자동 기록
- INSERT/UPDATE/DELETE 시 자동으로 감시 로그 생성

---

### 2. 특정 변경 전후 비교

**목적:** 두 버전 간의 구체적 변경사항 비교

**요청:**
```http
GET /api/assets/550e8400-e29b-41d4-a716-446655440000/audit/diff?audit_id_1=audit-uuid-1&audit_id_2=audit-uuid-2
Authorization: Bearer <TOKEN>
```

또는 시간 범위로:

```http
GET /api/assets/550e8400-e29b-41d4-a716-446655440000/audit/diff?from=2026-05-10&to=2026-05-15
Authorization: Bearer <TOKEN>
```

**응답 (200 OK):**
```json
{
  "success": true,
  "data": {
    "asset_id": "550e8400-...",
    "period": {
      "from": "2026-05-10T14:20:00Z",
      "to": "2026-05-14T12:30:00Z"
    },
    "changes": [
      {
        "field": "status",
        "initial": "active",
        "final": "maintenance",
        "changed_on": "2026-05-14T12:30:00Z",
        "changed_by": "user-uuid-kim"
      },
      {
        "field": "location",
        "initial": "EB YARD",
        "final": "WORKSHOP",
        "changed_on": "2026-05-13T09:45:00Z",
        "changed_by": "user-uuid-lee"
      }
    ]
  }
}
```

---

## 검색 & 필터

### 1. 텍스트 검색

**목적:** 자산명, 제조사, 모델, 태그 등으로 전체 검색

**요청:**
```http
GET /api/assets/search?q=compressor&limit=20
Authorization: Bearer <TOKEN>
```

**쿼리 매개변수:**

| 매개변수 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| `q` | text | ✅ | 검색어 (최소 2자) |
| `limit` | int | - | 최대 결과 수 (기본 20) |
| `fields` | text | - | 검색 범위 (name,make,model 쉼표로 구분) |

**검색 범위 (기본값 = 모두):**
- `name` — name_en, name_ta
- `make` — 제조사
- `model` — 모델
- `serial_no` — 시리얼 번호
- `location` — 위치

**응답 (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "name_en": "AIR COMPRESSOR 50HP - 01",
      "make": "KAESER",
      "model": "COMPRESSOR-1 50HP",
      "location": "COMPRESSOR ROOM - 01",
      "status": "active"
    }
  ],
  "pagination": {
    "total": 5,
    "limit": 20
  }
}
```

**구현:** PostgreSQL Full Text Search (tsvector 인덱스)

---

### 2. 카테고리 목록 (필터 옵션)

**목적:** UI의 필터 드롭다운에 카테고리 목록 제공

**요청:**
```http
GET /api/assets/categories
Authorization: Bearer <TOKEN>
```

**응답 (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "code": "01",
      "name_en": "UTILITY",
      "name_ko": "유틸리티",
      "display_order": 1
    },
    {
      "code": "02",
      "name_en": "PROCESS",
      "name_ko": "생산설비",
      "display_order": 2
    },
    ...
  ]
}
```

---

### 3. 자산 분류 목록 (필터 옵션)

**목적:** 선택한 카테고리의 세부 분류 목록

**요청:**
```http
GET /api/assets/classes?category=01
Authorization: Bearer <TOKEN>
```

**쿼리 매개변수:**

| 매개변수 | 타입 | 설명 |
|---------|------|------|
| `category` | text | 카테고리 코드 필터 (선택) |

**응답 (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "code": "01.001",
      "category_code": "01",
      "name_en": "POWER SUPPLY FACILITY (COMMON)",
      "name_ko": "전력 공급 설비",
      "expected_qty": 15
    },
    {
      "code": "01.001A",
      "category_code": "01",
      "name_en": "MV PANNEL",
      "name_ko": "MV 판넬",
      "expected_qty": 3
    },
    ...
  ]
}
```

---

## 대량 임포트

### 1. Excel 파일 검증

**목적:** 업로드한 Excel/CSV 파일 사전 검증 (실제 임포트 전)

**요청 (multipart/form-data):**
```http
POST /api/assets/import/validate
Authorization: Bearer <TOKEN>
Content-Type: multipart/form-data

[파일 업로드: assets_import.xlsx]
```

**지원 형식:**
- `.xlsx` (Excel 2007+)
- `.csv` (UTF-8 인코딩)

**필수 컬럼:**
- `machine_asset_number` — 물리 태그
- `name_en` — 자산명 (영문)
- `asset_class_code` — 자산 분류

**선택 컬럼:**
- `serial_no`, `name_ta`, `model`, `make`, `year_of_manufacture`, `location`, `status`, `remark`

**응답 (200 OK):**
```json
{
  "success": true,
  "data": {
    "file_name": "assets_import.xlsx",
    "total_rows": 50,
    "valid_rows": 48,
    "errors": [
      {
        "row": 2,
        "field": "machine_asset_number",
        "value": "DCMI-UTL-PSF-01",
        "message": "Duplicate asset (existing asset in DB)"
      },
      {
        "row": 3,
        "field": "asset_class_code",
        "value": "99.999",
        "message": "Asset class not found"
      }
    ],
    "preview": [
      {
        "machine_asset_number": "DCMI-NEW-001",
        "name_en": "New Asset 1",
        "asset_class_code": "01.001",
        "location": "EB YARD",
        "status": "active"
      },
      {
        "machine_asset_number": "DCMI-NEW-002",
        "name_en": "New Asset 2",
        "asset_class_code": "01.002",
        "location": "COMPRESSOR ROOM",
        "status": "active"
      }
    ],
    "validation_summary": {
      "ready_to_import": 48,
      "has_errors": 2,
      "duplicate_tags": 2,
      "invalid_class_codes": 0
    }
  }
}
```

**검증 규칙:**
```
1. 필수 컬럼 존재 여부
2. 물리 태그 중복 (기존 자산과)
3. 자산 분류 존재 여부
4. 필드 타입 검증 (year_of_manufacture = 숫자)
5. 상태값 유효성 (active/idle/maintenance/sold/scrapped)
```

---

### 2. 대량 임포트 실행

**요청:**
```http
POST /api/assets/import/execute
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "file_name": "assets_import.xlsx",
  "duplicate_handling": "skip",
  "import_session_id": "session-uuid-from-validate"
}
```

**매개변수:**

| 매개변수 | 타입 | 옵션 | 설명 |
|---------|------|------|------|
| `duplicate_handling` | text | skip / update | 중복 물리태그 처리 방식 |
| `import_session_id` | text | - | validate 응답의 session ID |

**응답 (202 Accepted):**
```json
{
  "success": true,
  "data": {
    "batch_id": "batch-uuid-20260515-001",
    "file_name": "assets_import.xlsx",
    "total_rows": 48,
    "status": "processing",
    "created_at": "2026-05-15T10:00:00Z",
    "estimated_completion": "2026-05-15T10:05:00Z"
  }
}
```

**동작:**
1. 검증된 파일을 트랜잭션으로 임포트 (전체 성공 또는 전체 실패)
2. 각 자산에 `extra.import_source = 'bulk_import'` 설정
3. 각 자산에 `extra.batch_id` 저장
4. 비동기 처리 (백그라운드 작업)

---

### 3. 임포트 진행률 조회

**요청:**
```http
GET /api/assets/import/status/batch-uuid-20260515-001
Authorization: Bearer <TOKEN>
```

**응답 (200 OK):**
```json
{
  "success": true,
  "data": {
    "batch_id": "batch-uuid-20260515-001",
    "status": "completed",
    "progress": {
      "total": 48,
      "completed": 48,
      "failed": 0,
      "skipped": 0,
      "percentage": 100
    },
    "started_at": "2026-05-15T10:00:00Z",
    "completed_at": "2026-05-15T10:03:45Z",
    "duration_seconds": 225,
    "result": {
      "inserted": 48,
      "updated": 0,
      "skipped": 0,
      "errors": []
    }
  }
}
```

**상태:**
- `pending` — 대기 중
- `processing` — 진행 중
- `completed` — 완료
- `failed` — 실패

---

### 4. 임포트 이력 조회

**요청:**
```http
GET /api/assets/import/history?limit=10&sort=created_at.desc
Authorization: Bearer <TOKEN>
```

**응답 (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "batch_id": "batch-uuid-20260515-001",
      "file_name": "assets_import.xlsx",
      "status": "completed",
      "total_rows": 48,
      "inserted": 48,
      "updated": 0,
      "failed": 0,
      "created_at": "2026-05-15T10:00:00Z",
      "created_by": "user-uuid-admin"
    }
  ],
  "pagination": {
    "total": 3,
    "limit": 10
  }
}
```

---

## QR 스캔 로그

### 1. QR 스캔 기록

**목적:** 현장에서 QR 스캔한 이력 자동 기록 (추적용)

**요청:**
```http
POST /api/assets/550e8400-e29b-41d4-a716-446655440000/qr/scan
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "qr_payload": "DCMI-UTL-PSF-01",
  "device_info": "Samsung Galaxy Tab S7 / Chrome 126.0",
  "location_gps": "13.1939,80.1705"
}
```

**매개변수:**

| 매개변수 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| `qr_payload` | text | ✅ | 스캔한 QR 페이로드 |
| `device_info` | text | - | 스캔 기기 정보 |
| `location_gps` | text | - | GPS 좌표 (위도,경도) |

**응답 (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "scan-uuid",
    "asset_id": "550e8400-...",
    "qr_payload": "DCMI-UTL-PSF-01",
    "scanned_at": "2026-05-15T10:00:00Z",
    "scanned_by": "user-uuid",
    "device_info": "Samsung Galaxy Tab S7 / Chrome 126.0",
    "location_gps": "13.1939,80.1705"
  }
}
```

---

### 2. 해당 자산의 스캔 로그 조회

**요청:**
```http
GET /api/assets/550e8400-e29b-41d4-a716-446655440000/qr/scans?limit=20&sort=scanned_at.desc
Authorization: Bearer <TOKEN>
```

**응답 (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "scan-uuid-3",
      "asset_id": "550e8400-...",
      "qr_payload": "DCMI-UTL-PSF-01",
      "scanned_at": "2026-05-15T14:00:00Z",
      "scanned_by": "user-uuid-tech2",
      "device_info": "iPhone 15 Pro / Safari"
    },
    {
      "id": "scan-uuid-2",
      "asset_id": "550e8400-...",
      "qr_payload": "DCMI-UTL-PSF-01",
      "scanned_at": "2026-05-15T10:00:00Z",
      "scanned_by": "user-uuid-tech1",
      "device_info": "Samsung Galaxy Tab S7"
    }
  ],
  "pagination": {
    "total": 2,
    "limit": 20
  }
}
```

---

## 통계 & 보고

### 1. 통계 요약

**목적:** 자산 현황 한눈에 보기 (대시보드)

**요청:**
```http
GET /api/assets/stats/summary
Authorization: Bearer <TOKEN>
```

**응답 (200 OK):**
```json
{
  "success": true,
  "data": {
    "total_assets": 506,
    "by_status": {
      "active": 450,
      "idle": 40,
      "maintenance": 10,
      "sold": 5,
      "scrapped": 1
    },
    "by_category": {
      "01": 120,
      "02": 95,
      "03": 80,
      "04": 70,
      "05": 20,
      "06": 10,
      "07": 11
    },
    "last_updated": "2026-05-15T10:00:00Z"
  }
}
```

---

### 2. 카테고리별 자산 수

**요청:**
```http
GET /api/assets/stats/by-category
Authorization: Bearer <TOKEN>
```

**응답 (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "category_code": "01",
      "category_name": "UTILITY",
      "total": 120,
      "active": 110,
      "idle": 5,
      "maintenance": 3,
      "sold": 2,
      "scrapped": 0
    },
    {
      "category_code": "02",
      "category_name": "PROCESS",
      "total": 95,
      "active": 90,
      "idle": 2,
      "maintenance": 2,
      "sold": 1,
      "scrapped": 0
    }
  ]
}
```

---

### 3. 상태별 자산 분포

**요청:**
```http
GET /api/assets/stats/by-status
Authorization: Bearer <TOKEN>
```

**응답 (200 OK):**
```json
{
  "success": true,
  "data": {
    "active": 450,
    "idle": 40,
    "maintenance": 10,
    "sold": 5,
    "scrapped": 1
  }
}
```

---

### 4. 위치별 자산 분포

**요청:**
```http
GET /api/assets/stats/by-location
Authorization: Bearer <TOKEN>
```

**응답 (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "location": "COMPRESSOR ROOM - 01",
      "total": 25,
      "active": 22,
      "maintenance": 2,
      "idle": 1
    },
    {
      "location": "PRESS SHOP",
      "total": 30,
      "active": 28,
      "maintenance": 2,
      "idle": 0
    }
  ]
}
```

---

## 내보내기

### 1. Excel 내보내기

**요청:**
```http
GET /api/assets/export/excel?category=01&status=active
Authorization: Bearer <TOKEN>
```

**쿼리 매개변수:**
- `category` — 카테고리 필터 (선택)
- `status` — 상태 필터 (선택)
- `location_like` — 위치 필터 (선택)

**응답 (200 OK):**
```
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="assets_20260515.xlsx"

[바이너리 Excel 데이터]
```

**Excel 시트 구조:**
```
| A | B | C | D | E | F | G | H | I | J |
|---|---|---|---|---|---|---|---|---|---|
| 물리태그 | 자산명 | 카테고리 | 분류 | 제조사 | 모델 | 위치 | 상태 | 제조년도 | 비고 |
| DCMI-... | SUB STATION | UTILITY | POWER SUPPLY | - | EB - SUB STATION | EB YARD | active | - | - |
```

---

### 2. CSV 내보내기

**요청:**
```http
GET /api/assets/export/csv?category=01
Authorization: Bearer <TOKEN>
```

**응답 (200 OK):**
```
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="assets_20260515.csv"

machine_asset_number,name_en,asset_class_code,make,model,location,status
DCMI-UTL-PSF-01,SUB STATION,01.001,,EB - SUB STATION,EB YARD,active
...
```

---

## 에러 처리

### HTTP 상태 코드

| 상태 | 의미 | 예시 |
|------|------|------|
| 200 | OK | 조회/수정 성공 |
| 201 | Created | 신규 생성 성공 |
| 202 | Accepted | 비동기 작업 수락 (임포트) |
| 400 | Bad Request | 필드 검증 실패 |
| 401 | Unauthorized | 토큰 없음/만료 |
| 403 | Forbidden | 권한 없음 |
| 404 | Not Found | 자산/리소스 없음 |
| 409 | Conflict | 중복 물리태그 / FK 제약 위반 |
| 500 | Internal Server Error | DB 오류 |

### 에러 응답 형식

```json
{
  "success": false,
  "error": {
    "message": "Asset class not found",
    "field": "asset_class_code",
    "code": "ASSET_CLASS_NOT_FOUND"
  }
}
```

### 필드 검증 에러 (400)

```json
{
  "success": false,
  "error": {
    "message": "Validation failed",
    "fields": [
      {
        "field": "machine_asset_number",
        "message": "Already exists"
      },
      {
        "field": "name_en",
        "message": "Minimum 3 characters"
      }
    ]
  }
}
```

### FK 제약 에러 (409)

```json
{
  "success": false,
  "error": {
    "message": "Cannot delete asset with related records",
    "code": "FK_CONSTRAINT_VIOLATION",
    "related_tables": ["bm_history", "pm_schedule"],
    "suggestion": "Change status to 'scrapped' instead"
  }
}
```

---

## 성능 최적화

### 인덱스 활용

```sql
-- 기존 인덱스
create index assets_class_idx on assets(asset_class_code);
create index assets_status_idx on assets(status);
create index assets_make_idx on assets(make);
create index assets_search_idx on assets using gin(to_tsvector(...));

-- 신규 인덱스 (v2)
create index asset_qr_scans_asset_idx on asset_qr_scans(asset_id);
create index asset_qr_scans_payload_idx on asset_qr_scans(qr_payload);
```

### 페이징 전략

- **기본:** 20개/페이지
- **최대:** 100개/페이지
- **오버헤드:** LIMIT N OFFSET M (대규모 페이지는 피함)

### 캐시 전략

- GET 요청: 60초 캐시 (CDN)
- POST/PUT/DELETE: 캐시 무효화
- 통계: 5분 캐시 (재계산 비용)

### 대량 조회 최적화

```http
GET /api/assets?limit=20&sort=updated_at.desc
```

쿼리 계획:
```
Index Scan using assets_status_idx (status = 'active')
  -> Limit (20)
    -> Sort (updated_at DESC)
```

---

## 예시 워크플로우

### 시나리오 1: QR 스캔 → 즉시 조회

```bash
# Step 1: QR 스캔 (모바일)
curl -H "Authorization: Bearer $TOKEN" \
  "https://dsc-fms-portal.vercel.app/api/assets/qr/DCMI-UTL-PSF-01"

# 응답: 자산 상세 정보 → UI에 표시

# Step 2: 스캔 로그 기록
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "qr_payload": "DCMI-UTL-PSF-01",
    "device_info": "Samsung Galaxy Tab S7",
    "location_gps": "13.1939,80.1705"
  }' \
  "https://dsc-fms-portal.vercel.app/api/assets/550e8400-e29b-41d4-a716-446655440000/qr/scan"
```

### 시나리오 2: 대량 임포트

```bash
# Step 1: 파일 검증
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@assets_import.xlsx" \
  "https://dsc-fms-portal.vercel.app/api/assets/import/validate"

# 응답: 검증 결과 + 미리보기

# Step 2: 임포트 실행
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "file_name": "assets_import.xlsx",
    "duplicate_handling": "skip"
  }' \
  "https://dsc-fms-portal.vercel.app/api/assets/import/execute"

# 응답: batch_id

# Step 3: 진행률 조회
curl -H "Authorization: Bearer $TOKEN" \
  "https://dsc-fms-portal.vercel.app/api/assets/import/status/batch-uuid-001"
```

---

**문서 버전:** v2.0  
**최종 검토:** 2026-05-15  
**웹개발자 구현 시작:** 2026-05-16
