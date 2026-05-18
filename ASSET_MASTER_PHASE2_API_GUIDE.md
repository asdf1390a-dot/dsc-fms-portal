# Asset Master v2 Phase 2 — API 구현 가이드

> **작성:** 2026-05-16 09:00 KST  
> **대상:** 웹개발자  
> **범위:** MVP 16개 API + 에러 처리 + 검증 규칙

---

## 📋 API 목록 (MVP 16개)

### Group 1: 조회 (GET) — 5개

```
GET /api/assets                  — 목록 (필터+검색+페이지네이션)
GET /api/assets/:id              — 상세 조회
GET /api/asset-categories        — 카테고리 목록
GET /api/assets/:id/audit-log    — 자산 이력 (asset_audit)
GET /api/assets/locations        — 위치 자동완성
```

### Group 2: 생성/수정/삭제 (CRUD) — 4개

```
POST /api/assets                 — 단건 생성
PUT /api/assets/:id              — 단건 수정
DELETE /api/assets/:id           — 단건 삭제
POST /api/assets/bulk-update     — 일괄 수정
```

### Group 3: 대량 임포트 (Import) — 5개

```
GET /api/assets/import/template.xlsx      — 템플릿 다운로드
POST /api/assets/import/preview           — Excel 미리보기 + 검증
POST /api/assets/import/execute           — 일괄 입력 실행
GET /api/assets/import/batches            — 배치 목록
GET /api/assets/import/batches/:batch_id  — 배치 상세
GET /api/assets/import/batches/:batch_id/items  — 배치 아이템 목록
```

### Group 4: 내보내기 & 통계 — 2개

```
GET /api/assets/export/excel     — Excel 다운로드
GET /api/assets/statistics       — 통계 API
```

---

## 상세 API 명세

### 1. GET /api/assets (목록 조회)

**쿼리 파라미터:**
```
page=1                    (기본값: 1)
per_page=20               (기본값: 20, 최대: 100)
q=<검색어>                 (FTS 검색)
category=<prefix>         (예: "01", "02.001")
status=<상태>             (active|idle|maintenance|sold|scrapped)
location=<위치>           (exact 또는 LIKE)
make=<제조사>             (exact)
sort_by=updated_at|name_en|status  (기본값: updated_at)
sort_order=asc|desc       (기본값: desc)
```

**응답 (200 OK):**
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "machine_asset_number": "DCMI-UTL-PSF-01",
      "name_en": "SUB STATION",
      "name_ta": "சப் ஸ்டேஷன்",
      "asset_class_code": "01.001",
      "category_code": "01",
      "location": "EB YARD",
      "status": "active",
      "model": "EB - SUB STATION",
      "make": "TRINITY",
      "serial_no": "SN-2015-001",
      "year_of_manufacture": 2015,
      "qr_payload": "DCMI-UTL-PSF-01",
      "created_at": "2026-01-01T00:00:00Z",
      "updated_at": "2026-05-15T10:30:00Z"
    }
  ],
  "total": 506,
  "page": 1,
  "per_page": 20,
  "total_pages": 26
}
```

**에러 응답:**
- 400: 잘못된 쿼리 파라미터
- 500: DB 오류

---

### 2. GET /api/assets/:id (상세 조회)

**응답 (200 OK):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "machine_asset_number": "DCMI-UTL-PSF-01",
  "name_en": "SUB STATION",
  "name_ta": "சப் ஸ்டேஷன்",
  "asset_class_code": "01.001",
  "category_code": "01",
  "location": "EB YARD",
  "status": "active",
  "model": "EB - SUB STATION",
  "make": "TRINITY",
  "serial_no": "SN-2015-001",
  "year_of_manufacture": 2015,
  "qr_payload": "DCMI-UTL-PSF-01",
  "photos": [],
  "remark": "Regular maintenance scheduled",
  "extra": {},
  "created_at": "2026-01-01T00:00:00Z",
  "updated_at": "2026-05-15T10:30:00Z",
  "created_by": "uuid",
  "updated_by": "uuid"
}
```

**에러 응답:**
- 404: 자산 없음

---

### 3. GET /api/asset-categories (카테고리 목록)

**응답 (200 OK):**
```json
[
  {
    "code": "01",
    "name_en": "UTILITY",
    "name_ko": "유틸리티",
    "display_order": 1
  },
  {
    "code": "02",
    "name_en": "PROCESS",
    "name_ko": "공정",
    "display_order": 2
  }
]
```

