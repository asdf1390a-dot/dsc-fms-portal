# Asset Master v2 구현 체크리스트

> **대상:** Web-Builder (웹개발자)  
> **설계 문서:** ASSET_MASTER_V2_DESIGN.md + ASSET_MASTER_V2_API_GUIDE.md  
> **예상 기간:** 7일 (2026-05-16 ~ 2026-05-23)  
> **DB 마이그레이션 파일:** `db/24_asset_master_v2.sql`

---

## 개요

이 체크리스트는 웹개발자가 Asset Master v2를 구현할 때 따라야 할 단계별 가이드입니다.

### 설계 선택 배경

- **Option A 선택:** 기존 506개 자산 유지 + 증분 기능 추가
- **API 축소:** Greenfield 40개 → 25개로 단축
- **목표:** 개발 기간 단축 (1주일), FK 체인 보존

### 핵심 제약

1. 기존 506개 자산 = 100% 유지
2. DB 테이블 스키마 변경 최소화
3. 기존 API/UI 호환성 유지
4. BM/PM/Disposal FK 체인 안전 보장

---

## Phase 1: 기초 준비 (1일)

### Step 1.1: DB 마이그레이션 파일 생성

**파일 위치:** `/home/jeepney/.openclaw/workspace-dev/dsc-fms-portal/db/24_asset_master_v2.sql`

**포함 항목:**

```sql
-- 1. 기존 assets 테이블 검증 (변경 없음)
-- 2. 신규 테이블: asset_qr_scans
-- 3. 신규 인덱스: qr_payload, asset_id
-- 4. RLS 정책 (기존 정책 유지)
```

**체크리스트:**
- [ ] asset_qr_scans 테이블 생성
  - id (uuid PK)
  - asset_id (uuid FK → assets.id)
  - qr_payload (text, not null)
  - scanned_at (timestamptz, default now())
  - scanned_by (uuid FK → auth.users.id)
  - device_info (text)
  - location_gps (text)
- [ ] 인덱스 추가
  - asset_id (조회 성능)
  - qr_payload (QR 스캔 조회)
- [ ] RLS 정책 활성화
  - authenticated 사용자 SELECT/INSERT 허용

### Step 1.2: Supabase 마이그레이션 실행

**명령:**
```bash
# Supabase CLI로 마이그레이션 실행
supabase db push

# 또는 수동으로:
# Supabase Dashboard → SQL Editor → 파일 내용 복사 → 실행
```

**검증:**
```sql
-- 마이그레이션 후 확인
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'asset_qr_scans';

-- 예상 결과: asset_qr_scans 테이블 존재
```

**체크리스트:**
- [ ] asset_qr_scans 테이블 생성됨
- [ ] 인덱스 2개 생성됨
- [ ] RLS 정책 활성화됨
- [ ] 기존 assets/categories/asset_classes 테이블 무손상 확인

### Step 1.3: TypeScript 타입 업데이트

**파일:** `/home/jeepney/.openclaw/workspace-dev/dsc-fms-portal/lib/assets/types.ts`

**추가 인터페이스:**

```typescript
// QR 스캔 로그
export interface AssetQRScan {
  id: string;
  asset_id: string;
  qr_payload: string;
  scanned_at: string;
  scanned_by?: string;
  device_info?: string;
  location_gps?: string;
}

// 대량 임포트 배치
export interface ImportBatch {
  batch_id: string;
  file_name: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  total_rows: number;
  inserted: number;
  updated: number;
  failed: number;
  created_at: string;
  created_by?: string;
}

// 임포트 검증 응답
export interface ImportValidationResult {
  file_name: string;
  total_rows: number;
  valid_rows: number;
  errors: Array<{
    row: number;
    field: string;
    value?: any;
    message: string;
  }>;
  preview: Partial<Asset>[];
  validation_summary: {
    ready_to_import: number;
    has_errors: number;
    duplicate_tags: number;
    invalid_class_codes: number;
  };
}

// 통계
export interface AssetStats {
  total_assets: number;
  by_status: Record<string, number>;
  by_category: Record<string, number>;
  last_updated: string;
}
```

**체크리스트:**
- [ ] AssetQRScan 인터페이스 추가
- [ ] ImportBatch 인터페이스 추가
- [ ] ImportValidationResult 인터페이스 추가
- [ ] AssetStats 인터페이스 추가
- [ ] 기존 Asset/CreateAssetRequest 타입 유지 (호환성)

### Step 1.4: 기존 기능 호환성 테스트

**테스트 대상:**

```
1. Supabase PostgREST API 동작 확인
   GET /rest/v1/assets → 200 OK (기존 506개 자산)

2. 기존 API 엔드포인트 확인
   - POST /api/assets → 새로운 자산 생성 가능
   - GET /api/assets/[id] → 기존 자산 조회 가능
   - PUT /api/assets/[id] → 기존 자산 수정 가능
   - DELETE /api/assets/[id] → 기존 자산 삭제 불가 (FK 제약)

3. asset_audit 트리거 확인
   - UPDATE assets → asset_audit에 기록됨
```

**테스트 명령:**
```bash
# 프론트엔드 빌드 테스트
npm run build

# 로컬 개발 서버 시작
npm run dev

# 기존 자산 목록 조회
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/assets?limit=5"

# 응답 확인: 기존 506개 자산 중 5개 반환되어야 함
```

**체크리스트:**
- [ ] npm run build 성공 (타입 에러 없음)
- [ ] npm run dev 실행 가능
- [ ] GET /api/assets → 200 OK (기존 자산 반환)
- [ ] asset_audit 테이블에 기록 남음

