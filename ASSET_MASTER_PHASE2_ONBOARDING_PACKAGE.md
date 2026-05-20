# Asset Master Phase 2 — 신규팀원 온보딩 패키지

> **작성:** 2026-05-19 (당겨온 일정)  
> **대상:** 신규팀원 (2026-05-19~23 즉시 시작)  
> **마감:** 2026-05-23 18:00 KST (5일)  
> **상태:** 🟢 설계 완료 → 즉시 구현 가능  

---

## 🚀 빠른 시작 (Day 1: 2026-05-19~20)

### 필수 체크리스트 (2시간)

- [ ] **Git 클론 & 브랜치**
  ```bash
  cd /home/jeepney/.openclaw/workspace-dev/dsc-fms-portal
  git checkout main
  git pull origin main
  git checkout -b feature/asset-phase2-api
  ```

- [ ] **환경 변수 확인** (`/home/jeepney/.openclaw/workspace-dev/dsc-fms-portal/.env.local`)
  - `NEXT_PUBLIC_SUPABASE_URL` ✅
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` ✅
  - 다른 외부 API 키 (필요시)

- [ ] **디렉토리 구조 확인**
  ```
  app/
  ├── api/
  │   ├── assets/
  │   │   ├── route.ts           (새로 생성 — GET /assets, POST /assets)
  │   │   ├── [assetId]/
  │   │   │   ├── route.ts       (새로 생성 — GET, PUT, DELETE)
  │   │   │   └── audit-log/
  │   │   │       └── route.ts   (새로 생성 — GET audit-log)
  │   │   ├── bulk-update/
  │   │   │   └── route.ts       (새로 생성)
  │   │   ├── import/
  │   │   │   ├── route.ts       (새로 생성 — GET/POST 분기)
  │   │   │   ├── preview/
  │   │   │   ├── execute/
  │   │   │   ├── batches/
  │   │   │   ├── template.xlsx  (GET로 반환)
  │   │   ├── categories/
  │   │   │   └── route.ts       (새로 생성)
  │   │   ├── locations/
  │   │   │   └── route.ts       (새로 생성)
  │   │   ├── export/
  │   │   │   └── route.ts       (새로 생성)
  │   │   └── statistics/
  │   │       └── route.ts       (새로 생성)
  │   └── ... (기존 엔드포인트)
  ├── components/
  │   ├── assets/
  │   │   ├── AssetListView.tsx  (개선)
  │   │   ├── AssetDetailPanel.tsx (기존)
  │   │   ├── BulkImportWizard.tsx (신규)
  │   │   ├── StatisticsDashboard.tsx (신규)
  │   │   └── FilterDrawer.tsx    (개선)
  │   └── ...
  └── ...
  ```

- [ ] **DB 마이그레이션 확인** (벡팀이 이미 실행했는지 확인)
  ```sql
  -- Supabase에서 수행됨
  -- asset_import_batches 테이블 존재 확인
  -- asset_import_items 테이블 존재 확인
  ```

---

## 📊 Phase 2 현황 요약

| 항목 | 상태 |
|------|------|
| **설계** | ✅ 완료 (2026-05-16) |
| **DB 스키마** | ✅ 마이그레이션 대기 (2026-05-19) |
| **API 설계** | ✅ 완료 (16개 MVP) |
| **UI 설계** | ✅ 완료 (3개 화면) |
| **웹개발자 진행률** | 5% (dropdown 드롭다운만 완료) |
| **신규팀원** | 🟢 당신 (즉시 시작) |
| **개발 기간** | 2026-05-19~23 (5일) |

### 팀 구성 & 역할

| 역할 | 이름 | 기간 | 작업 |
|------|------|------|------|
| 웹개발자 | TBD | 05-17~22 AM | API 주도 개발 + UI + 배포 |
| **신규팀원** | **당신** | **05-19~23** | **UI 컴포넌트 또는 API 3~4개** |
| 평가자 | TBD | 05-20~ | QA 검증 |

---

## 🎯 MVP 16개 API — 우선순위 정렬

### 그룹 1: 기본 조회 (5개) — Critical Path
**목표:** 2026-05-17~18 완료  
**우선순위:** 매우 높음 (다른 API 및 UI 기반)

| # | 엔드포인트 | 복잡도 | 예상시간 | 파일 경로 |
|---|-----------|--------|----------|----------|
| **1** | `GET /api/assets` | Mid | 2~3h | `app/api/assets/route.ts` |
| **2** | `GET /api/assets/:id` | Low | 0.5h | `app/api/assets/[assetId]/route.ts` |
| **3** | `GET /api/asset-categories` | Low | 1h | `app/api/assets/categories/route.ts` |
| **4** | `GET /api/assets/:id/audit-log` | Low | 1~1.5h | `app/api/assets/[assetId]/audit-log/route.ts` |
| **5** | `GET /api/assets/locations` | Low | 1h | `app/api/assets/locations/route.ts` |

**핵심 구현 요점:**
- **FTS (Full-Text Search):** `q` 파라미터로 name_en, name_ta, model, serial_no 검색
- **필터:** category, status, location, make
- **정렬:** updated_at (기본, desc), name_en, status
- **페이지네이션:** page, per_page (기본 20, 최대 100)

---

### 그룹 2: CRUD 작업 (4개)
**목표:** 2026-05-19~20 완료  
**우선순위:** 높음 (기본 기능)

| # | 엔드포인트 | 복잡도 | 예상시간 | 파일 경로 |
|---|-----------|--------|----------|----------|
| **6** | `POST /api/assets` | Mid | 1.5~2h | `app/api/assets/route.ts` (POST 분기) |
| **7** | `PUT /api/assets/:id` | Mid | 1.5~2h | `app/api/assets/[assetId]/route.ts` (PUT 분기) |
| **8** | `DELETE /api/assets/:id` | Low | 1h | `app/api/assets/[assetId]/route.ts` (DELETE 분기) |
| **9** | `POST /api/assets/bulk-update` | Mid | 2~2.5h | `app/api/assets/bulk-update/route.ts` |

**핵심 구현 요점:**
- **검증:** asset_id, category, status, location 필수 필드 확인
- **Audit Trail:** `asset_audit` 테이블에 변경사항 기록 (created_by, operation, old_value, new_value)
- **Bulk Update:** 트랜잭션으로 여러 자산 동시 수정 (상태, 위치 주로)

---

### 그룹 3: 임포트 작업 (5개)
**목표:** 2026-05-20~22 완료  
**우선순위:** 높음 (대량 등록 필요)

| # | 엔드포인트 | 복잡도 | 예상시간 | 파일 경로 |
|---|-----------|--------|----------|----------|
| **10** | `GET /api/assets/import/template.xlsx` | Low | 1h | `app/api/assets/import/route.ts` (GET 분기) |
| **11** | `POST /api/assets/import/preview` | High | 3~4h | `app/api/assets/import/preview/route.ts` |
| **12** | `POST /api/assets/import/execute` | High | 3~4h | `app/api/assets/import/execute/route.ts` |
| **13** | `GET /api/assets/import/batches` | Mid | 1.5h | `app/api/assets/import/batches/route.ts` |
| **14** | `GET /api/assets/import/batches/:batch_id` | Mid | 2h | `app/api/assets/import/batches/[batchId]/route.ts` |

**핵심 구현 요점:**
- **템플릿:** xlsx 라이브러리로 Excel 시트 생성
- **검증:** asset_number 중복 체크, 필수 필드 검증 (name_en, category, status)
- **프리뷰:** 실제 삽입하지 않고 검증 결과만 반환 (asset_import_items에 임시 저장)
- **실행:** 트랜잭션으로 asset_import_items → assets 일괄 이동
- **배치 추적:** asset_import_batches에 상태/카운트 기록

---

### 그룹 4: 내보내기 & 통계 (2개)
**목표:** 2026-05-22~23 완료  
**우선순위:** 중간 (선택 기능)

| # | 엔드포인트 | 복잡도 | 예상시간 | 파일 경로 |
|---|-----------|--------|----------|----------|
| **15** | `GET /api/assets/export/excel` | Mid | 2~2.5h | `app/api/assets/export/route.ts` |
| **16** | `GET /api/assets/statistics` | Low | 1.5h | `app/api/assets/statistics/route.ts` |

**핵심 구현 요점:**
- **내보내기:** 현재 목록 전체 또는 필터링된 데이터를 Excel로 변환
- **통계:** 상태별(active/idle/maintenance/sold/scrapped) 개수, 카테고리별 개수, 월별 추가 현황

---

## 📅 5일 개발 로드맵 (2026-05-19~23)

### Day 1 (2026-05-19 월) — 온보딩 & DB 마이그레이션

**웹개발자 작업:**
- [ ] DB 마이그레이션 실행 (asset_import_batches, asset_import_items)
- [ ] 인덱스 생성 확인 (asset_number, org_id, created_at)
- [ ] RLS 정책 확인 (asset_import_batches org_id 필터)

**신규팀원 작업 (당신):**
- [ ] 이 문서 정독 (1시간)
- [ ] Git 클론 & 브랜치 생성 (30분)
- [ ] Next.js 프로젝트 구조 파악 (1시간)
- [ ] Supabase 대시보드 접근 확인 (30분)
- [ ] 기존 Asset Phase 1 API 코드 리뷰 (`app/api/assets/route.ts`) (1시간)

**체크포인트:** 18:00 — DB 마이그레이션 완료, 팀 슬랙 공지

---

### Day 2 (2026-05-20 화) — 그룹 1 & 2 개발 (Critical Path)

**웹개발자 작업:**
- [ ] API #1: `GET /api/assets` (필터 + 검색) — 2~3시간
- [ ] API #2: `GET /api/assets/:id` — 30분 (기존 코드 재사용)
- [ ] API #6: `POST /api/assets` — 1.5~2시간
- **예상 완료:** 오후 4시경

**신규팀원 작업 (당신):**
- [ ] API #3: `GET /api/asset-categories` — 1시간
- [ ] API #4: `GET /api/assets/:id/audit-log` — 1~1.5시간
- [ ] API #5: `GET /api/assets/locations` — 1시간
- **병렬 진행:** 가능 (웹개발자와 독립적)
- **예상 완료:** 오후 4시경

**체크포인트:** 16:00 — API #1~5 PR 오픈, 평가자 리뷰 시작

---

### Day 3 (2026-05-21 수) — CRUD & Import 시작

**웹개발자 작업:**
- [ ] API #7: `PUT /api/assets/:id` — 1.5~2시간
- [ ] API #8: `DELETE /api/assets/:id` — 1시간
- [ ] API #9: `POST /api/assets/bulk-update` — 2~2.5시간
- [ ] API #10: `GET /api/assets/import/template.xlsx` — 1시간
- **예상 완료:** 오후 5시경

**신규팀원 작업 (당신):**
- [ ] 선택 1: API #11 (Preview) 또는 API #13 (Batches List) 중 하나 시작
- [ ] 또는 UI 컴포넌트 시작:
  - [ ] `FilterDrawer.tsx` 개선 (필터 레이아웃)
  - [ ] `AssetListView.tsx` 개선 (페이지네이션, 정렬 버튼)

**체크포인트:** 16:00 — API #6~10 PR 오픈

---

### Day 4 (2026-05-22 목) — Import & UI

**웹개발자 작업:**
- [ ] API #11: `POST /api/assets/import/preview` — 3~4시간 (높은 복잡도)
- [ ] API #12: `POST /api/assets/import/execute` — 3~4시간 (높은 복잡도)
- **예상 완료:** 오후 5시경

**신규팀원 작업 (당신):**
- [ ] API #13, #14 완료 또는
- [ ] UI 컴포넌트 개발:
  - [ ] `BulkImportWizard.tsx` (3단계: 업로드 → 미리보기 → 실행)
  - [ ] `StatisticsDashboard.tsx` (상태별/카테고리별 차트)

**체크포인트:** 16:00 — API #11~12 PR 오픈

---

### Day 5 (2026-05-23 금) — Export, Statistics & 배포

**웹개발자 작업:**
- [ ] API #15: `GET /api/assets/export/excel` — 2~2.5시간
- [ ] API #16: `GET /api/assets/statistics` — 1.5시간
- [ ] 모든 API 통합 테스트
- [ ] Vercel 배포 최종 검증
- **예상 완료:** 오후 4시

**신규팀원 작업 (당신):**
- [ ] UI 컴포넌트 완료 또는 남은 API 마무리
- [ ] Postman / API 테스트 (웹개발자와 함께)
- [ ] 배포 전 QA 회의

**체크포인트:** 
- 14:00 — 최종 PR 오픈
- 16:00 — 평가자 승인
- **18:00 — 배포 완료 (최종 마감)**

---

## 🛠️ 기술 세부사항

### 데이터베이스 스키마 (신규 테이블)

#### asset_import_batches
```sql
CREATE TABLE public.asset_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_name text NOT NULL,
  batch_date date DEFAULT CURRENT_DATE,
  file_name text,
  file_size_bytes int,
  file_hash text,
  status text DEFAULT 'pending', -- pending|processing|success|partial|failed
  total_rows int,
  processed_count int DEFAULT 0,
  success_count int DEFAULT 0,
  error_count int DEFAULT 0,
  import_result jsonb, -- { "created": 100, "updated": 20, "failed": 5 }
  org_id uuid NOT NULL REFERENCES organizations(id),
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- RLS Policy (조직별 격리)
CREATE POLICY asset_import_batches_org_isolation ON asset_import_batches
  USING (org_id = (SELECT org_id FROM auth.users WHERE id = auth.uid()));