---

### 4. GET /api/assets/:id/audit-log (자산 감사 이력) [신규 구현]

**쿼리:**
```
?page=1&per_page=50
```

**응답 (200 OK):**
```json
{
  "data": [
    {
      "id": "uuid",
      "table_name": "assets",
      "operation": "UPDATE",
      "changed_by": "uuid",
      "changed_at": "2026-05-15T10:30:00Z",
      "old_values": { "status": "idle" },
      "new_values": { "status": "active" },
      "change_description": "Status changed from idle to active"
    }
  ],
  "total": 15,
  "page": 1
}
```

---

### 5. GET /api/assets/locations (위치 자동완성)

**쿼리:**
```
?q=EB          (선택, 필터)
```

**응답 (200 OK):**
```json
[
  "EB YARD",
  "WAREHOUSE",
  "ASSEMBLY SHOP",
  "TESTING LAB"
]
```

---

### 6. POST /api/assets (단건 생성) [기존 코드 재사용]

**참고:** 이미 `app/api/assets/route.ts`에 구현됨. 검증 로직과 에러 처리 유지.

**요청 본문:**
```json
{
  "machine_asset_number": "DCMI-UTL-PSF-05",
  "name_en": "POWER SUPPLY",
  "name_ta": "சக்தி வழங்கல்",
  "asset_class_code": "01.001",
  "location": "EB YARD",
  "status": "active",
  "model": "PSF-2000",
  "make": "TRINITY",
  "serial_no": "ABC123",
  "year_of_manufacture": 2015,
  "remark": "New equipment"
}
```

**검증:**
- `machine_asset_number`: 필수, UNIQUE
- `name_en`: 필수
- `asset_class_code`: 참조 (asset_classes.code)
- `status`: 열거형 (active|idle|maintenance|sold|scrapped)
- `year_of_manufacture`: 1900~2100

**응답 (201 Created):**
```json
{
  "id": "uuid",
  "machine_asset_number": "DCMI-UTL-PSF-05",
  ...
}
```

**에러 응답:**
- 400: 필드 검증 실패
- 409: machine_asset_number 중복

---

### 7. PUT /api/assets/:id (단건 수정) [신규 구현]

**요청 본문:** (모든 필드 선택)
```json
{
  "name_en": "POWER SUPPLY V2",
  "status": "idle",
  "location": "WAREHOUSE"
}
```

**응답 (200 OK):** 수정된 자산

---

### 8. DELETE /api/assets/:id (단건 삭제) [신규 구현]

**응답:**
- 204 No Content: 삭제 성공
- 404: 자산 없음
- 409: 다른 테이블 FK 참조 중 (BM, PM, Disposal)

---

### 9. POST /api/assets/bulk-update (일괄 수정) [신규 구현]

**요청 본문:**
```json
{
  "ids": [
    "uuid-1",
    "uuid-2",
    "uuid-3"
  ],
  "updates": {
    "status": "idle",
    "location": "WAREHOUSE"
  }
}
```

**검증:**
- `ids`: 배열, 최소 1개
- `updates`: 객체, 최소 1개 필드

**응답 (200 OK):**
```json
{
  "updated_count": 3,
  "errors": []
}
```

**에러 응답:**
- 400: 검증 실패
- 500: 부분 실패 (일부는 업데이트, 일부는 실패)

---

### 10. GET /api/assets/import/template.xlsx

**기능:** Excel 템플릿 다운로드

**응답:** 바이너리 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)

**헤더 행 (예시 1행 포함):**
```
machine_asset_number | name_en | name_ta | location | status | model | make | year_of_manufacture | asset_class_code | serial_no | remark
DCMI-UTL-PSF-03      | SUB STATION | சப் ஸ்டேஷன் | EB YARD | active | EB - SUB STATION | TRINITY | 2015 | 01.001 | SN-2015-001 | Sample asset
```

**생성 방법:** exceljs 라이브러리
- 헤더 (굵게, 배경색 회색)
- 예시 1행 (italics, 색 밝음)

---

### 11. POST /api/assets/import/preview

**요청:** FormData
```
file: <File object>
```

**내부 처리:**
1. 파일 검증 (MIME: xlsx, xls / 크기: ≤10MB)
2. xlsx 라이브러리로 파싱
3. 각 행 검증 (asset_import_items 저장, status=pending)
4. asset_import_batches 생성

