# Asset Master API 구현 가이드

> **대상:** DSC FMS Portal Web Developer  
> **기준:** ASSET_MASTER_DESIGN.md v1.0  
> **작성일:** 2026-05-14  
> **상태:** 구현 대기

---

## 개요

Asset Master 모듈의 모든 API 엔드포인트 상세 명세. PostgREST 자동 생성 API + 커스텀 Next.js API Routes로 구성.

---

## 1. 자산 조회 API

### 1.1 전체 자산 목록 (GET)

**Endpoint:** `GET /api/assets`

**쿼리 파라미터:**

| 파라미터 | 타입 | 기본값 | 설명 |
|---------|------|-------|------|
| `select` | string | `*` | 반환할 컬럼 (PostgREST) |
| `asset_class_code` | string | - | 필터: 자산 클래스 (eq.값) |
| `status` | string | - | 필터: 상태 (eq.active 등) |
| `location` | string | - | 필터: 위치 (ilike.%검색어%) |
| `make` | string | - | 필터: 제조사 (eq.값) |
| `order` | string | `machine_asset_code.asc` | 정렬 (column.direction) |
| `limit` | int | `50` | 페이지당 행 수 |
| `offset` | int | `0` | 스킵할 행 수 |

**예시:**
```
GET /api/assets?asset_class_code=eq.01.001&status=eq.active&limit=20&offset=0
GET /api/assets?location=ilike.%COMPRESSOR%&order=updated_at.desc&limit=50
GET /api/assets?make=eq.SIEMENS&status=eq.active
```

**응답:**
```json
[
  {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "asset_class_code": "01.001",
    "machine_asset_code": "01.001.001",
    "machine_asset_number": "DCMI-UTL-PSF-01",
    "serial_no": null,
    "name_en": "SUB STATION",
    "name_ko": null,
    "name_ta": "சப் ஸ்டேஷன்",
    "model": "EB - SUB STATION",
    "make": "TRINITY",
    "year_of_manufacture": 2015,
    "location": "EB YARD",
    "status": "active",
    "qr_payload": "DCMI-UTL-PSF-01",
    "photos": [],
    "remark": null,
    "extra": {},
    "created_at": "2025-01-09T10:15:00Z",
    "updated_at": "2026-05-13T14:30:00Z",
    "created_by": "550e8400-e29b-41d4-a716-446655440000",
    "updated_by": "550e8400-e29b-41d4-a716-446655440001"
  },
  ...
]
```

**상태코드:**
- `200 OK` — 성공
- `400 Bad Request` — 쿼리 파라미터 오류
- `401 Unauthorized` — 인증 필요

---

### 1.2 자산 상세 조회 (GET)

**Endpoint:** `GET /api/assets/[id]`

**경로 파라미터:**
- `id` (uuid) — 자산 ID

**응답:**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "asset_class_code": "01.001",
  ... (위와 동일)
}
```

**상태코드:**
- `200 OK` — 성공
- `404 Not Found` — 자산이 없음
- `401 Unauthorized` — 인증 필요

---

### 1.3 자산 검색 (POST)

**Endpoint:** `POST /api/assets/search` (커스텀)

**요청 본문:**
```json
{
  "q": "sub station compressor",
  "limit": 20,
  "offset": 0
}
```

**로직:**
```sql
SELECT * FROM assets
WHERE to_tsvector('simple', 
        coalesce(name_en,'') || ' ' ||
        coalesce(name_ta,'') || ' ' ||
        coalesce(model,'') || ' ' ||
        coalesce(make,'') || ' ' ||
        coalesce(machine_asset_number,'') ||
        coalesce(serial_no,'')
      ) 
  @@ to_tsquery('simple', plainto_tsquery('simple', $1)::text)