---

## Phase 2: 핵심 API 구현 (2일)

### Step 2.1: CRUD API 구현 (기존 코드 개선)

**파일 위치:**
- `/app/api/assets/route.ts` — POST, GET
- `/app/api/assets/[assetId]/route.ts` — GET, PUT, DELETE (신규 파일)

**Step 2.1.1: GET /api/assets (목록 + 필터 + 페이징)**

**요구사항:**
- 페이징 (page, limit)
- 필터 (category, status, location_like, make)
- 정렬 (sort)

**구현 단계:**
```typescript
// 1. 쿼리 매개변수 파싱
const page = parseInt(query.page || '1');
const limit = Math.min(parseInt(query.limit || '20'), 100); // 최대 100
const offset = (page - 1) * limit;

// 2. 필터 조건 구성
let filterQuery = supabase
  .from('assets')
  .select('*', { count: 'exact' });

if (query.category) filterQuery = filterQuery.eq('asset_class_code', `${query.category}%`);
if (query.status) filterQuery = filterQuery.eq('status', query.status);
if (query.location_like) filterQuery = filterQuery.ilike('location', `%${query.location_like}%`);
if (query.make) filterQuery = filterQuery.eq('make', query.make);

// 3. 정렬 + 페이징
const [field, direction] = (query.sort || 'created_at.desc').split('.');
filterQuery = filterQuery
  .order(field, { ascending: direction === 'asc' })
  .range(offset, offset + limit - 1);

// 4. 응답 형식
return Response.json({
  success: true,
  data: rows,
  pagination: { page, limit, total: count, pages: Math.ceil(count / limit) }
});
```

**테스트:**
```bash
curl "http://localhost:3000/api/assets?category=01&status=active&limit=10&page=1"
```

**체크리스트:**
- [ ] GET /api/assets 구현
- [ ] 페이징 동작 (page, limit, total, pages)
- [ ] 필터 동작 (category, status, location_like, make)
- [ ] 정렬 동작 (기본: updated_at.desc)
- [ ] 기존 자산 506개 조회 가능

---

**Step 2.1.2: GET /api/assets/[assetId] (상세 조회)**

**구현:**
```typescript
const { assetId } = params;

const { data, error } = await supabase
  .from('assets')
  .select('*')
  .eq('id', assetId)
  .single();

if (error || !data) {
  return Response.json({ success: false, error: { message: 'Asset not found' } }, { status: 404 });
}

return Response.json({ success: true, data });
```

**테스트:**
```bash
curl "http://localhost:3000/api/assets/550e8400-e29b-41d4-a716-446655440000"
```

**체크리스트:**
- [ ] GET /api/assets/[assetId] 구현
- [ ] 존재하는 자산 조회 가능
- [ ] 존재하지 않는 자산 → 404 반환

---

**Step 2.1.3: POST /api/assets (신규 생성)**

**기존 코드 유지, 필드 검증 강화:**

```typescript
// 필수 필드 검증
const required = ['asset_class_code', 'machine_asset_number', 'name_en', 'location', 'status'];
for (const field of required) {
  if (!payload[field]) {
    return Response.json(
      { success: false, error: { message: `${field} is required`, field } },
      { status: 400 }
    );
  }
}

// 중복 검사 (물리 태그)
const { data: existing } = await supabase
  .from('assets')
  .select('id')
  .eq('machine_asset_number', payload.machine_asset_number)
  .single();

if (existing) {
  return Response.json(
    { success: false, error: { message: 'Duplicate physical tag', field: 'machine_asset_number' } },
    { status: 409 }
  );
}

// asset_class_code 검증
const { data: assetClass } = await supabase
  .from('asset_classes')
  .select('code')
  .eq('code', payload.asset_class_code)
  .single();

if (!assetClass) {
  return Response.json(
    { success: false, error: { message: 'Asset class not found', field: 'asset_class_code' } },
    { status: 400 }
  );
}

// ... 기존 INSERT 로직
```

**테스트:**
```bash
curl -X POST http://localhost:3000/api/assets \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "asset_class_code": "01.001",
    "machine_asset_number": "DCMI-TEST-001",
    "name_en": "TEST ASSET",
    "location": "TEST LOCATION",
    "status": "active"
  }'
```

**체크리스트:**
- [ ] POST /api/assets 구현 (기존 코드 기반)
- [ ] 필수 필드 검증
- [ ] 중복 검사 (409 Conflict)
- [ ] asset_class_code 검증 (400 Bad Request)
- [ ] asset_audit 트리거로 자동 기록

---

**Step 2.1.4: PUT /api/assets/[assetId] (수정)**

**파일:** `/app/api/assets/[assetId]/route.ts` (신규)