```

#### asset_import_items
```sql
CREATE TABLE public.asset_import_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES asset_import_batches(id) ON DELETE CASCADE,
  row_number int,
  asset_number text,
  name_en text,
  name_ta text,
  category_code text,
  status text,
  location text,
  make text,
  model text,
  serial_no text,
  year_of_manufacture int,
  validation_errors jsonb, -- { "name_en": "required", "category_code": "invalid" }
  asset_id uuid, -- 실제 생성된 자산 ID (import 후)
  status_item text DEFAULT 'pending', -- pending|processing|success|failed
  created_at timestamptz DEFAULT now()
);
```

### API 구현 패턴 (TypeScript)

#### 예시 1: GET /api/assets (필터 + 검색 + 페이지네이션)

```typescript
// app/api/assets/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const searchParams = request.nextUrl.searchParams;

  const page = parseInt(searchParams.get('page') || '1');
  const perPage = Math.min(parseInt(searchParams.get('per_page') || '20'), 100);
  const offset = (page - 1) * perPage;

  // FTS 검색
  const q = searchParams.get('q');
  const category = searchParams.get('category');
  const status = searchParams.get('status');
  const location = searchParams.get('location');
  const make = searchParams.get('make');
  const sortBy = searchParams.get('sort_by') || 'updated_at';
  const sortOrder = (searchParams.get('sort_order') || 'desc').toUpperCase();

  let query = supabase
    .from('assets')
    .select('*', { count: 'exact' });

  // 필터 적용
  if (q) {
    query = query.or(`name_en.ilike.%${q}%,name_ta.ilike.%${q}%,model.ilike.%${q}%,serial_no.ilike.%${q}%`);
  }
  if (category) query = query.eq('category_code', category);
  if (status) query = query.eq('status', status);
  if (location) query = query.ilike('location', `%${location}%`);
  if (make) query = query.eq('make', make);

  // 정렬 & 페이지네이션
  query = query.order(sortBy, { ascending: sortOrder === 'ASC' })
    .range(offset, offset + perPage - 1);

  const { data, count, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    data: data || [],
    total: count || 0,
    page,
    per_page: perPage,
    total_pages: Math.ceil((count || 0) / perPage),
  });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json();

  // 검증
  const required = ['machine_asset_number', 'name_en', 'category_code', 'status'];
  for (const field of required) {
    if (!body[field]) {
      return NextResponse.json(
        { error: `Missing required field: ${field}` },
        { status: 400 }
      );
    }
  }

  // 중복 확인
  const { data: existing } = await supabase
    .from('assets')
    .select('id')
    .eq('machine_asset_number', body.machine_asset_number)
    .single();

  if (existing) {
    return NextResponse.json(
      { error: 'Asset number already exists' },
      { status: 409 }
    );
  }

  // 생성
  const { data, error } = await supabase
    .from('assets')
    .insert([body])
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Audit 기록
  await supabase
    .from('asset_audit')
    .insert({
      asset_id: data.id,
      operation: 'create',
      changed_fields: JSON.stringify(body),
      created_by: (await supabase.auth.getUser()).data.user?.id,
    });

  return NextResponse.json(data, { status: 201 });
}
```

#### 예시 2: POST /api/assets/import/preview (검증 + 미리보기)

```typescript
// app/api/assets/import/preview/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import ExcelJS from 'exceljs';
import formidable from 'formidable';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  
  // 파일 업로드 처리 (multipart/form-data)
  const form = new formidable.IncomingForm();
  const [fields, files] = await form.parse(request.stream());
  
  const file = (files.file?.[0] as any);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(file.data);
  const worksheet = workbook.getWorksheet(1);

  const errors: any[] = [];
  const previews: any[] = [];

  let rowNumber = 2; // 헤더는 1줄
  for (const row of worksheet.getRows(2, worksheet.rowCount - 1) || []) {
    const item = {
      asset_number: row.getCell(1).value,
      name_en: row.getCell(2).value,
      name_ta: row.getCell(3).value,
      category_code: row.getCell(4).value,
      status: row.getCell(5).value,
      location: row.getCell(6).value,
    };

    const rowErrors: string[] = [];

    // 검증
    if (!item.asset_number) rowErrors.push('asset_number required');
    if (!item.name_en) rowErrors.push('name_en required');
    if (!item.category_code) rowErrors.push('category_code invalid');

    // 중복 확인
    const { count } = await supabase
      .from('assets')
      .select('id', { count: 'exact' })
      .eq('machine_asset_number', item.asset_number);
    
    if (count && count > 0) {
      rowErrors.push('asset_number already exists');
    }

    if (rowErrors.length > 0) {
      errors.push({ row: rowNumber, item, errors: rowErrors });
    } else {
      previews.push({ row: rowNumber, item });
    }

    rowNumber++;
  }

  // 배치 생성 (임시 상태)
  const { data: batch, error: batchError } = await supabase
    .from('asset_import_batches')
    .insert({
      batch_name: `Import ${new Date().toISOString()}`,
      file_name: file.name,
      file_size_bytes: file.size,
      status: 'pending',
      total_rows: previews.length + errors.length,
    })
    .select()
    .single();

  if (batchError) {
    return NextResponse.json({ error: batchError.message }, { status: 500 });
  }

  // 임포트 아이템 저장 (검증 결과)
  const items = [
    ...previews.map((p) => ({ batch_id: batch.id, row_number: p.row, ...p.item, status_item: 'success' })),
    ...errors.map((e) => ({ batch_id: batch.id, row_number: e.row, ...e.item, validation_errors: e.errors, status_item: 'failed' })),
  ];

  await supabase.from('asset_import_items').insert(items);

  return NextResponse.json({
    batch_id: batch.id,
    total_rows: previews.length + errors.length,
    success_count: previews.length,
    error_count: errors.length,
    previews: previews.slice(0, 10), // 처음 10줄만 반환
    errors: errors.slice(0, 10),
  });
}
```

### UI 컴포넌트 구조 (신규)

#### BulkImportWizard (3단계)

```typescript
// app/components/assets/BulkImportWizard.tsx