ORDER BY updated_at DESC
LIMIT $2 OFFSET $3
```

**응답:**
```json
{
  "count": 5,
  "results": [
    { ... asset objects ... }
  ]
}
```

---

### 1.4 QR 코드로 자산 조회 (GET)

**Endpoint:** `GET /api/assets/by-qr/[qr_payload]` (커스텀)

**경로 파라미터:**
- `qr_payload` (text) — 물리 태그 또는 코드

**로직:**
```sql
SELECT * FROM assets
WHERE qr_payload = $1 OR machine_asset_number = $1
LIMIT 1
```

**응답:**
```json
{
  "id": "...",
  ... (자산 객체)
}
```

**상태코드:**
- `200 OK` — 찾음
- `404 Not Found` — 없음
- `401 Unauthorized` — 인증 필요

---

## 2. 자산 생성 API

### 2.1 자산 생성 (POST)

**Endpoint:** `POST /api/assets`

**요청 본문:**
```json
{
  "asset_class_code": "01.001",
  "machine_asset_code": "01.001.006",
  "machine_asset_number": "DCMI-UTL-PSF-06",
  "serial_no": "ABC123",
  "name_en": "NEW VCB",
  "name_ko": "새 VCB",
  "name_ta": "புதிய VCB",
  "model": "EB - VCB",
  "make": "SIEMENS",
  "year_of_manufacture": 2024,
  "location": "MV PANNEL ROOM",
  "status": "active",
  "remark": "새로 설치됨"
}
```

**필수 필드:**
- `asset_class_code` (존재하는 클래스 코드)
- `machine_asset_code` (unique)
- `machine_asset_number` (unique)
- `name_en` (100자 이하)
- `location`
- `status` (active|idle|maintenance|sold|scrapped)

**검증:**
```javascript
// 클라이언트 검증
validate({
  asset_class_code: 'required|exists:asset_classes.code',
  machine_asset_code: 'required|unique:assets.machine_asset_code|regex:/^\d{2}\.\d{3}\.\d{3}$/',
  machine_asset_number: 'required|unique:assets.machine_asset_number|max:50',
  name_en: 'required|max:100',
  location: 'required',
  status: 'required|in:active,idle,maintenance,sold,scrapped',
  year_of_manufacture: 'integer|min:1900|max:2030'
});

// 서버 검증 (Supabase RLS + triggers)
```

**응답:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440002",
  "asset_class_code": "01.001",
  ... (생성된 자산)
}
```

**상태코드:**
- `201 Created` — 생성 성공
- `400 Bad Request` — 검증 오류 (필드 누락, 형식 오류)
- `409 Conflict` — 중복 (machine_asset_code 또는 machine_asset_number)
- `401 Unauthorized` — 인증 필요

**에러 응답:**
```json
{
  "code": "VALIDATION_ERROR",
  "message": "Validation failed",
  "errors": {
    "machine_asset_number": ["Already exists"],
    "year_of_manufacture": ["Must be between 1900 and 2030"]
  }
}
```

---

## 3. 자산 수정 API

### 3.1 자산 부분 수정 (PATCH)

**Endpoint:** `PATCH /api/assets/[id]`

**경로 파라미터:**
- `id` (uuid) — 자산 ID

**요청 본문:** (변경할 필드만)
```json
{
  "status": "maintenance",
  "location": "WORKSHOP",
  "remark": "정비 중 - 부품 교체 예정"
}
```

**검증:**
- `machine_asset_code`, `machine_asset_number`: 수정 불가 (생성 시에만)
- 기타 필드: 생성 시와 동일한 검증 규칙