```typescript
import { createClient } from '@supabase/supabase-js';

export async function PUT(request: Request, { params }: { params: { assetId: string } }) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return Response.json({ success: false, error: { message: 'Unauthorized' } }, { status: 401 });

    const payload = await request.json();

    // 부분 업데이트 검증
    const allowedFields = [
      'location', 'status', 'name_en', 'name_ta', 'model', 'make', 'year_of_manufacture', 'serial_no', 'remark', 'photos', 'extra'
    ];

    const updateData: any = {};
    for (const field of allowedFields) {
      if (field in payload) {
        updateData[field] = payload[field];
      }
    }

    // status 검증
    if (updateData.status && !['active', 'idle', 'maintenance', 'sold', 'scrapped'].includes(updateData.status)) {
      return Response.json(
        { success: false, error: { message: 'Invalid status', field: 'status' } },
        { status: 400 }
      );
    }

    // 사용자 정보 추가
    const userClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${token}` } }
      }
    );
    const { data: { user } } = await userClient.auth.getUser();
    updateData.updated_by = user?.id;

    // UPDATE 실행
    const { data, error } = await supabase
      .from('assets')
      .update(updateData)
      .eq('id', params.assetId)
      .select()
      .single();

    if (error || !data) {
      return Response.json(
        { success: false, error: { message: 'Asset not found' } },
        { status: 404 }
      );
    }

    return Response.json({ success: true, data });
  } catch (error) {
    return Response.json(
      { success: false, error: { message: error instanceof Error ? error.message : 'Internal server error' } },
      { status: 500 }
    );
  }
}
```

**테스트:**
```bash
curl -X PUT http://localhost:3000/api/assets/550e8400-e29b-41d4-a716-446655440000 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{ "status": "maintenance", "location": "WORKSHOP" }'
```

**체크리스트:**
- [ ] PUT /api/assets/[assetId] 구현
- [ ] 부분 업데이트 지원 (선택된 필드만)
- [ ] status 값 검증
- [ ] updated_by 자동 설정
- [ ] asset_audit 트리거로 기록

---

**Step 2.1.5: DELETE /api/assets/[assetId] (삭제)**

**파일:** `/app/api/assets/[assetId]/route.ts` (PUT과 동일 파일)

```typescript
export async function DELETE(request: Request, { params }: { params: { assetId: string } }) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return Response.json({ success: false, error: { message: 'Unauthorized' } }, { status: 401 });

    // FK 체크 (BM, PM, Disposal)
    const [
      { data: bmRecords },
      { data: pmRecords },
      { data: disposalRecords }
    ] = await Promise.all([
      supabase.from('bm_history').select('id').eq('asset_id', params.assetId).limit(1),
      supabase.from('pm_schedule').select('id').eq('asset_id', params.assetId).limit(1),
      supabase.from('asset_disposal').select('id').eq('asset_id', params.assetId).limit(1)
    ]);

    if (bmRecords?.length || pmRecords?.length || disposalRecords?.length) {
      return Response.json(
        {
          success: false,
          error: {
            message: 'Cannot delete asset with related BM/PM records',
            code: 'FK_CONSTRAINT_VIOLATION',
            related_tables: [
              ...(bmRecords?.length ? ['bm_history'] : []),
              ...(pmRecords?.length ? ['pm_schedule'] : []),
              ...(disposalRecords?.length ? ['asset_disposal'] : [])
            ],
            suggestion: "Change status to 'scrapped' instead"
          }
        },
        { status: 409 }
      );
    }

    // DELETE 실행
    const { error } = await supabase
      .from('assets')
      .delete()
      .eq('id', params.assetId);

    if (error) {
      return Response.json({ success: false, error: { message: error.message } }, { status: 500 });
    }

    return Response.json({ success: true, message: 'Asset deleted' });
  } catch (error) {
    return Response.json(
      { success: false, error: { message: error instanceof Error ? error.message : 'Internal server error' } },
      { status: 500 }
    );
  }
}
```

**테스트:**
```bash
# 관련 기록이 있는 자산 (기존 자산) 삭제 시도
curl -X DELETE http://localhost:3000/api/assets/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer $TOKEN"