**응답 (200 OK):**
```json
{
  "batch_id": "uuid",
  "file_name": "assets_2026_05.xlsx",
  "file_hash": "sha256abc123...",
  "total_rows": 120,
  "preview": [
    {
      "row_number": 1,
      "raw_data": {
        "machine_asset_number": "DCMI-UTL-PSF-03",
        "name_en": "SUB STATION",
        ...
      },
      "validation_errors": [],
      "validation_warnings": []
    },
    {
      "row_number": 2,
      "raw_data": { ... },
      "validation_errors": [
        "machine_asset_number: required",
        "machine_asset_number: duplicate (row 1 in batch)"
      ],
      "validation_warnings": []
    }
  ],
  "summary": {
    "total_rows": 120,
    "valid_rows": 118,
    "error_rows": 2,
    "error_details": {
      "missing_machine_asset_number": 1,
      "duplicate_machine_asset_number": 1
    }
  }
}
```

**검증 규칙:**
- `machine_asset_number`: 필수, 중복 없음 (배치 내), UNIQUE (DB)
- `name_en`: 필수
- `asset_class_code`: 필수, asset_classes에 존재
- `status`: 필수, 열거형
- `year_of_manufacture`: 1900~2100

**에러 응답:**
- 400: 파일 형식 오류
- 413: 파일 크기 초과

---

### 12. POST /api/assets/import/execute

**요청 본문:**
```json
{
  "batch_id": "uuid",
  "confirm": true
}
```

**내부 처리:**
1. batch_id 확인, status 변경 → processing
2. Supabase RPC 함수 호출:
   ```
   SELECT * FROM bulk_insert_assets(
     batch_id := $1,
     items_data := $2
   )
   ```
3. 각 item.status 업데이트 (pending → success|error)
4. batch 상태 → completed
5. 감사 로그 기록

**응답 (200 OK):**
```json
{
  "batch_id": "uuid",
  "status": "processing",
  "processed_count": 0,
  "success_count": 0,
  "error_count": 0,
  "message": "Import started. Poll GET /api/assets/import/batches/:batch_id for progress."
}
```

**클라이언트 폴링:**
```
GET /api/assets/import/batches/:batch_id
```

---

### 13. GET /api/assets/import/batches (배치 목록)

**쿼리:**
```
?page=1&per_page=20&status=completed
```

**응답 (200 OK):**
```json
{
  "data": [
    {
      "id": "uuid",
      "batch_name": "2026-05-15 Import",
      "batch_date": "2026-05-15",
      "file_name": "assets_2026_05.xlsx",
      "file_hash": "sha256...",
      "status": "completed",
      "total_rows": 120,
      "processed_count": 120,
      "success_count": 118,
      "error_count": 2,
      "created_at": "2026-05-15T10:00:00Z",
      "created_by": "uuid"
    }
  ],
  "total": 10,
  "page": 1
}
```

---

### 14. GET /api/assets/import/batches/:batch_id (배치 상세)

**응답:**
```json
{
  "id": "uuid",
  "batch_name": "2026-05-15 Import",
  "batch_date": "2026-05-15",
  "file_name": "assets_2026_05.xlsx",
  "status": "completed",
  "total_rows": 120,
  "processed_count": 120,
  "success_count": 118,
  "error_count": 2,
  "import_result": {
    "summary": "Import completed with 2 errors",
    "errors": {
      "row_2": "machine_asset_number: duplicate",
      "row_5": "asset_class_code: not found"
    }
  },
  "created_at": "...",
  "created_by": "uuid"
}
```

---

### 15. GET /api/assets/import/batches/:batch_id/items (배치 아이템)

**쿼리:**
```
?page=1&per_page=50&status=error
```

**응답:**
```json
{
  "data": [
    {
      "id": "uuid",
      "batch_id": "uuid",
      "row_number": 2,
      "status": "error",
      "raw_data": {
        "machine_asset_number": "DCMI-UTL-PSF-03",
        "name_en": "SUB STATION",
        ...
      },
      "validation_errors": [
        "machine_asset_number: duplicate"
      ],
      "asset_id": null,
      "action": null,
      "created_at": "..."
    }
  ],
  "total": 2,
  "page": 1
}
```

---

### 16. GET /api/assets/export/excel