**응답:**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  ... (수정된 자산)
}
```

**Audit 로그:**
```sql
-- 자동으로 asset_audit 테이블에 기록
INSERT INTO asset_audit (asset_id, changed_by, action, diff)
VALUES (
  $1,
  auth.uid(),
  'status_change',  -- 또는 'update'
  jsonb_build_object(
    'before', {...old_values...},
    'after', {...new_values...},
    'fields_changed', array['status', 'location', 'remark']
  )
);
```

---

### 3.2 자산 일괄 수정 (POST - 커스텀)

**Endpoint:** `POST /api/assets/bulk-update`

**요청 본문:**
```json
{
  "ids": [
    "123e4567-e89b-12d3-a456-426614174000",
    "550e8400-e29b-41d4-a716-446655440002"
  ],
  "updates": {
    "status": "idle",
    "location": "STORAGE"
  }
}
```

**로직:**
```sql
BEGIN;
UPDATE assets 
SET status = $2, location = $3, updated_at = NOW(), updated_by = auth.uid()
WHERE id = ANY($1);
COMMIT;
```

**응답:**
```json
{
  "updated_count": 2,
  "timestamp": "2026-05-14T10:00:00Z"
}
```

---

## 4. 자산 삭제 API

### 4.1 자산 삭제 (DELETE)

**Endpoint:** `DELETE /api/assets/[id]`

**권한:** 관리자만 (RLS 정책)

**로직:**
```sql
-- 물리 삭제 (권장하지 않음)
DELETE FROM assets WHERE id = $1;

-- 또는 논리적 삭제 (권장)
UPDATE assets SET status = 'scrapped' WHERE id = $1;
```

**응답:**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "deleted_at": "2026-05-14T10:05:00Z"
}
```

---

## 5. 자산 이력 API

### 5.1 자산별 감시 로그 조회 (GET)

**Endpoint:** `GET /api/assets/[id]/audit`

**쿼리 파라미터:**
- `order` (string) — `changed_at.desc` (기본값)
- `limit` (int) — 50 (기본값)
- `offset` (int) — 0 (기본값)

**응답:**
```json
[
  {
    "id": "audit-uuid-1",
    "asset_id": "123e4567-e89b-12d3-a456-426614174000",
    "changed_at": "2026-05-13T14:30:00Z",
    "changed_by": "550e8400-e29b-41d4-a716-446655440001",
    "action": "status_change",
    "diff": {
      "before": { "status": "active", "location": "EB YARD" },
      "after": { "status": "maintenance", "location": "WORKSHOP" },
      "fields_changed": ["status", "location"]
    }
  },
  {
    "id": "audit-uuid-2",
    "asset_id": "123e4567-e89b-12d3-a456-426614174000",
    "changed_at": "2025-01-09T10:15:00Z",
    "changed_by": "550e8400-e29b-41d4-a716-446655440000",
    "action": "insert",
    "diff": {
      "after": { ... 전체 자산 정보 ... }
    }
  }
]
```

---

## 6. 통계 & 집계 API

### 6.1 자산 통계 조회 (GET - 커스텀)

**Endpoint:** `GET /api/assets/stats`

**응답:**
```json
{
  "total_assets": 506,
  "by_status": {
    "active": 480,
    "idle": 15,
    "maintenance": 5,
    "sold": 4,
    "scrapped": 2
  },
  "by_category": {
    "01": 45,   // UTILITY
    "02": 120,  // PROCESS
    "03": 25,   // JIG
    ...
  },
  "by_location": {
    "EB YARD": 10,
    "COMPRESSOR ROOM - 01": 8,
    "WORKSHOP": 5,
    ...
  },
  "by_make": {
    "SIEMENS": 45,
    "TRINITY": 30,
    "KAESER": 25,
    ...
  },
  "year_distribution": {
    "2010-2014": 50,
    "2015-2019": 200,
    "2020-2024": 256
  },
  "last_update": "2026-05-13T14:30:00Z"
}
```

**SQL:**
```sql
SELECT
  COUNT(*) as total_assets,
  json_object_agg(status, count) as by_status,
  json_object_agg(asset_class_code, count) as by_category,
  ...
FROM assets
GROUP BY ...;
```

---

## 7. Excel Import API

### 7.1 Import 파일 업로드 & 검증 (POST - 커스텀)

**Endpoint:** `POST /api/assets/import/validate`

**Content-Type:** `multipart/form-data`