# 응답: 409 Conflict + "Cannot delete"
```

**체크리스트:**
- [ ] DELETE /api/assets/[assetId] 구현
- [ ] FK 체크 (BM, PM, Disposal)
- [ ] 관련 기록이 있으면 409 Conflict 반환
- [ ] 대안 제시 ("status를 'scrapped'로 변경하세요")

---

### Step 2.2: 검색 & 필터 API 구현

**Step 2.2.1: GET /api/assets/search (텍스트 검색)**

**파일:** `/app/api/assets/search/route.ts` (신규)

```typescript
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');
    const limit = parseInt(searchParams.get('limit') || '20');

    if (!q || q.length < 2) {
      return Response.json(
        { success: false, error: { message: 'Search term must be at least 2 characters' } },
        { status: 400 }
      );
    }

    // PostgreSQL FTS (Full Text Search)
    const { data, error } = await supabase
      .from('assets')
      .select('*')
      .or(
        `name_en.ilike.%${q}%,name_ta.ilike.%${q}%,make.ilike.%${q}%,model.ilike.%${q}%,machine_asset_number.ilike.%${q}%`
      )
      .limit(limit);

    if (error) {
      return Response.json({ success: false, error: { message: error.message } }, { status: 500 });
    }

    return Response.json({
      success: true,
      data,
      pagination: { total: data.length, limit }
    });
  } catch (error) {
    return Response.json(
      { success: false, error: { message: error instanceof Error ? error.message : 'Internal server error' } },
      { status: 500 }
    );
  }
}
```

**테스트:**
```bash
curl "http://localhost:3000/api/assets/search?q=compressor&limit=20"
```

**체크리스트:**
- [ ] GET /api/assets/search 구현
- [ ] 최소 2자 검증
- [ ] 여러 필드 검색 (name_en, make, model 등)
- [ ] 한계값 (limit) 처리

---

**Step 2.2.2: GET /api/assets/categories (필터용 카테고리 목록)**

**파일:** `/app/api/assets/categories/route.ts` (신규)

```typescript
export async function GET(request: Request) {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) {
      return Response.json({ success: false, error: { message: error.message } }, { status: 500 });
    }

    return Response.json({ success: true, data });
  } catch (error) {
    return Response.json(
      { success: false, error: { message: error instanceof Error ? error.message : 'Internal server error' } },
      { status: 500 }
    );
  }
}
```

**체크리스트:**
- [ ] GET /api/assets/categories 구현
- [ ] 15개 카테고리 반환 (display_order로 정렬)

---

**Step 2.2.3: GET /api/assets/classes (필터용 분류 목록)**

**파일:** `/app/api/assets/classes/route.ts` (신규)

```typescript
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    let query = supabase
      .from('asset_classes')
      .select('*');

    if (category) {
      query = query.eq('category_code', category);
    }

    const { data, error } = await query.order('code', { ascending: true });

    if (error) {
      return Response.json({ success: false, error: { message: error.message } }, { status: 500 });
    }

    return Response.json({ success: true, data });
  } catch (error) {
    return Response.json(
      { success: false, error: { message: error instanceof Error ? error.message : 'Internal server error' } },
      { status: 500 }
    );
  }
}
```

**체크리스트:**
- [ ] GET /api/assets/classes 구현
- [ ] 선택적 카테고리 필터 지원
- [ ] ~120개 분류 반환

---

### Step 2.3: 통계 API 구현

**Step 2.3.1: GET /api/assets/stats/summary (요약)**

**파일:** `/app/api/assets/stats/summary/route.ts` (신규)

```typescript
export async function GET(request: Request) {
  try {
    // 상태별 집계
    const { data: statusData } = await supabase
      .from('assets')
      .select('status')
      .then(({ data }) => ({
        data: data.reduce((acc, row) => {
          acc[row.status] = (acc[row.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      }));

    // 카테고리별 집계
    const { data: assets } = await supabase
      .from('assets')
      .select('asset_class_code')
      .then(({ data }) => {
        const categories: Record<string, number> = {};
        data.forEach(row => {
          const catCode = row.asset_class_code.split('.')[0];
          categories[catCode] = (categories[catCode] || 0) + 1;
        });
        return { data: categories };
      });

    return Response.json({
      success: true,
      data: {
        total_assets: Object.values(statusData).reduce((a, b) => a + b, 0),
        by_status: statusData,
        by_category: assets,
        last_updated: new Date().toISOString()
      }
    });
  } catch (error) {
    return Response.json(
      { success: false, error: { message: error instanceof Error ? error.message : 'Internal server error' } },
      { status: 500 }
    );
  }
}
```

**체크리스트:**
- [ ] GET /api/assets/stats/summary 구현
- [ ] total_assets = 506 반환
- [ ] by_status 집계 (active, idle, maintenance, sold, scrapped)
- [ ] by_category 집계 (01~15)

---

**Step 2.3.2: GET /api/assets/stats/by-category (카테고리별)**

**파일:** `/app/api/assets/stats/by-category/route.ts` (신규)

```typescript
export async function GET(request: Request) {
  try {
    // 카테고리별 자산 통계
    const { data: categories } = await supabase
      .from('categories')
      .select('code, name_en');

    const stats = await Promise.all(
      categories.map(async (cat) => {
        const { data: assets } = await supabase
          .from('assets')
          .select('status')
          .like('asset_class_code', `${cat.code}%`);

        const statusCount = assets.reduce((acc, row) => {
          acc[row.status] = (acc[row.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        return {
          category_code: cat.code,
          category_name: cat.name_en,
          total: assets.length,
          active: statusCount['active'] || 0,
          idle: statusCount['idle'] || 0,
          maintenance: statusCount['maintenance'] || 0,
          sold: statusCount['sold'] || 0,
          scrapped: statusCount['scrapped'] || 0
        };
      })
    );

    return Response.json({ success: true, data: stats });
  } catch (error) {
    return Response.json(
      { success: false, error: { message: error instanceof Error ? error.message : 'Internal server error' } },
      { status: 500 }
    );
  }
}
```

**체크리스트:**
- [ ] GET /api/assets/stats/by-category 구현
- [ ] 카테고리별 상태 분류

---

**Step 2.3.3: GET /api/assets/stats/by-status & GET /api/assets/stats/by-location**

**체크리스트:**
- [ ] GET /api/assets/stats/by-status 구현
- [ ] GET /api/assets/stats/by-location 구현

---

### Step 2.4: 이력 API 구현

**Step 2.4.1: GET /api/assets/[assetId]/audit (타임라인)**

**파일:** `/app/api/assets/[assetId]/audit/route.ts` (신규)

```typescript
export async function GET(request: Request, { params }: { params: { assetId: string } }) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const action = searchParams.get('action');

    let query = supabase
      .from('asset_audit')
      .select('*')
      .eq('asset_id', params.assetId);

    if (action) {
      query = query.eq('action', action);
    }

    const { data, error, count } = await query
      .order('changed_at', { ascending: false })
      .limit(limit);

    if (error) {
      return Response.json({ success: false, error: { message: error.message } }, { status: 500 });
    }

    return Response.json({
      success: true,
      data,
      pagination: { total: count || 0, limit }
    });
  } catch (error) {
    return Response.json(
      { success: false, error: { message: error instanceof Error ? error.message : 'Internal server error' } },
      { status: 500 }
    );
  }
}
```

**체크리스트:**
- [ ] GET /api/assets/[assetId]/audit 구현
- [ ] 시간순 정렬 (최신 먼저)
- [ ] 선택적 action 필터

---

**체크리스트 (Phase 2 완료 조건):**
- [ ] CRUD API 5개 모두 동작
  - [ ] GET /api/assets (목록)
  - [ ] GET /api/assets/[id] (상세)
  - [ ] POST /api/assets (생성)
  - [ ] PUT /api/assets/[id] (수정)
  - [ ] DELETE /api/assets/[id] (삭제)
- [ ] 검색/필터 API 3개 동작
  - [ ] GET /api/assets/search
  - [ ] GET /api/assets/categories
  - [ ] GET /api/assets/classes
- [ ] 통계 API 4개 동작
  - [ ] GET /api/assets/stats/summary
  - [ ] GET /api/assets/stats/by-category
  - [ ] GET /api/assets/stats/by-status
  - [ ] GET /api/assets/stats/by-location
- [ ] 이력 API 1개 동작
  - [ ] GET /api/assets/[id]/audit

---

## Phase 3: QR & 임포트 API 구현 (2일)

### Step 3.1: QR 관련 API 구현

**Step 3.1.1: GET /api/assets/qr/[qrPayload] (스캔 조회)**

**파일:** `/app/api/assets/qr/[qrPayload]/route.ts` (신규)

```typescript
export async function GET(request: Request, { params }: { params: { qrPayload: string } }) {
  try {
    const { data, error } = await supabase
      .from('assets')
      .select('*')
      .eq('qr_payload', params.qrPayload)
      .single();

    if (error || !data) {
      return Response.json(
        { success: false, error: { message: 'Asset not found with this QR code' } },
        { status: 404 }
      );
    }

    return Response.json({ success: true, data });
  } catch (error) {
    return Response.json(
      { success: false, error: { message: error instanceof Error ? error.message : 'Internal server error' } },
      { status: 500 }
    );
  }
}
```

**체크리스트:**
- [ ] GET /api/assets/qr/[qrPayload] 구현
- [ ] QR 페이로드로 자산 조회 가능

---

**Step 3.1.2: PUT /api/assets/[assetId]/qr (재생성)**

**파일:** `/app/api/assets/[assetId]/qr/route.ts` (신규)

```typescript
export async function PUT(request: Request, { params }: { params: { assetId: string } }) {
  try {
    const payload = await request.json();
    const { mode, qr_payload } = payload;

    let newPayload = qr_payload;

    // mode='auto'이면 기본값 사용
    if (mode === 'auto') {
      const { data: asset } = await supabase
        .from('assets')
        .select('machine_asset_number')
        .eq('id', params.assetId)
        .single();

      if (!asset) {
        return Response.json(
          { success: false, error: { message: 'Asset not found' } },
          { status: 404 }
        );
      }

      newPayload = asset.machine_asset_number;
    }

    // 업데이트
    const { data, error } = await supabase
      .from('assets')
      .update({ qr_payload: newPayload })
      .eq('id', params.assetId)
      .select()
      .single();

    if (error || !data) {
      return Response.json(
        { success: false, error: { message: error?.message || 'Update failed' } },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      data: {
        id: data.id,
        qr_payload: data.qr_payload,
        updated_at: data.updated_at
      }
    });
  } catch (error) {
    return Response.json(
      { success: false, error: { message: error instanceof Error ? error.message : 'Internal server error' } },
      { status: 500 }
    );
  }
}
```

**체크리스트:**
- [ ] PUT /api/assets/[assetId]/qr 구현
- [ ] mode='auto' 지원 (기본값)
- [ ] 커스텀 qr_payload 지원

---

**Step 3.1.3: GET /api/assets/[assetId]/qr/generate (이미지 생성)**

**파일:** `/app/api/assets/[assetId]/qr/generate/route.ts` (신규)

**라이브러리:** `qrcode` npm 패키지

```bash
npm install qrcode
```

**구현:**
```typescript
import QRCode from 'qrcode';

export async function GET(request: Request, { params }: { params: { assetId: string } }) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'png';
    const size = parseInt(searchParams.get('size') || '200');

    // 자산 조회
    const { data: asset, error } = await supabase
      .from('assets')
      .select('qr_payload, machine_asset_number, name_en')
      .eq('id', params.assetId)
      .single();

    if (error || !asset) {
      return Response.json(
        { success: false, error: { message: 'Asset not found' } },
        { status: 404 }
      );
    }

    // QR 코드 생성
    const qrPayload = asset.qr_payload || asset.machine_asset_number;

    if (format === 'png') {
      const pngBuffer = await QRCode.toBuffer(qrPayload, { width: size });
      return new Response(pngBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
          'Content-Disposition': `attachment; filename="qr_${asset.machine_asset_number}.png"`
        }
      });
    } else if (format === 'svg') {
      const svgString = await QRCode.toString(qrPayload, { type: 'image/svg+xml', width: size });
      return new Response(svgString, {
        status: 200,
        headers: {
          'Content-Type': 'image/svg+xml',
          'Content-Disposition': `attachment; filename="qr_${asset.machine_asset_number}.svg"`
        }
      });
    }

    return Response.json(
      { success: false, error: { message: 'Invalid format' } },
      { status: 400 }
    );
  } catch (error) {
    return Response.json(
      { success: false, error: { message: error instanceof Error ? error.message : 'Internal server error' } },
      { status: 500 }
    );
  }
}
```

**테스트:**
```bash
curl "http://localhost:3000/api/assets/550e8400-e29b-41d4-a716-446655440000/qr/generate?format=png&size=300" \
  -o qr.png
```

**체크리스트:**
- [ ] GET /api/assets/[assetId]/qr/generate 구현
- [ ] PNG 포맷 지원
- [ ] SVG 포맷 지원 (선택)
- [ ] 크기 조정 가능

---

### Step 3.2: QR 스캔 로그 API 구현

**Step 3.2.1: POST /api/assets/[assetId]/qr/scan (기록)**

**파일:** `/app/api/assets/[assetId]/qr/scan/route.ts` (신규)

```typescript
export async function POST(request: Request, { params }: { params: { assetId: string } }) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return Response.json({ success: false, error: { message: 'Unauthorized' } }, { status: 401 });
    }

    const payload = await request.json();

    // 사용자 정보
    const userClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${token}` } }
      }
    );
    const { data: { user } } = await userClient.auth.getUser();

    // 스캔 로그 INSERT
    const { data, error } = await supabase
      .from('asset_qr_scans')
      .insert({
        asset_id: params.assetId,
        qr_payload: payload.qr_payload,
        device_info: payload.device_info,
        location_gps: payload.location_gps,
        scanned_by: user?.id
      })
      .select()
      .single();

    if (error) {
      return Response.json(
        { success: false, error: { message: error.message } },
        { status: 500 }
      );
    }

    return Response.json({ success: true, data }, { status: 201 });
  } catch (error) {
    return Response.json(
      { success: false, error: { message: error instanceof Error ? error.message : 'Internal server error' } },
      { status: 500 }
    );
  }
}
```

**체크리스트:**
- [ ] POST /api/assets/[assetId]/qr/scan 구현
- [ ] 인증 체크 (Bearer token)
- [ ] asset_qr_scans 테이블에 기록

---

**Step 3.2.2: GET /api/assets/[assetId]/qr/scans (조회)**

**파일:** `/app/api/assets/[assetId]/qr/scans/route.ts` (신규)

```typescript
export async function GET(request: Request, { params }: { params: { assetId: string } }) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');

    const { data, error, count } = await supabase
      .from('asset_qr_scans')
      .select('*')
      .eq('asset_id', params.assetId)
      .order('scanned_at', { ascending: false })
      .limit(limit);

    if (error) {
      return Response.json(
        { success: false, error: { message: error.message } },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      data,
      pagination: { total: count || 0, limit }
    });
  } catch (error) {
    return Response.json(
      { success: false, error: { message: error instanceof Error ? error.message : 'Internal server error' } },
      { status: 500 }
    );
  }
}
```

**체크리스트:**
- [ ] GET /api/assets/[assetId]/qr/scans 구현
- [ ] 시간순 정렬 (최신 먼저)

---

### Step 3.3: 대량 임포트 API 구현

**Step 3.3.1: POST /api/assets/import/validate (검증)**

**파일:** `/app/api/assets/import/validate/route.ts` (신규)

**라이브러리:** `xlsx` npm 패키지

```bash
npm install xlsx
```

**구현:**
```typescript
import { read, utils } from 'xlsx';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return Response.json(
        { success: false, error: { message: 'File is required' } },
        { status: 400 }
      );
    }

    // 파일 읽기
    const buffer = await file.arrayBuffer();
    const workbook = read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const rows = utils.sheet_to_json(workbook.Sheets[sheetName]);

    const errors: any[] = [];
    const validRows: any[] = [];

    // 검증
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowIndex = i + 2; // 헤더 포함

      // 필수 필드 확인
      if (!row['machine_asset_number'] || !row['name_en'] || !row['asset_class_code']) {
        errors.push({
          row: rowIndex,
          field: 'required_fields',
          message: 'Missing required fields (machine_asset_number, name_en, asset_class_code)'
        });
        continue;
      }

      // 중복 체크 (DB)
      const { data: existing } = await supabase
        .from('assets')
        .select('id')
        .eq('machine_asset_number', row['machine_asset_number'])
        .single();

      if (existing) {
        errors.push({
          row: rowIndex,
          field: 'machine_asset_number',
          value: row['machine_asset_number'],
          message: 'Duplicate asset (existing in DB)'
        });
        continue;
      }

      // 분류 존재 확인
      const { data: assetClass } = await supabase
        .from('asset_classes')
        .select('code')
        .eq('code', row['asset_class_code'])
        .single();

      if (!assetClass) {
        errors.push({
          row: rowIndex,
          field: 'asset_class_code',
          value: row['asset_class_code'],
          message: 'Asset class not found'
        });
        continue;
      }

      validRows.push(row);
    }

    return Response.json({
      success: true,
      data: {
        file_name: file.name,
        total_rows: rows.length,
        valid_rows: validRows.length,
        errors,
        preview: validRows.slice(0, 5),
        validation_summary: {
          ready_to_import: validRows.length,
          has_errors: errors.length,
          duplicate_tags: errors.filter(e => e.field === 'machine_asset_number').length,
          invalid_class_codes: errors.filter(e => e.field === 'asset_class_code').length
        }
      }
    });
  } catch (error) {
    return Response.json(
      { success: false, error: { message: error instanceof Error ? error.message : 'Internal server error' } },
      { status: 500 }
    );
  }
}
```

**체크리스트:**
- [ ] POST /api/assets/import/validate 구현
- [ ] xlsx 파일 파싱
- [ ] 필수 필드 검증
- [ ] 중복 체크 (DB)
- [ ] 분류 존재 확인

---

**Step 3.3.2: POST /api/assets/import/execute (실행)**

**파일:** `/app/api/assets/import/execute/route.ts` (신규)

```typescript
export async function POST(request: Request) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return Response.json({ success: false, error: { message: 'Unauthorized' } }, { status: 401 });
    }

    const payload = await request.json();
    const { rows, duplicate_handling } = payload;

    // 사용자 정보
    const userClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${token}` } }
      }
    );
    const { data: { user } } = await userClient.auth.getUser();

    // Batch ID 생성
    const batchId = `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // 배치 로그 저장 (선택)
    // ... 필요시 import_batches 테이블 생성

    // 트랜잭션으로 INSERT
    const insertData = rows.map((row: any) => ({
      asset_class_code: row['asset_class_code'],
      machine_asset_number: row['machine_asset_number'],
      name_en: row['name_en'],
      serial_no: row['serial_no'] || null,
      name_ta: row['name_ta'] || null,
      model: row['model'] || null,
      make: row['make'] || null,
      year_of_manufacture: row['year_of_manufacture'] ? parseInt(row['year_of_manufacture']) : null,
      location: row['location'] || '',
      status: row['status'] || 'active',
      remark: row['remark'] || null,
      extra: {
        import_source: 'bulk_import',
        batch_id: batchId
      },
      created_by: user?.id
    }));

    const { data, error } = await supabase
      .from('assets')
      .insert(insertData)
      .select();

    if (error) {
      return Response.json(
        { success: false, error: { message: error.message } },
        { status: 500 }
      );
    }

    return Response.json(
      {
        success: true,
        data: {
          batch_id: batchId,
          total_rows: insertData.length,
          inserted: data.length,
          status: 'completed',
          created_at: new Date().toISOString()
        }
      },
      { status: 202 }
    );
  } catch (error) {
    return Response.json(
      { success: false, error: { message: error instanceof Error ? error.message : 'Internal server error' } },
      { status: 500 }
    );
  }
}
```

