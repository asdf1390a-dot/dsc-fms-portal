# Asset Master — Excel Import 로직 명세

**Version:** 1.0  
**Date:** 2026-05-14  
**Status:** 설계 완료 (Web-Builder 구현 대기)  
**Scope:** 496개 기존 자산을 Excel Master → Supabase로 마이그레이션하기 위한 상세 명세

---

## 개요

기존 Excel Master (REV 01, 2025-01-09)에서 496개의 자산 데이터를 Supabase Postgres로 일괄 가져오는 프로세스. 
데이터 정확성을 위해 3단계 방식으로 진행: **검증 → 미리보기 → 실행**.

### 핵심 원칙
- **단방향:** Excel → DB (되돌리기 불가, 실행 전 반드시 검증)
- **원본 보존:** 원본 Excel은 수정하지 않음. CSV 또는 업로드된 파일에서만 읽음
- **감사 추적:** 모든 import 이벤트를 asset_audit 테이블에 기록
- **오류 격리:** 한 행의 오류가 전체 import을 멈추지 않음 (선택적 재시도 가능)

---

## Phase 1: 파일 준비 및 검증

### 1.1 입력 파일 형식

#### CSV (권장)
```
asset_class_code,machine_asset_code,machine_asset_number,serial_no,name_en,name_ta,model,make,year_of_manufacture,location,status,remark
01.001,01.001.001,DCMI-UTL-PSF-01,,SUB STATION,மின் நிலையம்,SL-630,ABB,2015,Line-1,active,Main power
01.001,01.001.002,DCMI-UTL-PSF-02,,SUB STATION 2,மின் நிலையம் 2,SL-630,ABB,2015,Line-2,active,Backup
...
```

#### Excel (xls/xlsx)
- 시트명: "Asset Master" 또는 "Assets"
- 첫 줄: 헤더 (위와 동일)
- 데이터 시작: 2번줄부터
- 최대 행: 600개 (데이터 + 헤더)

### 1.2 필수 필드

| 필드 | 형식 | 규칙 | 예시 |
|------|------|------|------|
| `asset_class_code` | text | 반드시 존재, CC.CCC 형식 | 01.001 |
| `machine_asset_code` | text | 반드시 고유(unique), CC.CCC.NNN 형식 | 01.001.001 |
| `machine_asset_number` | text | 반드시 고유, DCMI-prefix tag | DCMI-UTL-PSF-01 |
| `name_en` | text | 최소 3자, 최대 200자 | SUB STATION |
| `status` | enum | active\|idle\|maintenance\|sold\|scrapped | active |

### 1.3 선택 필드

| 필드 | 형식 | 규칙 | 기본값 |
|------|------|------|--------|
| `serial_no` | text | 고유하면 좋음 (인덱싱 미지원) | NULL |
| `name_ta` | text | 최대 200자 | NULL |
| `model` | text | 최대 100자 | NULL |
| `make` | text | 최대 100자 | NULL |
| `year_of_manufacture` | int | 1980~2030 범위 | NULL |
| `location` | text | 최대 150자 | NULL |
| `remark` | text | 최대 500자 | NULL |

---

## Phase 2: 검증 로직

### 2.1 행 수준 검증 (Row-level Validation)

각 행에 대해 다음을 검사하고 오류를 수집:

```javascript
// 의사 코드
function validateRow(row, lineNum) {
  const errors = [];
  
  // 필수 필드
  if (!row.asset_class_code?.trim()) {
    errors.push(`Line ${lineNum}: asset_class_code is required`);
  } else if (!/^\d{2}\.\d{3}$/.test(row.asset_class_code.trim())) {
    errors.push(`Line ${lineNum}: asset_class_code must be CC.CCC format`);
  }
  
  if (!row.machine_asset_code?.trim()) {
    errors.push(`Line ${lineNum}: machine_asset_code is required`);
  } else if (!/^\d{2}\.\d{3}\.\d{3}[A-Z]?$/.test(row.machine_asset_code.trim())) {
    errors.push(`Line ${lineNum}: machine_asset_code must be CC.CCC.NNN or CC.CCC.NNN[A-Z]`);
  }
  
  if (!row.machine_asset_number?.trim()) {
    errors.push(`Line ${lineNum}: machine_asset_number is required`);
  } else if (!/^DCMI-[A-Z]{3}-[A-Z]{3}-\d{2}$/.test(row.machine_asset_number.trim())) {
    errors.push(`Line ${lineNum}: machine_asset_number must be DCMI-XXX-XXX-NN format`);
  }
  
  if (!row.name_en?.trim()) {
    errors.push(`Line ${lineNum}: name_en is required`);
  } else {
    const len = row.name_en.trim().length;
    if (len < 3) errors.push(`Line ${lineNum}: name_en must be at least 3 chars`);
    if (len > 200) errors.push(`Line ${lineNum}: name_en must not exceed 200 chars`);
  }
  
  const status = row.status?.trim()?.toLowerCase();
  if (!status) {
    errors.push(`Line ${lineNum}: status is required`);
  } else if (!['active', 'idle', 'maintenance', 'sold', 'scrapped'].includes(status)) {
    errors.push(`Line ${lineNum}: status must be one of: active, idle, maintenance, sold, scrapped`);
  }
  
  // 조건부: asset_class_code 존재 확인
  if (row.asset_class_code?.trim()) {
    // asset_classes 테이블에서 조회 (DB 검증)
    // 존재하지 않으면: `Line ${lineNum}: asset_class_code not found in database`
  }
  
  // 선택 필드
  if (row.year_of_manufacture?.trim()) {
    const year = parseInt(row.year_of_manufacture.trim());
    if (isNaN(year) || year < 1980 || year > 2030) {
      errors.push(`Line ${lineNum}: year_of_manufacture must be integer between 1980 and 2030`);
    }
  }
  
  if (row.location?.trim()) {
    if (row.location.trim().length > 150) {
      errors.push(`Line ${lineNum}: location must not exceed 150 chars`);
    }
  }
  
  if (row.remark?.trim()) {
    if (row.remark.trim().length > 500) {
      errors.push(`Line ${lineNum}: remark must not exceed 500 chars`);
    }
  }
  
  if (row.name_ta?.trim()) {
    if (row.name_ta.trim().length > 200) {
      errors.push(`Line ${lineNum}: name_ta must not exceed 200 chars`);
    }
  }
  
  return { valid: errors.length === 0, errors };
}
```

### 2.2 전역 검증 (Global Validation)

파일 전체에 대해 다음을 검사:

```javascript
function validateGlobal(rows) {
  const globalErrors = [];
  
  // 중복 검사: machine_asset_code
  const codeSet = new Set();
  const codeDups = new Map();
  rows.forEach((row, idx) => {
    const code = row.machine_asset_code?.trim()?.toLowerCase();
    if (code) {
      if (codeSet.has(code)) {
        if (!codeDups.has(code)) codeDups.set(code, []);
        codeDups.get(code).push(idx + 2); // +2: 헤더 + 1-based
      }
      codeSet.add(code);
    }
  });
  
  codeDups.forEach((lines, code) => {
    globalErrors.push(`Duplicate machine_asset_code "${code}" at lines: ${lines.join(', ')}`);
  });
  
  // 중복 검사: machine_asset_number
  const numberSet = new Set();
  const numberDups = new Map();
  rows.forEach((row, idx) => {
    const num = row.machine_asset_number?.trim()?.toUpperCase();
    if (num) {
      if (numberSet.has(num)) {
        if (!numberDups.has(num)) numberDups.set(num, []);
        numberDups.get(num).push(idx + 2);
      }
      numberSet.add(num);
    }
  });
  
  numberDups.forEach((lines, num) => {
    globalErrors.push(`Duplicate machine_asset_number "${num}" at lines: ${lines.join(', ')}`);
  });
  
  // 기존 DB와 충돌 검사
  // SELECT machine_asset_code, machine_asset_number FROM assets WHERE ...
  // 이미 존재하는 코드에 대해 경고 (덮어쓰기 의도 여부 확인)
  
  return { valid: globalErrors.length === 0, errors: globalErrors };
}
```