**요청:**
```
Form:
  file: (File) .xlsx 또는 .csv
  dry_run: (boolean) true — 미리보기, false — 실제 import
```

**처리 로직:**

```javascript
// 1. 파일 읽기
const workbook = XLSX.read(file);
const sheet = workbook.Sheets[0];
const data = XLSX.utils.sheet_to_json(sheet);

// 2. 컬럼 매핑 (자동)
const requiredColumns = [
  'asset_class_code',
  'machine_asset_code',
  'machine_asset_number',
  'name_en',
  'location',
  'status'
];

const optionalColumns = [
  'serial_no', 'name_ko', 'name_ta', 'model', 'make',
  'year_of_manufacture', 'remark'
];

// 3. 행별 검증
const results = data.map((row, idx) => {
  const errors = [];
  
  // 필수 필드 확인
  for (const col of requiredColumns) {
    if (!row[col]) {
      errors.push(`Missing required field: ${col}`);
    }
  }
  
  // 자산 클래스 존재 확인
  if (!await assetClassExists(row.asset_class_code)) {
    errors.push(`Asset class not found: ${row.asset_class_code}`);
  }
  
  // 중복 확인
  if (await assetCodeExists(row.machine_asset_code)) {
    errors.push(`Duplicate code: ${row.machine_asset_code}`);
  }
  
  // 제조년도 범위 확인
  if (row.year_of_manufacture) {
    const year = parseInt(row.year_of_manufacture);
    if (year < 1900 || year > 2030) {
      errors.push(`Invalid year: ${year}`);
    }
  }
  
  return {
    row_number: idx + 2,  // Excel 행 번호 (헤더 제외)
    data: row,
    errors: errors,
    status: errors.length === 0 ? 'OK' : 'ERROR'
  };
});

// 4. 결과 반환
const okCount = results.filter(r => r.status === 'OK').length;
const errorCount = results.length - okCount;

return {
  total_rows: results.length,
  ok_count: okCount,
  error_count: errorCount,
  results: results
};
```

**응답:**
```json
{
  "total_rows": 10,
  "ok_count": 9,
  "error_count": 1,
  "results": [
    {
      "row_number": 2,
      "data": { ... row data ... },
      "status": "OK",
      "errors": []
    },
    {
      "row_number": 5,
      "data": { ... row data ... },
      "status": "ERROR",
      "errors": [
        "Duplicate code: 01.001.001",
        "Invalid year: 1800"
      ]
    }
    ...
  ]
}
```

**상태코드:**
- `200 OK` — 검증 완료
- `400 Bad Request` — 파일 형식 오류
- `413 Payload Too Large` — 파일 너무 큼 (최대 10MB)

---

### 7.2 Import 실행 (POST - 커스텀)

**Endpoint:** `POST /api/assets/import/execute`

**요청 본문:**
```json
{
  "rows": [
    {
      "row_number": 2,
      "data": { ... 검증된 행 데이터 ... }
    },
    ...
  ],
  "merge_duplicates": false  // true면 업데이트, false면 에러
}
```

**로직:**
```javascript
// Supabase 트랜잭션
const { data, error } = await supabase
  .from('assets')
  .insert(
    validRows.map(row => ({
      asset_class_code: row.data.asset_class_code,
      machine_asset_code: row.data.machine_asset_code,
      machine_asset_number: row.data.machine_asset_number,
      name_en: row.data.name_en,
      name_ko: row.data.name_ko || null,
      name_ta: row.data.name_ta || null,
      serial_no: row.data.serial_no || null,
      model: row.data.model || null,
      make: row.data.make || null,
      year_of_manufacture: row.data.year_of_manufacture ? 
        parseInt(row.data.year_of_manufacture) : null,
      location: row.data.location,
      status: row.data.status || 'active',
      remark: row.data.remark || null,
      created_by: auth.uid(),
      updated_by: auth.uid()
    }))
  );
```