**체크리스트:**
- [ ] POST /api/assets/import/execute 구현
- [ ] 트랜잭션 처리 (모두 성공 또는 모두 실패)
- [ ] batch_id 저장
- [ ] extra.import_source = 'bulk_import' 설정

---

**Step 3.3.3: GET /api/assets/import/history (임포트 이력)**

**파일:** `/app/api/assets/import/history/route.ts` (신규)

```typescript
export async function GET(request: Request) {
  try {
    // extra.batch_id를 가진 자산들 조회
    const { data, error } = await supabase
      .from('assets')
      .select('id, extra, created_at, created_by')
      .not('extra->batch_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      return Response.json(
        { success: false, error: { message: error.message } },
        { status: 500 }
      );
    }

    // 배치별 집계
    const batches: Record<string, any> = {};
    data.forEach(asset => {
      const batchId = asset.extra.batch_id;
      if (!batches[batchId]) {
        batches[batchId] = {
          batch_id: batchId,
          total: 0,
          created_at: asset.created_at,
          created_by: asset.created_by
        };
      }
      batches[batchId].total++;
    });

    return Response.json({
      success: true,
      data: Object.values(batches).slice(0, 10),
      pagination: { total: Object.keys(batches).length }
    });
  } catch (error) {
    return Response.json(
      { success: false, error: { message: error instanceof Error ? error.message : 'Internal server error' } },
      { status: 500 }
    );
  }
}
```

