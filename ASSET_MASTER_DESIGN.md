# Asset Master 모듈 설계 — DSC FMS Portal

> **작성일:** 2026-05-14  
> **상태:** 설계 완료 (현장 배포 대비)  
> **자산 기준:** 506개 (기존 Excel Master 기준일 2026-03-15)

---

## 목차

1. [개요](#개요)
2. [데이터 모델](#데이터-모델)
3. [UI/UX 설계](#uiux-설계)
4. [현장 입력 폼 (간편 모드)](#현장-입력-폼-간편-모드)
5. [Excel Import 전략](#excel-import-전략)
6. [API 인터페이스](#api-인터페이스)
7. [후속 모듈 연계](#후속-모듈-연계)
8. [배포 체크리스트](#배포-체크리스트)

---

## 개요

### 목적
DSC 공장의 506개 물리적 자산(기계, JIG, MOULD, 설비, 판넬 등)을 중앙화된 디지털 자산 마스터로 관리하고, QR 코드, 이력 추적, 후속 BM/PM/Parts 모듈과 연계.

### 범위
- **자산:** 기계, 설비, 판넬, 에어컴프레셔, JIG, MOULD, 로봇, 유압시스템 등
- **사용자:** 관리자(조회/수정/삭제), 기술자(QR 스캔/조회), 현장 작업자(조회)
- **언어:** 한국어(입력), 영어(시스템), 타밀어(현장 작업자)
- **배포:** 모바일 우선 (태블릿 / 스마트폰)

### 핵심 특징
- **3단계 코드 스킴:** 01.001.001 (계층 숫자) + DCMI-UTL-PSF-01 (물리 태그)
- **QR 연동:** 각 자산의 고유 QR 코드 → 즉시 상세 조회
- **다국어 지원:** 4개 언어 UI, 현장 입력은 영어/타밀어만
- **이력 추적:** 모든 변경사항 자동 기록 (누가, 언제, 뭐가 바뀌었는지)
- **Supabase 기반:** Postgres + PostgREST API + Row Level Security (RLS)

---

## 데이터 모델

### 1. 테이블 구조

#### **categories** — 자산 대분류 (15개)
```
code (PK)          | text    | '01' ~ '15'
name_en           | text    | 'UTILITY', 'PROCESS', 'JIG', ...
name_ko           | text    | '유틸리티', '생산설비', 'JIG', ...
name_ta           | text    | (optional)
name_hi           | text    | (optional)
display_order     | int     | auto-generated
```

**15개 카테고리:**
1. 01 = UTILITY (전력, 압축기, 배전 설비)
2. 02 = PROCESS (프레스, 용접, 도장, 조립)
3. 03 = JIG (자동화용 치구)
4. 04 = MOULD (금형)
5. 05 = ROBOT (협동로봇)
6. 06 = HYDRAULIC (유압 시스템)
7. 07 = PNEUMATIC (공압 시스템)
8. 08 = CONVEYOR (컨베이어)
9. 09 = STORAGE (창고 설비)
10. 10 = QUALITY (검사 장비)
11. 11 = SAFETY (안전 설비)
12. 12 = ENVIRONMENTAL (환경 설비)
13. 13 = IT_INFRASTRUCTURE (IT 인프라)
14. 14 = FACILITY (건물/시설)
15. 15 = SUPPORT (지원 설비)

#### **asset_classes** — 자산 세부 분류 (01.001, 01.001A, ...)
```
code (PK)           | text    | '01.001', '01.001A', '01.002', ...
category_code (FK)  | text    | references categories(code)
name_en            | text    | 'POWER SUPPLY FACILITY', ...
name_ko            | text    | '전력 공급 설비', ...
name_ta            | text    | (optional)
expected_qty       | int     | Excel 마스터에서 본 예상 개수
```

**예시:**
- 01.001 = POWER SUPPLY (변압기, VCB, 전력분배)
- 01.001A = MV PANNEL
- 01.001B = SUB SWITCH BOARD
- 01.002 = AIR COMPRESSOR

#### **assets** — 자산 (메인 테이블, 506개)
```
-- ID & 자산 코드
id (PK)                  | uuid       | auto-generated
asset_class_code (FK)    | text       | '01.001'
machine_asset_code       | text       | '01.001.001' (unique)
machine_asset_number     | text       | 'DCMI-UTL-PSF-01' (unique, 물리 태그)
serial_no                | text       | 선택사항

-- 명칭 (다국어)
name_en                  | text       | 'SUB STATION' (필수)
name_ko                  | text       | (선택사항)
name_ta                  | text       | 'சப் ஸ்டேஷன்' (현장용)

-- 규격
model                    | text       | 'EB - SUB STATION'
make                     | text       | 'TRINITY', 'KAESER', ...
year_of_manufacture      | int        | 2015, 2018, ...

-- 위치 & 상태
location                 | text       | 'EB YARD', 'COMPRESSOR ROOM - 01'
status                   | text       | 'active' | 'idle' | 'maintenance' | 'sold' | 'scrapped'

-- 디지털 확장
qr_payload               | text       | 기본값: machine_asset_number
photos                   | text[]     | ['https://..../photo1.jpg', ...]
remark                   | text       | 비고

-- 카테고리별 확장
extra                    | jsonb      | JIG에만: {tool_type, dies_count}
                         |            | MOULD: {weight_kg, material}
                         |            | ROBOT: {payload_kg, reach_m}

-- 감시
created_at               | timestamptz| 생성 일시
updated_at               | timestamptz| 마지막 수정 일시
created_by (FK)          | uuid       | 생성한 사용자
updated_by (FK)          | uuid       | 수정한 사용자
```

#### **asset_audit** — 자산 변경 이력 (감시 로그)
```
id (PK)                  | uuid        | auto-generated
asset_id (FK)            | uuid        | references assets(id)
changed_at               | timestamptz | 변경 일시
changed_by (FK)          | uuid        | 변경한 사용자
action                   | text        | 'insert' | 'update' | 'delete' | 'status_change'
diff                     | jsonb       | {before, after, fields_changed}
```

**예시:**
```json
{
  "before": { "status": "active", "location": "COMPRESSOR ROOM - 01" },
  "after": { "status": "maintenance", "location": "WORKSHOP" },
  "fields_changed": ["status", "location"]
}
```

### 2. 자산 코드 스킴

#### **형식:** `CC.CCC.NNN` + 물리 태그

| 구성 | 예 | 설명 |
|-----|-----|-----|
| **CC** | 01 | 카테고리 (15개, 01~15) |
| **CCC** | 001 | 세부분류 (같은 카테고리 내 일련번호) |
| **NNN** | 001 | 개별 자산 번호 |
| **물리 태그** | DCMI-UTL-PSF-01 | 현장 표지(QR에 인쇄) |

**예시:**
- 01.001.001 = DCMI-UTL-PSF-01 (SUB STATION)
- 01.001.002 = DCMI-UTL-PSF-02 (VCB - 01)
- 01.002.001 = DCMI-UTL-CMP-01 (AIR COMPRESSOR 50HP - 01)

**특징:**
- Unique: machine_asset_code (01.001.001)는 globally unique
- Unique: machine_asset_number (DCMI-UTL-PSF-01)는 globally unique
- QR 코드는 machine_asset_number 인코딩

### 3. 색인 & 성능 최적화

```sql
-- 조회 성능
asset_classes_category_idx ON asset_classes(category_code)
assets_class_idx           ON assets(asset_class_code)
assets_status_idx          ON assets(status)
assets_make_idx            ON assets(make)

-- 전문 검색 (FTS)
assets_search_idx          ON assets USING gin(
  to_tsvector('simple', 
    coalesce(name_en,'') || ' ' ||
    coalesce(name_ta,'') || ' ' ||
    coalesce(model,'') || ' ' ||
    coalesce(make,'') || ' ' ||
    coalesce(machine_asset_number,'') ||
    coalesce(serial_no,'')
  )
)
```

---

## UI/UX 설계

### 페이지 구조 (모바일 우선)

#### 1. 자산 목록 (`/assets`)

**레이아웃:**
```
┌─────────────────────────────┐
│ Asset Master                │
│ [Search] [Filter ▼] [+ New] │
├─────────────────────────────┤
│ ✓ Category: [UTILITY    ▼]  │
│   Status:   [Active    ▼]   │
│   Location: [________▼]     │
│   Make:     [________▼]     │
│ [✓ Apply] [Reset]           │
├─────────────────────────────┤
│ 1. DCMI-UTL-PSF-01          │
│    SUB STATION              │
│    Category: UTILITY        │
│    Location: EB YARD        │
│    Status: 🟢 Active        │
│    [View] [QR] [Edit]       │
├─────────────────────────────┤
│ 2. DCMI-UTL-PSF-02          │
│    VCB - 01                 │
│    Category: UTILITY        │
│    Location: MV PANNEL...   │
│    Status: 🟢 Active        │
│    [View] [QR] [Edit]       │
├─────────────────────────────┤
│ (Pagination: 1-50 / 506)    │
└─────────────────────────────┘
```

**기능:**
- 검색: 자산명, 코드, 태그, 모델, 제조사 (FTS)
- 필터: 카테고리, 상태, 위치, 제조사
- 정렬: 코드 ↑, 명칭, 수정일 (역순)
- 페이지네이션: 50/100/250 선택
- 대량 작업: (미래) 상태 일괄 변경, 위치 일괄 변경

#### 2. 자산 상세 (`/assets/[id]`)

**탭 구조:**
```
[기본정보] [이력] [QR] [BM/PM] [Photos]
```

##### 탭 1: 기본정보
```
┌─────────────────────────────┐
│ DCMI-UTL-PSF-01             │
│ SUB STATION                 │
│ Edit | Delete | QR          │
├─────────────────────────────┤
│ 자산 코드:     01.001.001   │
│ 물리 태그:     DCMI-UTL-PSF │
│ 일련번호:      (없음)       │
│ 상태:          🟢 Active    │
│                  (변경 ▼)   │
├─────────────────────────────┤
│ 명칭 (영어):   SUB STATION  │
│ 명칭 (타밀):   சப் ஸ்டேஷன் │
│ 모델:          EB - SUB...  │
│ 제조사:        (정보 없음)  │
│ 제조년도:      2015         │
│ 위치:          EB YARD      │
│                  (변경 ▼)   │
├─────────────────────────────┤
│ 생성일시:      2025-01-09   │
│ 생성자:        Admin        │
│ 수정일시:      2026-05-13   │
│ 수정자:        Technician   │
│ 비고:          (없음)       │
└─────────────────────────────┘
```

##### 탭 2: 이력 (asset_audit)
```
┌─────────────────────────────┐
│ 변경 기록 (최신순)          │
├─────────────────────────────┤
│ 2026-05-13 14:30            │
│ Admin가 상태 변경           │
│ active → maintenance        │
│                             │
│ 2026-03-15 09:00            │
│ 기술자가 위치 변경           │
│ COMPRESSOR ROOM -01         │
│ → WORKSHOP                  │
│                             │
│ 2025-01-09 10:15            │
│ Admin이 생성                 │
│ (초기 기록)                 │
└─────────────────────────────┘
```

##### 탭 3: QR
```
┌─────────────────────────────┐
│ QR 코드                     │
│ ┌───────────────┐           │
│ │ [QR 이미지]   │           │
│ └───────────────┘           │
│                             │
│ 페이로드: DCMI-UTL-PSF-01  │
│ [인쇄] [다운로드]           │
└─────────────────────────────┘
```

##### 탭 4: BM/PM 연계
```
┌─────────────────────────────┐
│ Breakdown 기록 (최근 10개)  │
├─────────────────────────────┤
│ 2026-05-10 | VCB 트립      │
│ 수리: 2시간 | 부품: 없음    │
│                             │
│ 2026-04-20 | 과전류        │
│ 수리: 30분  | 부품: 릴레이  │
├─────────────────────────────┤
│ PM 일정 (다음 5개)          │
├─────────────────────────────┤
│ 2026-06-01 | 월간 검사     │
│ 2026-07-01 | 월간 검사     │
│                             │
│ [전체 보기]                 │
└─────────────────────────────┘
```

#### 3. 자산 생성/수정 (`/assets/new`, `/assets/edit/[id]`)

**폼 레이아웃:**
```
┌─────────────────────────────┐
│ 자산 정보 입력              │
├─────────────────────────────┤
│ * 자산 클래스 [UTILITY ▼]   │
│   01 = UTILITY              │
│   02 = PROCESS              │
│   ...                       │
├─────────────────────────────┤
│ * 자산 명칭 (영어)          │
│   [SUB STATION______]       │
│                             │
│   명칭 (타밀어) [선택]      │
│   [சப் ஸ்டேஷன்__________] │
├─────────────────────────────┤
│ * 물리 태그                 │
│   [DCMI-UTL-PSF-01_]       │
│   (필수, Unique)            │
├─────────────────────────────┤
│   일련번호 [선택]           │
│   [________________]        │
│                             │
│   모델                      │
│   [EB - SUB STATION___]     │
│                             │
│   제조사                    │
│   [________▼]               │
│   - TRINITY                 │
│   - SIEMENS                 │
│   - KAESER                  │
│                             │
│   제조년도                  │
│   [2015]                    │
├─────────────────────────────┤
│ * 위치 (선택지 있음)        │
│   [COMPRESSOR ROOM - 01▼]  │
│   - EB YARD                 │
│   - EB PANNEL ROOM          │
│   - COMPRESSOR ROOM - 01    │
│   - SHOP FLOOR              │
│   - WORKSHOP                │
│   - 기타 입력               │
├─────────────────────────────┤
│ * 상태 [Active ▼]           │
│   🟢 Active (운영 중)       │
│   🟡 Idle (미사용)          │
│   🔧 Maintenance (수리 중)  │
│   🚫 Sold (매각)            │
│   ☠️ Scrapped (폐기)        │
├─────────────────────────────┤
│ 비고                        │
│ [_____________________]     │
│                             │
│ 사진 추가 [선택]            │
│ [📷 사진 선택] (최대 5개)   │
├─────────────────────────────┤
│ [저장] [취소]               │
└─────────────────────────────┘
```

**입력 검증:**
- 필수: 자산 클래스, 명칭(영어), 물리 태그, 위치, 상태
- Unique 검증: 물리 태그, 자산 코드
- 타입 검증: 제조년도 (정수, 1950~현재년)
- 길이 제한: 명칭 최대 100자, 비고 최대 500자

---

## 현장 입력 폼 (간편 모드)

### 목표
스마트폰/태블릿 현장 작업자가 **QR 스캔 후 즉시 상태/위치 변경**을 하도록 간소화.

### 페이지: `/assets/quick-update`

```
┌─────────────────────────────┐
│ 🔍 QR 스캔 또는 검색        │
│ [카메라 활성화 ▼]           │
│ 또는                        │
│ [검색: ______________]      │
├─────────────────────────────┤
│ DCMI-UTL-PSF-01             │
│ SUB STATION                 │
│ 현재 위치: EB YARD          │
│ 현재 상태: Active           │
├─────────────────────────────┤
│ 변경할 상태:                │
│ ○ Active (그대로)           │
│ ○ Idle (미사용 중)          │
│ ○ Maintenance (정비 중)     │
│ ○ Sold (매각됨)             │
│ ○ Scrapped (폐기됨)         │
├─────────────────────────────┤
│ 변경할 위치:                │
│ [위치 선택 ▼]               │
│ - EB YARD                   │
│ - COMPRESSOR ROOM - 01      │
│ - WORKSHOP                  │
│ - 기타 입력: _________     │
├─────────────────────────────┤
│ 비고 (선택):                │
│ [정비 중 - 부품 교체 예정]  │
├─────────────────────────────┤
│ [저장] [스캔 다시]          │
└─────────────────────────────┘
```

**기능:**
- QR 스캔 (웹캠 또는 모바일 카메라)
- 자동 대역폭 성능 최적화 (저속 네트워크 지원)
- 오프라인 모드: 변경 사항 로컬 저장 후 온라인 복귀 시 동기
- 음성 안내 (선택): "스캔 성공", "저장 완료"
- 다국어: 영어 / 타밀어

---

## Excel Import 전략

### 1. Import 프로세스

**Phase 1: 데이터 검증** (자동)
```
Excel 파일
   ↓
CSV 변환 (UTF-8)
   ↓
스키마 검증 (열 매핑, 필수 필드, 자료형)
   ↓
중복 검증 (machine_asset_code, machine_asset_number)
   ↓
참조 검증 (asset_class_code 존재 여부)
   ↓
결과 리포트 (에러, 경고, OK)
```

**Phase 2: 미리보기** (수동)
```
검증 성공 후 사용자가 미리보기 확인
   ↓
문제 항목 확인 & 수동 수정 (선택사항)
   ↓
확인 (유저 액션)
```

**Phase 3: Import** (자동 + 감시)
```
Supabase Postgres 트랜잭션 시작
   ↓
INSERT (또는 UPDATE if exists) assets 테이블
   ↓
audit_log 자동 기록 (imported_from_excel)
   ↓
트랜잭션 커밋
   ↓
성공 리포트 (X개 추가, Y개 업데이트)
```

### 2. Excel 마스터 형식

**필수 열:**
| 열 | 타입 | 예 | 비고 |
|----|------|-----|------|
| asset_class_code | text | 01.001 | references asset_classes |
| machine_asset_code | text | 01.001.001 | unique, numeric |
| machine_asset_number | text | DCMI-UTL-PSF-01 | unique, 물리 태그 |
| name_en | text | SUB STATION | 필수 |
| location | text | EB YARD | 필수 |
| status | text | active | 기본값: active |

**선택 열:**
| 열 | 타입 | 예 |
|----|------|-----|
| serial_no | text | ABC123 |
| name_ko | text | 변전소 |
| name_ta | text | சப் ஸ்டேஷன் |
| model | text | EB - SUB STATION |
| make | text | TRINITY |
| year_of_manufacture | int | 2015 |
| remark | text | 정기 점검 필요 |

### 3. 에러 처리

**유효성 검사 에러:**
- 필수 필드 누락 → Row 빨강 표시, 메시지 표시
- asset_class_code 존재 안 함 → 경고, 기본값 제시
- machine_asset_number 중복 → 에러 (이미 존재하는 경우)
- 제조년도 범위 오류 (1900~2030 외) → 경고

**사용자 해결:**
```
에러 있는 행 → [수정] 버튼
  ↓
수정 폼 표시
  ↓
재검증
  ↓
[다시 확인] → Phase 2로 복귀
```

### 4. Import 후 검증

**자동 검증:**
```sql
-- 자산 개수 확인
SELECT COUNT(*) FROM assets WHERE created_at > ?;

-- 중복 확인
SELECT machine_asset_number, COUNT(*)
FROM assets
GROUP BY machine_asset_number
HAVING COUNT(*) > 1;

-- 참조 무결성 확인
SELECT COUNT(*) FROM assets
WHERE asset_class_code NOT IN (SELECT code FROM asset_classes);
```

---

## API 인터페이스

### REST API (PostgREST 자동 생성 + 커스텀)

#### 1. 자산 조회

**GET `/api/assets`** (목록)
```
Query params:
  ?select=*
  &asset_class_code=eq.01.001
  &status=eq.active
  &location=ilike.%COMPRESSOR%
  &order=machine_asset_code.asc
  &limit=50
  &offset=0

Response:
[
  {
    "id": "uuid",
    "asset_class_code": "01.001",
    "machine_asset_code": "01.001.001",
    "machine_asset_number": "DCMI-UTL-PSF-01",
    "name_en": "SUB STATION",
    "name_ta": "சப் ஸ்டேஷன்",
    "model": "EB - SUB STATION",
    "make": "TRINITY",
    "year_of_manufacture": 2015,
    "location": "EB YARD",
    "status": "active",
    "qr_payload": "DCMI-UTL-PSF-01",
    "remark": null,
    "created_at": "2025-01-09T10:15:00Z",
    "updated_at": "2026-05-13T14:30:00Z",
    "created_by": "uuid",
    "updated_by": "uuid"
  },
  ...
]
```

**GET `/api/assets/[id]`** (상세)
```
Response: (위와 동일, 단일 객체)
```

#### 2. 자산 생성/수정

**POST `/api/assets`** (생성)
```
Body:
{
  "asset_class_code": "01.001",
  "machine_asset_code": "01.001.006",
  "machine_asset_number": "DCMI-UTL-PSF-06",
  "name_en": "NEW VCB",
  "name_ta": "புதிய VCB",
  "model": "EB - VCB",
  "make": "SIEMENS",
  "year_of_manufacture": 2024,
  "location": "MV PANNEL ROOM",
  "status": "active",
  "remark": "새로 설치됨"
}

Response:
{ "id": "uuid", ... (생성된 자산) }
```

**PATCH `/api/assets/[id]`** (수정)
```
Body: (변경할 필드만)
{
  "status": "maintenance",
  "location": "WORKSHOP"
}

Response: (수정된 자산)
```

#### 3. 자산 상태/위치 일괄 변경

**POST `/api/assets/bulk-update`** (커스텀)
```
Body:
{
  "ids": ["uuid1", "uuid2", ...],
  "updates": {
    "status": "idle",
    "location": "STORAGE"
  }
}

Response:
{
  "updated_count": 3,
  "timestamp": "2026-05-14T10:00:00Z"
}
```

#### 4. 자산 이력

**GET `/api/assets/[id]/audit`** (자산별 감시로그)
```
Query params:
  ?order=changed_at.desc
  &limit=50

Response:
[
  {
    "id": "uuid",
    "asset_id": "uuid",
    "changed_at": "2026-05-13T14:30:00Z",
    "changed_by": "uuid",
    "action": "status_change",
    "diff": {
      "before": { "status": "active" },
      "after": { "status": "maintenance" },
      "fields_changed": ["status"]
    }
  },
  ...
]
```

#### 5. 검색 (FTS)

**GET `/api/assets/search`** (커스텀)
```
Query params:
  ?q=sub+station+compressor
  &limit=20

Response: (검색 결과 배열)
```

#### 6. QR 조회

**GET `/api/assets/by-qr/[qr_payload]`** (커스텀)
```
예: /api/assets/by-qr/DCMI-UTL-PSF-01

Response: (자산 1개)
```

#### 7. 통계

**GET `/api/assets/stats`** (커스텀)
```
Response:
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
    "01": 45,
    "02": 120,
    ...
  },
  "by_location": {
    "EB YARD": 10,
    "COMPRESSOR ROOM - 01": 8,
    ...
  },
  "last_update": "2026-05-13T14:30:00Z"
}
```

---

## 후속 모듈 연계

### 1. BM (Breakdown Management) 연계

**설계:**
```
assets <-- (1:N) --> bm_events
  |
  +-- asset_id (FK)
  +-- created_at, resolved_at
  +-- status, duration_minutes
  +-- spare_parts_used (array)
```

**데이터 흐름:**
1. 기술자가 자산 상세페이지에서 "+ BM 기록" 버튼 클릭
2. BM 창 열림 (asset_id 미리 채워짐)
3. BM 기록 저장 후 자동으로 asset_audit 기록
4. BM 이력이 자산 상세페이지의 "BM/PM" 탭에 표시

**필요한 변경:**
- 자산 상세페이지 BM 탭에 "최근 10개 BM" 쿼리 추가
- BM 테이블에 asset_id 외래키 추가 (이미 존재할 가능성 높음)

### 2. PM (Preventive Maintenance) 연계

**설계:**
```
assets <-- (1:N) --> pm_plans
pm_plans <-- (1:N) --> pm_schedules
pm_schedules <-- (1:N) --> pm_work_logs
```

**데이터 흐름:**
1. 자산별 PM 계획 자동 생성 (예: 월간 검사)
2. 자산 상세페이지에 "다음 PM 일정 5개" 표시
3. PM 완료 시 asset_audit에 기록

**필요한 변경:**
- pm_plans 테이블에 asset_id 또는 asset_class_code 필드
- pm_schedules.asset_id 확인 (이미 존재할 가능성 높음)

### 3. Parts (부품 & 재고) 연계

**설계:**
```
assets <-- (N:N) --> spare_parts
  |
  +-- BM/PM에서 사용된 부품 기록
  +-- asset별 추천 부품 목록
```

**데이터 흐름:**
1. 자산 상세페이지에 "추천 부품" 섹션
2. BM/PM 작업 시 부품 사용 기록
3. 자동으로 재고 차감

**필요한 변경:**
- parts_for_asset 또는 asset_spare_parts 테이블 (매핑)
- spare_parts에 asset_id 배열 또는 관계 정보 추가

### 4. QR 코드 활용

**설계:**
```
QR 스캔
   ↓
machine_asset_number 인식
   ↓
/api/assets/by-qr/{qr_payload} 조회
   ↓
자산 상세페이지 로드 (또는 Quick Update 페이지)
   ↓
BM/PM/상태 변경 등 즉시 작업 가능
```

**구현:**
- HTML5 QR 스캔 라이브러리 (jsQR, html5-qrcode)
- 모바일 카메라 권한 요청
- 오프라인 모드 지원 (IndexedDB에 QR 캐시)

---

## 배포 체크리스트

### Phase 1: DB & API (이미 완료)
- [x] Asset Master 스키마 (01_schema.sql)
- [x] 15개 카테고리 시드 (02_seed_master_codes.sql)
- [x] 506개 자산 시드 (03_seed_assets.sql)
- [x] RLS 정책 설정
- [x] 감시 로그 트리거
- [ ] 성능 테스트 (506개 자산 조회 < 500ms)

### Phase 2: UI 페이지 (이미 완료)
- [x] `/assets` (목록)
- [x] `/assets/[id]` (상세)
- [x] `/assets/new` (생성)
- [x] `/assets/edit/[id]` (수정)
- [ ] `/assets/quick-update` (현장용 간편 폼)
- [ ] `/assets/search` (전문 검색 페이지)
- [ ] `/assets/import` (Excel import 페이지)

### Phase 3: 현장 기능
- [ ] QR 스캔 기능 (Quick Update 페이지)
- [ ] 오프라인 모드 (IndexedDB)
- [ ] 음성 안내 (선택사항)
- [ ] 다국어 지원 완성 (영어/타밀어/힌디어/한국어 UI)

### Phase 4: Excel Import
- [ ] Import 페이지 UI
- [ ] 파일 선택 & 업로드
- [ ] CSV 파싱
- [ ] 검증 로직
- [ ] 미리보기 테이블
- [ ] Import 실행 & 리포트

### Phase 5: 통합 & 테스트
- [ ] BM/PM/Parts 모듈과의 연계 테스트
- [ ] 성능 테스트 (QR 스캔 시간, 검색 시간)
- [ ] 모바일 반응형 테스트
- [ ] 오프라인/온라인 전환 테스트
- [ ] 보안 테스트 (RLS, CORS)

### Phase 6: 배포
- [ ] Vercel 배포
- [ ] Supabase 프로덕션 환경 데이터 마이그레이션
- [ ] 현장 파일럿 (5명, 1주)
- [ ] 피드백 수집 & 개선
- [ ] 전사 배포

---

## 성능 & 보안

### 성능 최적화

| 작업 | 목표 시간 | 달성 방법 |
|------|---------|---------|
| 자산 목록 조회 (50개) | < 300ms | Indexed query + pagination |
| 자산 상세 조회 | < 200ms | Direct ID lookup |
| 검색 (FTS) | < 500ms | GIN index on tsvector |
| QR 조회 | < 100ms | Indexed by qr_payload |
| Excel import (506개) | < 5s | Batch insert + transaction |

### 캐싱 전략

```javascript
// 클라이언트 캐시 (SWR)
const { data: assets } = useSWR(
  `/api/assets?status=eq.active`,
  fetcher,
  { revalidateOnFocus: false }  // 포커스 시 재검증 안 함
);

// 서버 캐시 (Redis, 선택사항)
// - 카테고리 목록 (변경 거의 없음)
// - 장소 목록 (변경 거의 없음)
// - 제조사 목록 (변경 거의 없음)
```

### 보안

| 항목 | 정책 |
|------|------|
| **RLS** | authenticated 사용자만 읽기/쓰기 |
| **삭제** | 논리적 삭제 (status='scrapped') 권장, 물리 삭제 관리자만 |
| **감시** | asset_audit 자동 기록 (삭제 안 됨) |
| **CORS** | Supabase 프론트엔드 도메인 허용 |
| **API 인증** | Supabase JWT (Authorization: Bearer token) |
| **입력 검증** | 클라이언트 + 서버 양쪽 (중복 가능) |

---

## 향후 개선

### 우선순위 1 (3개월 내)
- [ ] QR 스캔 및 현장 간편 입력 (우선도: 높음)
- [ ] Excel import 완전 자동화 (우선도: 높음)
- [ ] BM/PM 완전 연계 (우선도: 높음)

### 우선순위 2 (3~6개월)
- [ ] 자산 사진 갤러리 & 저장소 (우선도: 중간)
- [ ] 자산 이동 이력 지도 시각화 (우선도: 낮음)
- [ ] 자산별 총소유비용(TCO) 계산 (우선도: 중간)
- [ ] 부품 호환성 매핑 (우선도: 중간)

### 우선순위 3 (6개월 이후)
- [ ] AR(증강현실) QR 스캔 (우선도: 낮음)
- [ ] 공급업체 포털 연동 (우선도: 낮음)
- [ ] 자산 가격 추적 & 감가상각 (우선도: 낮음)

---

## 부록 A: 카테고리 & 클래스 매핑

### 15개 카테고리 상세

| Code | Category | Asset Classes | 예시 |
|------|----------|---------------|------|
| **01** | UTILITY | 01.001~01.001D, 01.002~02.002A | 전력, 압축기, 배전 |
| **02** | PROCESS | 02.001, 02.002, ... | 프레스, 용접, 도장 |
| **03** | JIG | 03.001, 03.002, ... | 자동화용 치구 |
| **04** | MOULD | 04.001, 04.002, ... | 금형 (프레스, 사출) |
| **05** | ROBOT | 05.001, 05.002, ... | 협동로봇, 산업로봇 |
| **06** | HYDRAULIC | 06.001, 06.002, ... | 유압 시스템, 펌프 |
| **07** | PNEUMATIC | 07.001, 07.002, ... | 공압 시스템, 에어실린더 |
| **08** | CONVEYOR | 08.001, 08.002, ... | 컨베이어, 적재기 |
| **09** | STORAGE | 09.001, 09.002, ... | 랙, 선반, 창고 설비 |
| **10** | QUALITY | 10.001, 10.002, ... | 검사 기계, 측정기 |
| **11** | SAFETY | 11.001, 11.002, ... | 소방, 안전 설비 |
| **12** | ENVIRONMENTAL | 12.001, 12.002, ... | 배기 정화, 냉각 |
| **13** | IT_INFRASTRUCTURE | 13.001, 13.002, ... | 서버, 네트워크 |
| **14** | FACILITY | 14.001, 14.002, ... | 건물, 창문, 전기판넬 |
| **15** | SUPPORT | 15.001, 15.002, ... | 지게차, 이송 장비 |

---

## 부록 B: 자산 상태 정의

| 상태 | 의미 | 색상 | BM 가능 | PM 가능 |
|------|------|------|--------|--------|
| **active** | 운영 중 | 🟢 Green | O | O |
| **idle** | 미사용 (유지보수 중) | 🟡 Yellow | O | O |
| **maintenance** | 정비 중 | 🔧 Orange | X | X |
| **sold** | 매각됨 | 🚫 Red | X | X |
| **scrapped** | 폐기됨 | ☠️ Gray | X | X |

---

**문서 버전:** v1.0  
**작성자:** DSC FMS Planner  
**마지막 수정:** 2026-05-14  
**검토 상태:** 웹 개발자 대기 (구현 준비 완료)