**응답:**
```json
{
  "status": "success",
  "inserted_count": 9,
  "updated_count": 0,
  "timestamp": "2026-05-14T10:00:00Z",
  "message": "9 assets imported successfully"
}
```

---

## 8. QR 스캔 API (현장용)

### 8.1 QR 스캔 후 상태/위치 변경 (POST - 커스텀)

**Endpoint:** `POST /api/assets/quick-update`

**요청 본문:**
```json
{
  "qr_payload": "DCMI-UTL-PSF-01",
  "status": "maintenance",
  "location": "WORKSHOP",
  "remark": "정비 중 - 부품 교체"
}
```

**로직:**
```javascript
// 1. QR로 자산 조회
const asset = await supabase
  .from('assets')
  .select('id')
  .or(`qr_payload.eq.${qr_payload},machine_asset_number.eq.${qr_payload}`)
  .single();

// 2. 상태 수정
const updated = await supabase
  .from('assets')
  .update({
    status: status,
    location: location,
    remark: remark,
    updated_by: auth.uid()
  })
  .eq('id', asset.id);

// 3. audit_log 자동 기록 (트리거)
```

**응답:**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "machine_asset_number": "DCMI-UTL-PSF-01",
  "name_en": "SUB STATION",
  "status": "maintenance",
  "location": "WORKSHOP",
  "updated_at": "2026-05-14T10:00:00Z"
}
```

---

## 9. 참고 자료

### 9.1 Supabase PostgREST 문법

```javascript
// 필터 (Filter)
?column=eq.value           // 같음
?column=gt.value           // 초과
?column=gte.value          // 이상
?column=lt.value           // 미만
?column=lte.value          // 이하
?column=ilike.%pattern%    // 부분 일치
?column=in.(value1,value2) // 목록

// 정렬 (Order)
?order=column.asc          // 오름차순
?order=column.desc         // 내림차순
?order=column1.asc,column2.desc

// 페이지네이션
?limit=50&offset=0         // 0~49 (기본: 50)

// 컬럼 선택
?select=id,name_en,status
```

### 9.2 에러 처리

```javascript
// Next.js API Route 예시
export default async function handler(req, res) {
  try {
    const { data, error } = await supabase...;
    
    if (error) {
      return res.status(400).json({
        code: error.code || 'UNKNOWN_ERROR',
        message: error.message,
        details: error.details
      });
    }
    
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({
      code: 'INTERNAL_SERVER_ERROR',
      message: err.message
    });
  }
}
```

### 9.3 인증 (Auth)

```javascript
// Request Header
Authorization: Bearer <JWT_TOKEN>

// Supabase 클라이언트 (자동)
const { data, error } = await supabase
  .from('assets')
  .select('*');  // RLS 정책에 따라 필터링됨
```

---

## 10. 구현 체크리스트

### Core APIs (필수)
- [ ] GET /api/assets (목록)
- [ ] GET /api/assets/[id] (상세)
- [ ] POST /api/assets (생성)
- [ ] PATCH /api/assets/[id] (수정)
- [ ] DELETE /api/assets/[id] (삭제)
- [ ] GET /api/assets/[id]/audit (이력)

### Custom APIs (권장)
- [ ] POST /api/assets/search (검색)
- [ ] GET /api/assets/by-qr/[qr] (QR 조회)
- [ ] POST /api/assets/bulk-update (일괄 수정)
- [ ] GET /api/assets/stats (통계)

### Import APIs (Phase 2)
- [ ] POST /api/assets/import/validate (검증)
- [ ] POST /api/assets/import/execute (실행)

### Field APIs (Phase 2)
- [ ] GET /api/categories (카테고리 목록)
- [ ] GET /api/asset-classes (클래스 목록)
- [ ] GET /api/assets/locations (위치 목록)
- [ ] GET /api/assets/makes (제조사 목록)

---

**작성:** 2026-05-14  
**상태:** 웹 개발자 구현 대기  
**다음 단계:** 웹 개발자가 Next.js API Routes 구현 → 평가자 검증 → 배포
