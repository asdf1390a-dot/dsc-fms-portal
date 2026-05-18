# Asset Master v2 설계 — 기존 자산 기반 증분 업그레이드

> **작성일:** 2026-05-15  
> **상태:** 설계 완료 (웹개발자 구현 대기)  
> **범위:** Option A — 기존 506개 자산 유지 + 증분 개선  
> **목표:** BM/PM/Disposal FK 체인 보존하면서 부족한 기능만 추가  

---

## 목차

1. [전략](#전략)
2. [기존 상태 분석](#기존-상태-분석)
3. [변경 범위](#변경-범위)
4. [데이터 모델 변경](#데이터-모델-변경)
5. [UI/UX 설계](#uiux-설계)
6. [API 목록 (축소)](#api-목록-축소)
7. [구현 순서](#구현-순서)
8. [엣지 케이스](#엣지-케이스)

---

## 전략

### 왜 Option A 선택?

**문제점 (Greenfield 접근)**
- Greenfield 설계는 506개 기존 자산을 무시함
- 기존 자산 재입력 필요 → 시간 낭비, 데이터 손실 위험
- BM/PM/Disposal 모듈이 asset FK 참조 → 기존 자산 삭제 불가능
- 40개 API는 너무 많음 (유지보수 비용 높음)

**Option A의 장점**
1. **기존 506개 자산 = 100% 유지**
   - DB 테이블 유지 (categories, asset_classes, assets, asset_audit)
   - 시드 데이터 그대로 (03_seed_assets.sql)
   - BM/PM/Disposal FK 체인 안전

2. **필수 기능만 25개 API로 축소**
   - CRUD (Create, Read, Update, Delete)
   - QR 스캔 및 업데이트
   - 벌크 임포트 (상위 N개만)
   - 검색, 통계, 보고

3. **기존 타입과 호환성 유지**
   - lib/assets/types.ts 그대로 사용
   - 기존 UI (app/assets/page.tsx) 호환

4. **개발 기간 단축**
   - 설계 1일 + 구현 7일 (예상)
   - Greenfield는 3주 이상 소요

---

## 기존 상태 분석

### 현재 DB 스냅샷

**테이블 4개:**
```
categories           (15행)    — 대분류
asset_classes        (~120행)  — 소분류
assets              (506행)   — 자산 마스터
asset_audit         (~0행)    — 감시 로그 (INSERT 트리거로 기록)
```

**주요 스키마 특성:**
- ✅ assets.qr_payload = 기본값 machine_asset_number (트리거)
- ✅ assets.extra = JSONB (카테고리별 확장필드)
- ✅ assets.photos = TEXT[] (Supabase Storage URL)
- ✅ asset_audit 트리거 = INSERT/UPDATE/DELETE 자동 기록
- ✅ RLS 정책 = authenticated 사용자 전체 접근

**기존 API (app/api/assets/)**
```
POST   /api/assets                      — 신규 추가
GET    /api/assets                      — 목록 (Supabase PostgREST)
GET    /api/assets/[assetId]            — 상세
PUT    /api/assets/[assetId]            — 수정
DELETE /api/assets/[assetId]            — 삭제
POST   /api/assets/[assetId]/dispose    — 폐기 처리
GET    /api/assets/[assetId]/documents  — 첨부문서 조회
GET    /api/assets/export/excel         — Excel 내보내기
GET    /api/assets/export/csv           — CSV 내보내기
```

**기존 UI (app/assets/)**
```
page.tsx             — 자산 목록 페이지 (기본 기능)
[assetId]/
  page.tsx           — 상세 조회 페이지
new/
  page.tsx           — 신규 추가 폼
```

---

## 변경 범위

### 추가되는 기능 (V2)

| # | 기능 | 도입 이유 | 범위 |
|---|------|---------|------|
| 1 | QR 스캔 → 자산 상세 조회 | 현장에서 QR 스캔 후 즉시 정보 확인 | API + UI |
| 2 | QR 코드 재생성 | 손상된 QR 코드 재지정 | API + UI |
| 3 | 자산 대량 임포트 (Excel) | 신규 자산 일괄 등록 | API + UI |
| 4 | 고급 검색 (필터) | 필터링 기반 조회 | API + UI |
| 5 | 자산 이력 페이지 | asset_audit 기반 변경 이력 표시 | UI |
| 6 | 통계 대시보드 | 자산 현황 요약 | API + UI |
| 7 | 오프라인 모드 | 모바일 앱에서 오프라인 검색 | API |

### 변경하지 않는 것

| # | 항목 | 이유 |
|---|------|------|
| 1 | 기존 506개 자산 | BM/PM/Disposal FK 체인 보존 |
| 2 | DB 테이블 구조 | 스키마 변경 최소화 |
| 3 | 기존 API 인터페이스 | 호환성 유지 |
| 4 | 기존 UI 레이아웃 | 사용자 학습 비용 최소화 |

---

## 데이터 모델 변경

### 1. 스키마 추가 (최소한)

기존 assets 테이블에 선택적 열 추가 없음. JSONB `extra` 필드에 QR 관련 정보 저장.

```sql
-- 추가되는 컬럼: 없음
-- 변경되는 컬럼: 없음
-- 기존 열을 100% 활용:
--   qr_payload        → QR 스캔 대상
--   extra.qr_config   → QR 생성 옵션 (신규 자산만)
--   extra.import_source → 대량 임포트 출처
--   extra.batch_id    → 임포트 배치 ID
```

### 2. 신규 테이블 (v2에서만)

#### **asset_qr_scans** — QR 스캔 로그

```sql
create table asset_qr_scans (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid references assets(id) on delete cascade,
  qr_payload text not null,
  scanned_at timestamptz not null default now(),
  scanned_by uuid references auth.users(id),
  device_info text,       -- 스캔 기기 정보 (모바일/태블릿)
  location_gps text       -- GPS 좌표 (optional)
);
create index asset_qr_scans_asset_idx on asset_qr_scans(asset_id);
create index asset_qr_scans_payload_idx on asset_qr_scans(qr_payload);
```

**용도:** 
- 현장 직원이 QR 스캔했을 때 자동 기록
- 자산 위치 추적 (GPS 있으면)
- 접근 통계

---

## UI/UX 설계

### 1. 화면 흐름 (5개 페이지)

#### **페이지 1: 자산 목록** (`/assets`)

**상단 (고정)**
```
┌─────────────────────────────────────────┐
│ [←] Asset Master          [≡] [🔍] [⊕]  │  ← 목록, 필터, 신규
└─────────────────────────────────────────┘

│ 검색 및 필터 (축소형)                     │
├─────────────────────────────────────────┤
│ 카테고리 ▼ | 상태 ▼ | 위치 ▼ |          │
└─────────────────────────────────────────┘
```

**본문 (스크롤)**
```
목록 (가장 최근 수정 순)
┌──────────────────────────────────┐
│ DCMI-UTL-PSF-01                  │ ← 물리 태그 (클릭)
│ SUB STATION                      │
│ UTILITY / Power Supply           │
│ ✓ Active | EB YARD               │
└──────────────────────────────────┘
...
```

**하단 (고정)**
```
┌──────────────────────────────────┐
│ 506개 자산 보유                  │
│ [임포트] [더보기]                │
└──────────────────────────────────┘
```

**액션:**
- 아이템 클릭 → 상세 페이지로 이동
- 필터 조건 변경 → 목록 갱신
- [⊕] 버튼 → 신규 추가 페이지로 이동
- [임포트] 버튼 → 대량 임포트 모달로 이동

---

#### **페이지 2: 자산 상세** (`/assets/[assetId]`)

**상단 (고정)**
```
┌─────────────────────────────────────────┐
│ [←]           [⋯]                       │ ← 뒤로, 메뉴
└─────────────────────────────────────────┘
```

**본문 (탭)**

```
탭 1: 개요 (기본 정보)
┌─────────────────────────────────────────┐
│ [QR 코드 이미지 (200x200)]              │
│                                         │
│ DCMI-UTL-PSF-01                        │ (물리 태그)
│ 01.001.001                             │ (자산 코드)
│                                         │
│ 이름        SUB STATION                 │
│ 카테고리    UTILITY > Power Supply      │
│ 상태        🟢 Active                   │
│ 위치        EB YARD                     │
│ 메이크      TRINITY                     │
│ 모델        EB - SUB STATION            │
│ 제조년도    2015                        │
│ 시리얼번호  (없음)                      │
│ 비고        정기점검 필요              │
│                                         │
│ [📷 사진 추가] [🖨️ QR 재생성]          │
└─────────────────────────────────────────┘

탭 2: 이력 (변경 기록)
┌─────────────────────────────────────────┐
│ 2026-05-14 12:30 | 상태 변경             │
│   active → maintenance (by Kim)         │
│                                         │
│ 2026-05-13 09:45 | 위치 변경             │
│   EB YARD → WORKSHOP (by Lee)           │
│                                         │
│ 2026-05-10 14:20 | 생성됨                │
│   (초기 데이터)                         │
└─────────────────────────────────────────┘

탭 3: 사진 (첨부 미디어)
┌─────────────────────────────────────────┐
│ [📷 추가]                               │
│                                         │
│ [사진 1]  [사진 2]  [사진 3]             │
│   ↓열기    ↓삭제    ↓삭제               │
└─────────────────────────────────────────┘
```

**하단 액션**
```
┌─────────────────────────────────────────┐
│ [수정] [폐기] [더보기]                  │
└─────────────────────────────────────────┘
```

---

#### **페이지 3: 신규 추가** (`/assets/new`)

```
양식 (스크롤)
┌─────────────────────────────────────────┐
│ 자산 코드 정보                          │
├─────────────────────────────────────────┤
│ * 카테고리         [UTILITY ▼]          │
│ * 자산 분류        [Power Supply ▼]     │
│                                         │
│ 식별자                                  │
├─────────────────────────────────────────┤
│ * 물리 태그        [DCMI-....... ]      │
│ * 자산명 (영문)    [SUB STATION]        │
│   자산명 (타밀어)  [                 ]  │
│   시리얼번호       [                 ]  │
│                                         │
│ 규격                                    │
├─────────────────────────────────────────┤
│   제조사            [            ]      │
│   모델              [            ]      │
│   제조년도          [2026]              │
│                                         │
│ 배치 정보                               │
├─────────────────────────────────────────┤
│ * 위치              [EB YARD    ]        │
│ * 상태              [active ▼]          │
│   비고              [             ]     │
│                                         │
│ 추가 정보                               │
├─────────────────────────────────────────┤
│   사진 추가         [📷 선택]            │
│   QR 커스텀 페이로드[            ]      │
└─────────────────────────────────────────┘

[취소] [저장]
```

**검증 규칙:**
- 카테고리, 분류, 물리태그, 자산명 = 필수
- 물리태그 = 기존 자산과 중복 불가
- 카테고리-분류 조합 = 존재하는 것만

---

#### **페이지 4: 편집** (`/assets/[assetId]/edit`)

신규 추가 페이지와 동일 양식. 초기값 pre-fill.

**추가 옵션:**
```
├─ QR 코드 재생성
│  ├─ 기본값 (물리 태그)
│  ├─ 커스텀 페이로드
│  └─ [생성 후 다운로드]
│
├─ 상태 변경 이력
│  └─ [마지막 변경: 2026-05-14 by Kim]
│
└─ 위험한 작업
   ├─ [폐기 처리]
   └─ [영구 삭제]
```

---

#### **페이지 5: 대량 임포트** (`/assets/import`)

```
┌─────────────────────────────────────────┐
│ 대량 임포트 — Excel                      │
├─────────────────────────────────────────┤
│                                         │
│ 파일 선택 (최대 500KB, .xlsx/.csv)     │
│ [📁 선택]                               │
│                                         │
│ 로드된 데이터:                          │
│ ┌─────────────────────────────────────┐
│ │ 물리 태그  | 자산명      | 카테고리 │
│ ├─────────────────────────────────────┤
│ │ DCMI-... | SUB STATION| UTILITY   │
│ │ DCMI-... | AIR PUMP   | UTILITY   │
│ │ ...                                 │
│ │ 상위 5개 미리보기 (총 N개)          │
│ └─────────────────────────────────────┘
│                                         │
│ 옵션                                   │
├─────────────────────────────────────────┤
│ ☐ 중복 물리태그 → 스킵 (기본)         │
│ ☐ 중복 물리태그 → 업데이트            │
│ ☐ 신규 필드 추가 (부족한 컬럼 사용)   │
│                                         │
│ [취소] [미리보기] [임포트]             │
└─────────────────────────────────────────┘
```

**임포트 로직:**
1. 파일 업로드
2. 헤더 자동 인식 (물리태그, 자산명, 카테고리 등)
3. 검증 (카테고리 존재? 물리태그 중복? 필수필드 있음?)
4. 미리보기 (상위 5개 + 검증 결과)
5. 임포트 실행 (배치 ID로 추적)

---

### 2. 모바일 반응형 (우선순위 1)

**스마트폰 (320px~)**
- 단일 컬럼 레이아웃
- 탭 = 하단 탭바
- 필터 = 사이드 드로어 또는 모달

**태블릿 (768px~)**
- 양단 컬럼 (목록 + 상세)
- 상단 메뉴바
- 필터 = 좌측 사이드바

---

### 3. 색상 및 스타일 (기존 디자인 시스템 유지)

**색상:**
```
상태별 뱃지:
🟢 Active      (초록)
🟡 Idle        (노랑)
🟠 Maintenance (주황)
🔴 Sold/Scrapped (빨강)
```

**타이포:**
```
제목: 16px bold (Segoe UI / Inter)
본문: 14px regular
라벨: 12px medium
```

**간격:**
```
마진: 16px (기본)
패딩: 12px (내부)
```

---

## API 목록 (축소)

### 범주별 엔드포인트 (25개)

#### **A. 자산 CRUD (5개)**

| 메서드 | 엔드포인트 | 설명 |
|--------|----------|------|
| GET | `/api/assets` | 자산 목록 (페이징, 필터) |
| GET | `/api/assets/[assetId]` | 자산 상세 |
| POST | `/api/assets` | 신규 자산 생성 |
| PUT | `/api/assets/[assetId]` | 자산 수정 |
| DELETE | `/api/assets/[assetId]` | 자산 삭제 |

---

#### **B. QR 코드 (3개)**

| 메서드 | 엔드포인트 | 설명 |
|--------|----------|------|
| GET | `/api/assets/qr/[qrPayload]` | QR 페이로드로 자산 조회 |
| PUT | `/api/assets/[assetId]/qr` | QR 페이로드 재생성 |
| POST | `/api/assets/[assetId]/qr/generate` | QR 코드 이미지 생성 (PNG) |

---

#### **C. 자산 이력 (2개)**

| 메서드 | 엔드포인트 | 설명 |
|--------|----------|------|
| GET | `/api/assets/[assetId]/audit` | 변경 이력 조회 (타임라인) |
| GET | `/api/assets/[assetId]/audit/diff` | 특정 변경 전후 비교 |

---

#### **D. 검색 & 필터 (3개)**

| 메서드 | 엔드포인트 | 설명 |
|--------|----------|------|
| GET | `/api/assets/search` | 텍스트 검색 (name, make, model, 태그) |
| GET | `/api/assets/categories` | 카테고리 목록 (필터용) |
| GET | `/api/assets/classes` | 자산 분류 목록 (필터용) |

---

#### **E. 대량 임포트 (4개)**

| 메서드 | 엔드포인트 | 설명 |
|--------|----------|------|
| POST | `/api/assets/import/validate` | Excel 파일 검증 |
| POST | `/api/assets/import/execute` | 대량 임포트 실행 |
| GET | `/api/assets/import/status/[batchId]` | 임포트 진행률 조회 |
| GET | `/api/assets/import/history` | 임포트 이력 (최근 10회) |

---

#### **F. QR 스캔 로그 (2개)**

| 메서드 | 엔드포인트 | 설명 |
|--------|----------|------|
| POST | `/api/assets/[assetId]/qr/scan` | QR 스캔 기록 |
| GET | `/api/assets/[assetId]/qr/scans` | 해당 자산의 스캔 로그 |

---

#### **G. 통계 & 보고 (4개)**

| 메서드 | 엔드포인트 | 설명 |
|--------|----------|------|
| GET | `/api/assets/stats/summary` | 자산 현황 요약 (총개수, 카테고리별 분포) |
| GET | `/api/assets/stats/by-category` | 카테고리별 자산 수 |
| GET | `/api/assets/stats/by-status` | 상태별 자산 분포 |
| GET | `/api/assets/stats/by-location` | 위치별 자산 분포 |

---

#### **H. 내보내기 (2개)**

| 메서드 | 엔드포인트 | 설명 |
|--------|----------|------|
| GET | `/api/assets/export/excel` | 자산 목록을 Excel로 내보내기 |
| GET | `/api/assets/export/csv` | 자산 목록을 CSV로 내보내기 |

---

### 요청/응답 예시

#### **GET /api/assets** (목록, 필터)

**요청:**
```
GET /api/assets?
  page=1&
  limit=20&
  category=01&
  status=active&
  location_like=COMPRESSOR&
  sort=updated_at.desc
```

**응답:**
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "machine_asset_number": "DCMI-UTL-PSF-01",
      "machine_asset_code": "01.001.001",
      "name_en": "SUB STATION",
      "asset_class_code": "01.001",
      "status": "active",
      "location": "EB YARD",
      "qr_payload": "DCMI-UTL-PSF-01",
      "updated_at": "2026-05-14T12:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 506,
    "pages": 26
  }
}
```

---

#### **POST /api/assets** (신규 생성)

**요청:**
```json
{
  "asset_class_code": "01.001",
  "machine_asset_number": "DCMI-UTL-PSF-99",
  "name_en": "NEW SUBSTATION",
  "location": "EB YARD",
  "status": "active",
  "make": "TRINITY",
  "model": "EB - SUBSTATION",
  "year_of_manufacture": 2026
}
```

**응답:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "machine_asset_number": "DCMI-UTL-PSF-99",
    "name_en": "NEW SUBSTATION",
    ...
  }
}
```

---

#### **GET /api/assets/qr/[qrPayload]** (QR 스캔 조회)

**요청:**
```
GET /api/assets/qr/DCMI-UTL-PSF-01
```

**응답:**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-...",
    "machine_asset_number": "DCMI-UTL-PSF-01",
    "name_en": "SUB STATION",
    "location": "EB YARD",
    "status": "active",
    ...
  }
}
```

---

#### **POST /api/assets/[assetId]/qr/scan** (스캔 로그)

**요청:**
```json
{
  "qr_payload": "DCMI-UTL-PSF-01",
  "device_info": "Samsung Galaxy Tab S7 / Chrome",
  "location_gps": "13.1939,80.1705"
}
```

**응답:**
```json
{
  "success": true,
  "data": {
    "id": "scan-uuid",
    "asset_id": "asset-uuid",
    "scanned_at": "2026-05-15T10:00:00Z",
    "device_info": "..."
  }
}
```

---

#### **GET /api/assets/[assetId]/audit** (이력 타임라인)

**요청:**
```
GET /api/assets/550e8400-e29b-41d4-a716-446655440000/audit?limit=20
```

**응답:**
```json
{
  "success": true,
  "data": [
    {
      "id": "audit-uuid",
      "asset_id": "...",
      "action": "status_change",
      "changed_at": "2026-05-14T12:30:00Z",
      "changed_by": "user-uuid",
      "diff": {
        "before": { "status": "active" },
        "after": { "status": "maintenance" },
        "fields_changed": ["status"]
      }
    }
  ]
}
```

---

#### **POST /api/assets/import/validate** (Excel 검증)

**요청 (multipart/form-data):**
```
POST /api/assets/import/validate
Content-Type: multipart/form-data

[파일: assets_import.xlsx]
```

**응답:**
```json
{
  "success": true,
  "data": {
    "total_rows": 50,
    "valid_rows": 48,
    "errors": [
      {
        "row": 2,
        "field": "machine_asset_number",
        "message": "중복 (기존 자산: DCMI-UTL-PSF-01)"
      },
      {
        "row": 3,
        "field": "asset_class_code",
        "message": "존재하지 않는 분류"
      }
    ],
    "preview": [
      {
        "machine_asset_number": "DCMI-NEW-001",
        "name_en": "New Asset 1",
        ...
      }
    ]
  }
}
```

---

#### **GET /api/assets/stats/summary** (통계)

**요청:**
```
GET /api/assets/stats/summary
```

**응답:**
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
      ...
    },
    "last_updated": "2026-05-15T10:00:00Z"
  }
}
```

---

## 구현 순서

### Phase 1: 기초 (1일)
- [ ] DB 마이그레이션 (asset_qr_scans 테이블 추가)
- [ ] 타입 업데이트 (lib/assets/types.ts)
- [ ] 기존 테스트 (Supabase PostgREST 호환성)

### Phase 2: 핵심 API (2일)
- [ ] CRUD API (GET, POST, PUT, DELETE)
- [ ] 검색 & 필터 API
- [ ] 통계 API
- [ ] 이력 API (GET /audit)

### Phase 3: QR & 임포트 (2일)
- [ ] QR 관련 API (조회, 재생성, 스캔 로그)
- [ ] 대량 임포트 검증/실행

### Phase 4: UI (1.5일)
- [ ] 목록 페이지 개선
- [ ] 상세 페이지 (탭: 개요, 이력, 사진)
- [ ] 신규/편집 폼
- [ ] 임포트 모달

### Phase 5: 테스트 & 배포 (0.5일)
- [ ] E2E 테스트 (목록, 상세, CRUD)
- [ ] 모바일 테스트
- [ ] 본배포

**총 기간:** 7일 (2026-05-16 ~ 2026-05-23)

---

## 엣지 케이스

### 1. 데이터 무결성

**케이스:** 신규 자산 추가 중 다른 사용자가 같은 물리태그를 입력
- **방지:** 물리태그 UNIQUE 제약 (DB 레벨)
- **응답:** 409 Conflict + "이미 존재하는 자산"

**케이스:** 임포트 중 일부 행이 실패
- **방지:** 트랜잭션 (전체 성공 또는 전체 실패)
- **응답:** 실패한 행 목록 + 재시도 옵션

---

### 2. 권한 & 역할

**현재:** RLS 정책 = 모든 authenticated 사용자 전체 접근
- **개선 예정:** 역할별 권한 (관리자만 DELETE, 기술자는 READ/SCAN만)
- **지금:** v2에서는 기존 RLS 정책 유지

---

### 3. 오프라인 모드

**케이스:** 모바일에서 네트워크 끊김
- **지원:** 기본 목록만 로컬 캐시 (IndexedDB)
- **상세 조회:** 네트워크 복구 후 가능

**구현 제외:** v2 범위 밖 (v3에서 고려)

---

### 4. 성능 (대규모 데이터)

**문제:** 500개 자산 목록 조회 시 느림
- **해결:** 페이징 (기본 20개/페이지)
- **인덱스:** category, status, make 인덱스 활용

**쿼리 최적화:**
```sql
-- 기존 인덱스 활용
SELECT * FROM assets 
  WHERE asset_class_code = '01.001' 
  AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 20 OFFSET 0;
```

---

### 5. 국제화 (i18n)

**지원 언어:**
- 관리자 UI: 한국어 (ko) + 영어 (en)
- 현장 스캔: 영어 (en) + 타밀어 (ta)

**변수 이름:** 영어 유지 (API, DB)

---

### 6. 삭제 정책

**케이스:** BM 이력이 있는 자산 삭제 시도
- **방지:** FK 제약 (DELETE 거부)
- **대안:** 상태를 'scrapped'로 변경 권유

**쿼리:**
```sql
UPDATE assets SET status = 'scrapped' 
WHERE id = 'asset-uuid';
```

---

## 부록: 기존과의 호환성 검증

### 기존 API 호환성 체크

| API | 호환성 | 비고 |
|-----|--------|------|
| POST /api/assets | ✅ 유지 | 신규 필드 선택적 |
| GET /api/assets | ✅ 개선 | 페이징, 필터 추가 |
| GET /api/assets/[id] | ✅ 유지 | - |
| PUT /api/assets/[id] | ✅ 유지 | audit 트리거 자동 기록 |
| DELETE /api/assets/[id] | ✅ 유지 | 삭제 전 FK 검증 |
| POST /api/assets/[id]/dispose | ✅ 유지 | 상태 'scrapped'로 변경 |
| GET /api/assets/export/excel | ✅ 유지 | - |
| GET /api/assets/export/csv | ✅ 유지 | - |

### 기존 UI 호환성 체크

| 페이지 | 호환성 | 변경 사항 |
|--------|--------|---------|
| /assets | ✅ 유지 | 필터 UI 개선 |
| /assets/[id] | ✅ 개선 | 탭 추가 (이력, 사진) |
| /assets/new | ✅ 유지 | 신규 필드 선택적 |

---

## 최종 체크리스트 (웹개발자용)

### 구현 전 확인

- [ ] DB 파일 번호 = `db/24_asset_master_v2.sql` (23번은 Backup Phase 2 사용 중)
- [ ] 기존 506개 자산 = 100% 유지
- [ ] BM/PM/Disposal FK 체인 = 안전 (테스트)
- [ ] 기존 API 호환성 = 테스트 (GET, POST, PUT, DELETE)
- [ ] 기존 UI 동작 = 테스트

### 배포 전 확인

- [ ] 모바일 반응형 테스트 (320px, 768px)
- [ ] QR 스캔 테스트 (바코드 리더 앱)
- [ ] 대량 임포트 테스트 (50개 행)
- [ ] 통계 쿼리 성능 (500개 자산)
- [ ] 사용자 역할 권한 확인 (RLS)

---

## 문서 버전 관리

| 버전 | 일시 | 주요 변경 |
|------|------|---------|
| v1.0 | 2026-05-14 | Greenfield 설계 (40 API) |
| v2.0 | 2026-05-15 | Option A — 증분 업그레이드 (25 API) |

---

**작성자:** Planner (Web App Designer)  
**검토 대기:** Web-Builder (구현)  
**최종 확인:** Evaluator (평가자)  
**배포 예정:** 2026-05-23