### 2.3 검증 결과 UI

```
┌─ IMPORT VALIDATION RESULT ──────────────────┐
│                                             │
│  File: asset_master_batch2.csv              │
│  Rows read: 50                              │
│                                             │
│  ✅ Valid rows:        48                   │
│  ⚠️  Warning rows:      1                    │
│  ❌ Error rows:        1                     │
│                                             │
│  Global Issues:                             │
│  ⚠️  2 rows with missing year_of_manufacture │
│  ⚠️  1 row with existing asset_code (will update) │
│                                             │
│  Errors (must fix):                         │
│  ❌ Line 15: asset_class_code not found (01.099) │
│  ❌ Line 32: machine_asset_code invalid format   │
│                                             │
│  ┌─────────────────────────────────────────┐
│  │  [Cancel]     [Fix & Re-upload]   [Preview] │
│  └─────────────────────────────────────────┘
└─────────────────────────────────────────────┘
```

---

## Phase 3: 미리보기 (Preview)

검증을 통과한 행들을 테이블로 미리 표시.

### 3.1 테이블 구조

```
[Filter by status] [Search by code/number] [Sort by class]

┌──┬─────────┬──────────┬──────────┬─────────────────┬──────────────────┬────────┐
│#│ Code    │ Number   │ Name EN  │ Make            │ Location         │Status  │
├──┼─────────┼──────────┼──────────┼─────────────────┼──────────────────┼────────┤
│1 │01.001.01│DCMI-...  │SUB STAT..│ABB              │Line-1            │active  │
│2 │01.001.02│DCMI-...  │SUB STAT..│ABB              │Line-2            │active  │
│3 │01.002.01│DCMI-...  │AIR COMP..│Atlas Copco     │Bay-A             │active  │
└──┴─────────┴──────────┴──────────┴─────────────────┴──────────────────┴────────┘

Showing 1-50 of 48 rows
```

### 3.2 액션

```
┌──────────────────────────────────────────┐
│ ✅ All checks passed. Ready to import.   │
│                                          │
│ ⚠️  1 asset will be UPDATED (not created)│
│     (machine_asset_code already exists) │
│                                          │
│ Summary:                                 │
│  • New assets: 47                        │
│  • Updates: 1                            │
│  • Total: 48                             │
│                                          │
│ Import by: SYSTEM / admin@dsc.local      │
│ Timestamp: 2026-05-14 14:30:45 IST      │
│                                          │
│ [Back to Upload] [Review Details] [Import Now]│
└──────────────────────────────────────────┘
```

---

## Phase 4: 실행 (Execute)

### 4.1 임포트 트랜잭션