**쿼리:**
```
?category=01&status=active&location=EB YARD
```

**기능:**
1. 필터 적용 후 자산 목록 조회
2. exceljs로 Excel 생성 (스트리밍)
3. 헤더 + 모든 컬럼 + 총 행

**응답:** 바이너리 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)

---

### 17. GET /api/assets/statistics (통계)

**응답 (200 OK):**
```json
{
  "summary": {
    "total_assets": 506,
    "total_by_status": {
      "active": 450,
      "idle": 40,
      "maintenance": 10,
      "sold": 5,
      "scrapped": 1
    }
  },
  "by_category": {
    "01 (UTILITY)": 120,
    "02 (PROCESS)": 200,
    "03 (MACHINE)": 100,
    "...": "..."
  },
  "by_location": {
    "EB YARD": 200,
    "WAREHOUSE": 150,
    "ASSEMBLY": 100,
    "...": "..."
  },
  "by_make": {
    "TRINITY": 300,
    "SIEMENS": 150,
    "OTHER": 56
  }
}
```

---

## 에러 처리 & HTTP 상태 코드

| 상태 | 의미 | 예시 |
|------|------|------|
| 200 | 성공 | GET 조회, 일반 요청 |
| 201 | 생성됨 | POST /assets |
| 204 | 콘텐츠 없음 | DELETE 성공 |
| 400 | 나쁜 요청 | 필드 검증 실패, 잘못된 파라미터 |
| 404 | 찾을 수 없음 | 자산/배치 없음 |
| 409 | 충돌 | UNIQUE 제약 위반 (machine_asset_number) |
| 413 | 요청 엔터티 너무 큼 | 파일 크기 초과 (>10MB) |
| 500 | 서버 오류 | DB 오류, 예기치 않은 오류 |

**오류 응답 형식:**
```json
{
  "error": "Validation error",
  "details": {
    "field": "machine_asset_number",
    "message": "must be unique"
  }
}
```

---

## 구현 팁 & 주의사항

### 1. Excel 파일 처리
```javascript
// 읽기 (import): xlsx 라이브러리
const workbook = XLSX.read(fileBuffer);
const sheet = workbook.Sheets[0];
const rows = XLSX.utils.sheet_to_json(sheet);

// 쓰기 (export + template): exceljs
const workbook = new ExcelJS.Workbook();
const worksheet = workbook.addWorksheet('Assets');
worksheet.columns = [{header: 'machine_asset_number', key: '...'}];
await workbook.xlsx.write(response);
```

### 2. 대량 처리 (성능)
```sql
-- Supabase RPC 함수 (1회 호출, 단일 트랜잭션)
CREATE OR REPLACE FUNCTION bulk_insert_assets(
  batch_id UUID,
  items_data JSONB
) RETURNS JSONB AS $$
DECLARE
  result JSONB := '{"success": 0, "errors": 0}'::jsonb;
BEGIN
  -- INSERT ... SELECT FROM jsonb_to_recordset(items_data)
  -- UPDATE asset_import_items SET status = 'success'|'error'
  RETURN result;
END;
$$ LANGUAGE plpgsql;
```

### 3. 파일 해시 (중복 감지)
```javascript
const crypto = require('crypto');
const fileHash = crypto.createHash('sha256')
  .update(fileBuffer)
  .digest('hex');
```

### 4. RLS 보안
```sql
-- service_role 사용 (import execute, bulk-update)
-- API 엔드포인트: pages/api/assets/import/execute
-- auth 없이 service_role client로 호출
```

### 5. Formidable 설정
```javascript
const form = new formidable.IncomingForm({
  uploadDir: '/tmp',
  maxFileSize: 10 * 1024 * 1024,  // 10MB
  maxFields: 1
});

form.parse(req, (err, fields, files) => {
  // MIME 화이트리스트: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel
});
```

---

## Phase 2.5 Defer (개발 이후)

다음 Phase에서 추가:
- `POST /api/assets/import/batches/:batch_id/retry-failed` — 실패행 재처리
- `GET /api/assets/deduplicate` — 중복 감지
- `POST /api/assets/merge` — 자산 병합
- `GET /api/assets/missing-fields` — 필드 누락 조회
- `DELETE /api/assets/import/batches/:batch_id` — 배치 삭제
- 기타 5개

---

**상태:** 🟢 API 명세 완료 (16개, P0 반영 완료)