**체크리스트:**
- [ ] GET /api/assets/import/history 구현
- [ ] 최근 임포트 10건 조회

---

### Step 3.4: 내보내기 API (기존 코드 유지)

**파일:** `/app/api/assets/export/excel/route.ts`, `/app/api/assets/export/csv/route.ts`

**체크리스트:**
- [ ] 기존 Excel 내보내기 동작 확인
- [ ] 기존 CSV 내보내기 동작 확인

---

**체크리스트 (Phase 3 완료 조건):**
- [ ] QR API 3개 동작
  - [ ] GET /api/assets/qr/[qrPayload]
  - [ ] PUT /api/assets/[assetId]/qr
  - [ ] GET /api/assets/[assetId]/qr/generate
- [ ] QR 스캔 로그 2개 동작
  - [ ] POST /api/assets/[assetId]/qr/scan
  - [ ] GET /api/assets/[assetId]/qr/scans
- [ ] 대량 임포트 API 3개 동작
  - [ ] POST /api/assets/import/validate
  - [ ] POST /api/assets/import/execute
  - [ ] GET /api/assets/import/history
- [ ] 내보내기 2개 동작 (기존)
  - [ ] GET /api/assets/export/excel
  - [ ] GET /api/assets/export/csv

---

## Phase 4: UI 구현 (1.5일)