```sql
-- Supabase SQL, 트랜잭션 내 실행
BEGIN;

-- Step 1: 임시 스테이징 테이블 생성
CREATE TEMP TABLE staging_import AS
SELECT 
  gen_random_uuid() as id,
  asset_class_code,
  machine_asset_code,
  machine_asset_number,
  serial_no,
  TRIM(name_en) as name_en,
  TRIM(name_ta) as name_ta,
  TRIM(model) as model,
  TRIM(make) as make,
  year_of_manufacture,
  TRIM(location) as location,
  LOWER(status) as status,
  TRIM(remark) as remark,
  now() as created_at,
  now() as updated_at,
  auth.uid() as created_by,
  auth.uid() as updated_by
FROM (VALUES 
  -- 각 행을 VALUES 절로 변환
  ('01.001', '01.001.001', 'DCMI-UTL-PSF-01', NULL, 'SUB STATION', ..., NULL, NULL, 2015, 'Line-1', 'active', 'Main power'),
  ...
) t(asset_class_code, machine_asset_code, machine_asset_number, serial_no, name_en, name_ta, model, make, year_of_manufacture, location, status, remark);

-- Step 2: INSERT (신규) + UPDATE (기존)
-- upsert를 사용하지 않고 명시적으로 분리 (감사 추적 정확성)

INSERT INTO assets 
(id, asset_class_code, machine_asset_code, machine_asset_number, serial_no, name_en, name_ta, model, make, year_of_manufacture, location, status, remark, created_at, updated_at, created_by, updated_by)
SELECT * FROM staging_import s
WHERE NOT EXISTS (
  SELECT 1 FROM assets a 
  WHERE a.machine_asset_code = s.machine_asset_code
)
ON CONFLICT DO NOTHING;  -- 이중 삽입 방지

-- UPDATE 기존 레코드
UPDATE assets a SET
  asset_class_code = s.asset_class_code,
  machine_asset_number = s.machine_asset_number,
  serial_no = COALESCE(s.serial_no, a.serial_no),
  name_en = s.name_en,
  name_ta = COALESCE(s.name_ta, a.name_ta),
  model = COALESCE(s.model, a.model),
  make = COALESCE(s.make, a.make),
  year_of_manufacture = COALESCE(s.year_of_manufacture, a.year_of_manufacture),
  location = COALESCE(s.location, a.location),
  status = s.status,
  remark = COALESCE(s.remark, a.remark),
  updated_at = s.updated_at,
  updated_by = s.updated_by
FROM staging_import s
WHERE a.machine_asset_code = s.machine_asset_code
  AND a.updated_at < now() - interval '1 hour'; -- 충돌 방지: 최근 1시간 이내 수정된 건 건너뛰기

-- Step 3: 감사 로그 (asset_audit 트리거가 자동 기록)

COMMIT;
```

### 4.2 오류 처리

임포트 중 오류가 발생하면:

1. **Row-level Error:** 해당 행만 스킵, 나머지 계속 처리
2. **Global Error:** 트랜잭션 ROLLBACK, 전체 실패
3. **Timeout:** 1000개 행 단위로 분할 실행

```javascript
// Node.js 구현 예시
async function executeImport(rows, adminUser) {
  const results = {
    total: rows.length,
    created: 0,
    updated: 0,
    failed: [],
    startedAt: new Date(),
    endedAt: null
  };
  
  const batchSize = 100;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    
    try {
      const response = await supabase
        .from('assets')
        .upsert(batch, { onConflict: 'machine_asset_code' })
        .select();
      
      batch.forEach((row, idx) => {
        if (response.data[idx].created_at === response.data[idx].updated_at) {
          results.created++;
        } else {
          results.updated++;
        }
      });
      
    } catch (error) {
      batch.forEach((row, idx) => {
        results.failed.push({
          lineNum: i + idx + 2,
          code: row.machine_asset_code,
          error: error.message
        });
      });
    }
    
    // 진행률 업데이트
    reportProgress((i + batch.length) / rows.length * 100);
  }
  
  results.endedAt = new Date();
  return results;
}
```

### 4.3 진행 상황 UI

```
┌─ IMPORTING ASSETS ───────────────────────┐
│                                          │
│  Progress: ████████████░░░░░░░░░░░░ 65% │
│                                          │
│  Processed: 312 / 480 rows               │
│  • Created: 301                          │
│  • Updated: 11                           │
│  • Failed: 0                             │
│                                          │
│  Time elapsed: 2min 34sec                │
│  Est. time remaining: 1min 15sec         │
│                                          │
│  [Cancel Import]                         │
└──────────────────────────────────────────┘
```

---

## Phase 5: 완료 및 보고서

### 5.1 임포트 결과 화면