import { useState } from 'react';
import { Card, Button, Stepper, FileInput, Table, Alert } from '@/components/ui';

export function BulkImportWizard() {
  const [step, setStep] = useState(1); // 1: Upload, 2: Preview, 3: Confirm
  const [file, setFile] = useState<File | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    setLoading(true);
    const formData = new FormData();
    formData.append('file', file!);

    const response = await fetch('/api/assets/import/preview', {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();
    setBatchId(data.batch_id);
    setPreviewData(data);
    setStep(2);
    setLoading(false);
  };

  const handleExecute = async () => {
    setLoading(true);
    const response = await fetch('/api/assets/import/execute', {
      method: 'POST',
      body: JSON.stringify({ batch_id: batchId }),
    });

    if (response.ok) {
      setStep(3);
    }
    setLoading(false);
  };

  return (
    <Card>
      <Stepper current={step} steps={['Upload', 'Preview', 'Complete']} />
      
      {step === 1 && (
        <div className="space-y-4">
          <FileInput label="Excel File" onChange={(f) => setFile(f)} />
          <Button onClick={handleUpload} loading={loading} disabled={!file}>
            Upload & Preview
          </Button>
        </div>
      )}

      {step === 2 && previewData && (
        <div className="space-y-4">
          <Alert type={previewData.error_count > 0 ? 'warning' : 'success'}>
            {previewData.success_count} OK, {previewData.error_count} errors
          </Alert>
          <Table>
            {/* Preview rows */}
          </Table>
          {previewData.error_count > 0 && (
            <div className="text-red-600 text-sm">
              {/* Error details */}
            </div>
          )}
          <Button onClick={handleExecute} loading={loading}>
            Confirm Import
          </Button>
        </div>
      )}

      {step === 3 && (
        <Alert type="success">
          Import complete! {previewData?.success_count} assets created.
        </Alert>
      )}
    </Card>
  );
}
```

---

## ✅ 체크리스트 & 완료 기준

### API 구현 완료 기준

각 API 구현 시 다음을 확인하세요:

- [ ] **엔드포인트 정의** — 파일 경로, HTTP 메서드, URL 패턴 명확
- [ ] **파라미터 검증** — 필수/선택 파라미터 확인, 타입 검증
- [ ] **에러 처리** — 400/401/404/500 응답 정의
- [ ] **DB 쿼리** — Supabase RLS 정책 고려, 인덱스 활용
- [ ] **Audit 기록** — asset_audit에 변경사항 기록 (생성/수정/삭제)
- [ ] **TypeScript** — 모든 타입 정의, any 회피
- [ ] **테스트** — Postman 또는 curl로 실제 동작 확인
- [ ] **PR & 리뷰** — 평가자 승인 전 필수

### UI 구현 완료 기준

- [ ] **컴포넌트 정의** — 입력, 출력, 상태 명확
- [ ] **반응형 디자인** — 모바일 해상도 테스트
- [ ] **접근성** — WCAG AA 기준 준수 (색상 대비, 포커스)
- [ ] **성능** — 렌더링 1초 이내
- [ ] **테스트** — 브라우저에서 실제 동작 확인

---

## 🚨 주의사항 & 위험 요소

### 1️⃣ DB 마이그레이션 미완료
**위험도:** 🔴 Critical  
**완화책:**
- Day 1 아침 9시에 웹개발자가 마이그레이션 실행 확인
- 실패 시 즉시 DevOps에 보고

### 2️⃣ Excel 라이브러리 호환성
**위험도:** 🟡 Medium  
**완화책:**
- xlsx, exceljs, formidable 모두 package.json에 설치되어 있음
- 미설치 시: `npm install xlsx exceljs formidable`

### 3️⃣ 시간 부족 (5일)
**위험도:** 🟡 Medium  
**완화책:**
- 병렬 개발 (웹개발자 + 신규팀원)
- API 순서 엄격히 준수 (그룹 1 → 2 → 3 → 4)
- UI는 최소 버전으로 구현 (세련됨 X, 기능만 O)

### 4️⃣ 신규팀원 온보딩 곡선
**위험도:** 🟡 Medium  
**완화책:**
- 첫 2일은 API 작은 것부터 (locations, categories, audit-log)
- Day 3부터 UI 또는 mid-complexity API
- 슬랙 채널 (`#asset-development`) 24/7 오픈 (웹개발자가 버디)

---

## 📞 연락처 & 슬랙 채널

- **#asset-development** — 주요 개발 채널
- **@web-developer** — 멘토, 질문 시 태그
- **@evaluator** — QA 검증 요청

---

## 📚 참고 문서

1. **ASSET_MASTER_PHASE2_DESIGN.md** — 최종 설계 (DB 스키마, 범위)
2. **ASSET_MASTER_PHASE2_API_GUIDE.md** — API 상세 명세 (16개 모두)
3. **Active Work Tracking** — 실시간 진행 현황
4. **Phase 1 코드** — `app/api/assets/route.ts` 기존 구현 참고

---

## 🎯 당신의 첫 과제

### Day 1 (오늘, 2026-05-19)

```markdown
### ✅ 온보딩 체크리스트 (4시간)

1. 이 문서 정독 (1시간)
   - [ ] Phase 2 전체 스코프 이해
   - [ ] 16개 API 우선순위 숙지
   - [ ] 일정표 확인

2. Git & 환경 설정 (30분)
   - [ ] Git 클론 & feature/asset-phase2-api 브랜치 생성
   - [ ] .env.local 확인 (Supabase 키)
   - [ ] npm install 실행

3. 프로젝트 구조 파악 (1시간)
   - [ ] app/api/assets 폴더 탐색
   - [ ] 기존 Phase 1 API 코드 리뷰
   - [ ] Supabase 대시보드 접근 (조직, 테이블 확인)

4. 팀 커뮤니케이션 (30분)
   - [ ] #asset-development 채널 가입
   - [ ] 웹개발자에게 인사 메시지
   - [ ] 첫 과제 확인: API #3 (categories) 준비
```

**체크포인트:** 18:00 — 슬랙에 "온보딩 완료, 준비됨" 보고

### Day 2 (2026-05-20)

```markdown
### 목표: API #3, #4, #5 완료

**당신의 작업:**
1. API #3: GET /api/asset-categories (1시간)
   - Supabase categories 테이블 조회
   - 응답: [{ code, name_en, name_ta, display_order }, ...]

2. API #4: GET /api/assets/:id/audit-log (1.5시간)
   - asset_audit 테이블 필터링 (asset_id별)
   - 응답: [{ operation, changed_fields, created_by, created_at }, ...]

3. API #5: GET /api/assets/locations (1시간)
   - DISTINCT location from assets
   - 응답: ["EB YARD", "WAREHOUSE", ...]

**체크포인트:** 16:00 — 3개 API PR 오픈, 평가자 리뷰 요청
```

**Good luck! 🚀**

---

**최종 마감:** 2026-05-23 18:00 KST  
**담당자:** 당신 (신규팀원)  
**상태:** 🟢 Ready to Start