### Step 4.1: 자산 목록 페이지 개선

**파일:** `/app/assets/page.tsx`

**개선 사항:**
- [ ] 필터 UI 추가 (카테고리, 상태, 위치)
- [ ] 페이징 버튼 추가
- [ ] [임포트] 버튼 추가
- [ ] 정렬 옵션 추가

---

### Step 4.2: 자산 상세 페이지 (탭)

**파일:** `/app/assets/[assetId]/page.tsx`

**탭 구조:**
- [ ] 탭 1: 개요 (기본 정보)
- [ ] 탭 2: 이력 (asset_audit)
- [ ] 탭 3: 사진 (photos 배열)

**기능:**
- [ ] QR 코드 이미지 표시
- [ ] [수정], [폐기], [더보기] 버튼

---

### Step 4.3: 신규/편집 폼

**파일:** `/app/assets/new/page.tsx`, `/app/assets/[assetId]/edit/page.tsx`

**폼 필드:**
- [ ] 카테고리 (드롭다운)
- [ ] 분류 (드롭다운, 카테고리 의존)
- [ ] 물리 태그 (텍스트)
- [ ] 자산명 (텍스트)
- [ ] 제조사, 모델, 제조년도
- [ ] 위치, 상태
- [ ] 비고

---

### Step 4.4: 대량 임포트 모달

**파일:** `/app/assets/import/page.tsx` (또는 모달)