```
┌─ IMPORT COMPLETE ───────────────────────┐
│                                         │
│  ✅ Import successful                   │
│                                         │
│  Summary:                               │
│  • Total rows:     48                   │
│  • Created:        47 (97.9%)          │
│  • Updated:        1  (2.1%)           │
│  • Failed:         0  (0%)             │
│                                         │
│  Duration: 3min 42sec                  │
│  Completed at: 2026-05-14 14:35:20 IST │
│  Imported by: admin@dsc.local           │
│                                         │
│  Database Status:                       │
│  • Total assets now: 544 (496 + 48)    │
│  • Asset classes: 15                   │
│  • Search index: Updated                │
│                                         │
│  Next Steps:                            │
│  □ QR codes generated for new assets   │
│  □ Verify data in Asset List page      │
│  □ Link to BM/PM modules (if needed)   │
│                                         │
│ [View Failed Rows] [Download Report] [Done] │
└──────────────────────────────────────────┘
```

### 5.2 임포트 리포트 (다운로드)

```csv
import_id,timestamp,imported_by,total_rows,created,updated,failed,duration_ms,status
imp_2026051401,2026-05-14T14:35:20+05:30,admin@dsc.local,48,47,1,0,222000,success

Detailed:
line_num,asset_class_code,machine_asset_code,machine_asset_number,status,error_msg
1,01.001,01.001.001,DCMI-UTL-PSF-01,created,
2,01.001,01.001.002,DCMI-UTL-PSF-02,created,
3,01.002,01.002.001,DCMI-UTL-CMP-01,updated,
...
```

### 5.3 감사 추적 예시

asset_audit 테이블에 자동 기록:

```json
{
  "id": "uuid-xxx",
  "asset_id": "uuid-yyy",
  "changed_at": "2026-05-14T14:35:20.000Z",
  "changed_by": "auth-user-uuid",
  "action": "insert",
  "diff": {
    "after": {
      "id": "uuid-yyy",
      "asset_class_code": "01.001",
      "machine_asset_code": "01.001.001",
      "machine_asset_number": "DCMI-UTL-PSF-01",
      "name_en": "SUB STATION",
      "status": "active",
      "created_at": "2026-05-14T14:35:20Z",
      "created_by": "auth-user-uuid"
    }
  }
}
```

---

## 오류 메시지 템플릿

### 사용자용 메시지

| 상황 | 메시지 | 조치 |
|------|--------|------|
| 파일 형식 오류 | "CSV 또는 Excel 파일만 지원합니다. (*.csv, *.xls, *.xlsx)" | 파일 다시 선택 |
| 필수 열 누락 | "필수 열이 없습니다: asset_class_code, machine_asset_code" | 헤더 확인 후 다시 업로드 |
| 데이터 형식 오류 | "Line 15: asset_class_code는 CC.CCC 형식이어야 합니다 (예: 01.001)" | Excel 수정 후 다시 업로드 |
| 중복 오류 | "Line 32와 45에서 동일한 machine_asset_code가 발견됐습니다" | 중복 확인 후 제거 |
| DB 충돌 | "DCMI-UTL-PSF-05는 이미 존재합니다. 덮어쓰시겠습니까?" | 예/아니오 선택 |
| 임포트 실패 | "임포트 중 오류 발생 (timeout). 1부터 다시 시도해주세요" | 작은 배치로 분할 재시도 |

### 로그 메시지 (관리자용)

```
[2026-05-14 14:30:00] INFO  Import session started: imp_2026051401
[2026-05-14 14:30:05] INFO  File validation: asset_master_batch2.csv (50 rows)
[2026-05-14 14:30:10] WARN  Line 15: asset_class_code 01.099 not found → skipping
[2026-05-14 14:30:15] INFO  Validation passed: 48 rows valid
[2026-05-14 14:35:10] INFO  Executing import batch 1/1 (48 rows)
[2026-05-14 14:35:20] INFO  Import completed: 47 created, 1 updated, 0 failed
[2026-05-14 14:35:25] INFO  Asset audit log updated (48 entries)
[2026-05-14 14:35:30] INFO  Search index refreshed
```