**단계:**
1. 파일 선택
2. 검증 결과 표시
3. 임포트 실행
4. 진행률 표시

---

**체크리스트 (Phase 4 완료 조건):**
- [ ] 목록 페이지 필터/페이징 동작
- [ ] 상세 페이지 탭 3개 동작
- [ ] 신규 폼 검증 동작
- [ ] 편집 폼 초기값 로드
- [ ] 임포트 모달 검증/실행 동작

---

## Phase 5: 테스트 & 배포 (0.5일)

### Step 5.1: E2E 테스트

**테스트 케이스:**

1. **목록 조회**
   - [ ] 페이지 로드 시 첫 20개 자산 표시
   - [ ] 페이지 2로 이동 → 다음 20개 표시
   - [ ] 필터 (카테고리='01') → 해당 자산만 표시
   - [ ] 정렬 변경 (updated_at.asc) → 순서 변경

2. **상세 조회**
   - [ ] 자산 클릭 → 상세 페이지로 이동
   - [ ] 탭 1 (개요) → 기본 정보 표시
   - [ ] 탭 2 (이력) → 변경 기록 표시
   - [ ] QR 코드 이미지 표시

3. **신규 생성**
   - [ ] 폼 입력 → 저장
   - [ ] 새로운 자산이 목록에 나타남
   - [ ] asset_audit에 'insert' 기록됨

4. **수정**
   - [ ] 자산 편집 → 저장
   - [ ] 목록에서 변경사항 확인
   - [ ] asset_audit에 'update' 기록됨

5. **QR 스캔**
   - [ ] QR 페이로드로 조회 → 자산 상세 반환
   - [ ] QR 코드 이미지 생성 → PNG 다운로드

6. **대량 임포트**
   - [ ] Excel 파일 업로드 → 검증
   - [ ] 5개 행 임포트 → 모두 성공
   - [ ] 목록에 새로운 자산 5개 나타남

---

### Step 5.2: 모바일 반응형 테스트

**테스트 기기:**
- [ ] iPhone 12 (375px)
- [ ] iPad Air (768px)
- [ ] Galaxy S21 (360px)

**테스트 항목:**
- [ ] 목록 페이지 단일 컬럼
- [ ] 필터 모달/드로어 열기/닫기
- [ ] 탭 스와이프 (선택)
- [ ] 터치 조작 (버튼, 입력)

---

### Step 5.3: 성능 테스트

**목표:**
- [ ] 목록 로드 < 1초 (500개 자산, 20개/페이지)
- [ ] 검색 < 500ms
- [ ] 통계 < 1초

**도구:**
```bash
# Lighthouse
npm run build
npm run start
# 브라우저에서 DevTools → Lighthouse → Performance 측정

# cURL로 API 응답 시간 측정
time curl "http://localhost:3000/api/assets?limit=20"
```

---

### Step 5.4: 본배포

**Vercel 배포:**
```bash
git add .
git commit -m "feat: Asset Master v2 implementation"
git push origin master

# Vercel에서 자동 배포
# https://dsc-fms-portal.vercel.app
```

**배포 후 확인:**
- [ ] 프로덕션 모든 API 동작
- [ ] DB 마이그레이션 적용됨 (asset_qr_scans 테이블)
- [ ] RLS 정책 활성화됨
- [ ] 모니터링 (Vercel Analytics, Supabase Logs)

---

## 최종 체크리스트

### 데이터 무결성

- [ ] 기존 506개 자산 모두 보존됨
- [ ] asset_classes 테이블 무손상
- [ ] categories 테이블 무손상
- [ ] BM/PM/Disposal FK 체인 안전

### API 호환성

- [ ] 기존 API (CRUD) 동작
- [ ] 신규 API 25개 모두 구현
- [ ] 오류 응답 형식 통일

### UI/UX

- [ ] 목록 페이지 필터/페이징 동작
- [ ] 상세 페이지 탭 3개 동작
- [ ] 신규/편집 폼 검증
- [ ] 모바일 반응형 (320px~)

### 문서

- [ ] ASSET_MASTER_V2_DESIGN.md 완성
- [ ] ASSET_MASTER_V2_API_GUIDE.md 완성
- [ ] 이 체크리스트 완성

### 배포

- [ ] git commit 해시 기록
- [ ] Vercel 프로덕션 배포 완료
- [ ] 사용자에게 안내

---

## 예상 일정

| Phase | 항목 | 예상일 | 상태 |
|-------|------|--------|------|
| 1 | 기초 (DB, 타입, 호환성) | 2026-05-16 | 대기 |
| 2 | CRUD, 검색, 통계, 이력 | 2026-05-17~18 | 대기 |
| 3 | QR, 임포트, 스캔 로그 | 2026-05-19~20 | 대기 |
| 4 | UI (목록, 상세, 폼, 임포트) | 2026-05-21~22 | 대기 |
| 5 | 테스트, 배포 | 2026-05-23 | 대기 |

**전체 기간:** 7일 (2026-05-16 ~ 2026-05-23)

---

**최종 산출물:**
1. DB 마이그레이션 (db/24_asset_master_v2.sql)
2. API 25개 (TypeScript + Next.js API Routes)
3. UI 5개 페이지 (React + Next.js App Router)
4. 테스트 완료 (E2E, 모바일, 성능)
5. 프로덕션 배포 (Vercel)

---

**작성자:** Planner (Web App Designer)  
**대상:** Web-Builder (웹개발자)  
**검토 대기:** Evaluator (평가자)  
**완료 예정:** 2026-05-23