---

## 구현 체크리스트

### UI/Frontend
- [ ] Import 페이지 레이아웃 (`/inventory/import`)
- [ ] 파일 업로드 컴포넌트 (drag-drop, select)
- [ ] CSV 파싱 라이브러리 (Papa Parse 추천)
- [ ] 검증 결과 테이블 (에러 하이라이팅)
- [ ] 미리보기 테이블 (페이지네이션, 필터, 정렬)
- [ ] 진행 상황 프로그레스 바
- [ ] 임포트 결과 보고서
- [ ] 다운로드 보고서 CSV 생성

### API Endpoints
- [ ] POST `/api/inventory/import/validate` — 파일 검증
- [ ] POST `/api/inventory/import/preview` — 미리보기 데이터
- [ ] POST `/api/inventory/import/execute` — 임포트 실행
- [ ] GET `/api/inventory/import/status/:sessionId` — 진행 상태 조회
- [ ] GET `/api/inventory/import/report/:sessionId` — 최종 보고서 조회

### Database
- [ ] 임시 스테이징 테이블 스키마
- [ ] Import 메타데이터 테이블 (시간, 사용자, 통계)
- [ ] 감사 로그 보기/필터링 기능

### Testing
- [ ] Unit: 검증 함수 (행, 전역)
- [ ] Integration: CSV 파싱 + DB 삽입
- [ ] E2E: 전체 import 워크플로우 (3단계)
- [ ] Error cases: 중복, 형식 오류, 타임아웃
- [ ] Load test: 1000+ 행 대용량 처리

### 문서
- [ ] 사용자 가이드 (Import 페이지 진입→완료)
- [ ] 관리자 로그 조회 방법
- [ ] 오류 복구 절차

---

## 통합 예시: BM/PM/Parts 연계

### 시나리오 1: 신규 자산 import → BM 모듈 연계

```
1. 자산 import 완료 (DCMI-UTL-CMP-02)
   ↓
2. asset_classes 확인: 01.002 → "AIR COMPRESSOR"
   ↓
3. BM 모듈에 자동 제안:
   - 기본 PM plan 연결 (if category has default)
   - QR 코드 생성 완료
   - 첫 maintenance 일정 제시
```

### 시나리오 2: 기존 자산 업데이트 → 상태 변경 히스토리

```
1. Excel에서 status = "maintenance" → import
   ↓
2. asset_audit 기록: update / status_change action
   ↓
3. BM 모듈 알림: "DCMI-UTL-PSF-02 상태가 active → maintenance로 변경됨"
   ↓
4. PM 모듈: 해당 자산의 스케줄 일시중지 제안
```

---

## 성능 목표

| 작업 | 목표 | 비고 |
|------|------|------|
| 파일 검증 (100행) | < 1초 | 클라이언트 측 |
| 전역 검증 (중복 확인) | < 2초 | 네트워크 포함 |
| 미리보기 렌더링 | < 500ms | 50행 기준 |
| 임포트 실행 (100행) | < 5초 | DB 트랜잭션 |
| Search index rebuild | < 10초 | 500행 기준 |

---

## 향후 개선 (Phase 5+)

- [ ] 대량 import 성능 최적화 (배치 크기 자동 조정)
- [ ] Incremental import (diff 기반 업데이트만)
- [ ] 스케줄된 import (매주 목요일 자동 동기화)
- [ ] Rollback 기능 (import 이전 상태로 복원)
- [ ] 데이터 맵핑 커스터마이징 (헤더 매칭)

---

**작성:** 2026-05-14 | **검토:** 대기 중 | **승인:** 대기 중

*Web-Builder는 이 명세를 기반으로 import 페이지와 API를 구현합니다.*
