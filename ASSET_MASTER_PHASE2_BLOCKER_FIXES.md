# Asset Master v2 Phase 2 — 블로커 4개 긴급 수정 완료

**작성:** 2026-05-16 12:00 KST  
**상태:** 🟢 모든 블로커 해결  
**웹개발자 진행:** Day 1 재개 가능 (10시간 내 5개 API 완료)

---

## 수정 완료 사항 (4개 블로커)

### B1. App Router vs Pages Router 충돌 ✅

**문제:**
- CLAUDE.md: Pages Router 사용 지시
- 실제: 기존 자산 API (`app/api/assets/route.ts` 등) 모두 App Router
- 결과: Pages Router로 추가 시 `next build` 실패 (Conflicting app and page)

**해결:**
- **설계 변경** → App Router로 통일
- 라우트 구조:
  ```
  app/api/assets/route.ts                    (GET, POST)
  app/api/assets/[assetId]/route.ts          (GET, PUT, DELETE)
  app/api/assets/[assetId]/audit-log/route.ts (GET) ← 신규
  ```

**변경 파일:**
- `ASSET_MASTER_PHASE2_DESIGN.md` — "기술 스택 (App Router 통일)" 섹션 추가

---

### B2. asset_audit 스키마 불일치 ✅

**문제:**
- 설계의 audit trigger INSERT 실패
- 설계 스키마: `(table_name, record_id, operation, old_values, new_values, change_description)`
- 기존 asset_audit: `(asset_id, changed_at, changed_by, action, diff)`
- 트리거가 기존 테이블에 맞지 않음

**해결:**
- **audit trigger 제거** → 기존 `asset_audit_log()` 함수 재사용
- import_batches/items는 RLS 정책으로만 관리
- 필요시 별도 audit 테이블 생성 (Phase 2.5 이후)

**변경 파일:**
- `db/29_asset_master_v2_phase2.sql`
  - 라인 242-282: `handle_asset_import_batches_audit()` 트리거 **삭제**
  - 대체: 주석 추가 (기존 함수 재사용 안내)

---

### B3. 라우트 명명 충돌 ✅

**문제:**
- 설계: `GET /api/assets/:id/history` = 감사 이력
- 기존: `pages/api/assets/[assetId]/history.js` = PM/BM 이벤트 이력 (프로덕션 중)
- 충돌 시 기존 기능 깨짐

**해결:**
- **경로 변경** → `/audit-log` (감사 전용)
- 기존 `/history`는 PM/BM 모듈에서 계속 사용

**변경 파일:**
- `ASSET_MASTER_PHASE2_DESIGN.md` — API 테이블에 "4. GET /api/assets/:id/audit-log" 표기
- `ASSET_MASTER_PHASE2_API_GUIDE.md` — `/history` → `/audit-log` (전체 치환)
- `ASSET_MASTER_PHASE2_SUMMARY.md` — API 목록 업데이트

---

### B4. POST /api/assets 중복 ✅

**문제:**
- 기존: `app/api/assets/route.ts`에 POST 이미 구현 (검증 로직 포함)
- 설계 Day 2: "신규 POST 구현" 지시 = 중복 개발

**해결:**
- **기존 POST 코드 재사용**
- 설계에 "기존 코드 재사용" 명시
- API 6번: `POST /api/assets [기존 코드 재사용 (app/api/assets/route.ts)]`

**변경 파일:**
- `ASSET_MASTER_PHASE2_DESIGN.md` — Group 2 API 테이블에 상태 표기
- `ASSET_MASTER_PHASE2_API_GUIDE.md` — API 6 섹션에 "[기존 코드 재사용]" 주석 추가
- `ASSET_MASTER_PHASE2_SUMMARY.md` — Group 2 API 목록에 상태 표기

---

## 웹개발자 진행 가이드

### 파일 검토 순서
1. **ASSET_MASTER_PHASE2_DESIGN.md** (최우선)
   - "기술 스택 (App Router 통일)" 섹션 확인
   - "4. GET /api/assets/:id/audit-log" 경로 확인
   - API 테이블에서 각 항목의 "상태" 컬럼 확인

2. **ASSET_MASTER_PHASE2_API_GUIDE.md**
   - API 4 섹션: `/audit-log` 경로 및 스키마 확인
   - API 6 섹션: 기존 코드 참조 주석 확인

3. **db/29_asset_master_v2_phase2.sql**
   - 라인 242-260: 트리거 제거 & 주석 검토
   - 나머지 테이블/인덱스/RLS 정책: 변경 없음

### Day 1 구현 (2026-05-16 ~ 17)
- DB 마이그레이션: 테이블 + 인덱스 + RLS 적용
- GET endpoints (5개): 1번 ~ 5번
- 예상 시간: 10시간
- 블로커 0개, 기술 스택 통일됨

### 기존 코드 활용
- **POST /api/assets (API 6)**: `/home/jeepney/.openclaw/workspace-dev/dsc-fms-portal/app/api/assets/route.ts` 참조
  - 검증 로직: machine_asset_number UNIQUE, name_en NOT NULL 등
  - 에러 처리: 409 Conflict (중복), 400 Bad Request (검증)
  - **변경 불필요** — 그대로 재사용

- **GET /api/assets/:id (API 2)**: 기존 구조 재사용
  - `app/api/assets/[assetId]/route.ts` 참조
  - GET 로직은 유지, PUT/DELETE 추가

---

## 체크리스트 (웹개발자용)

### Phase 2 시작 전
- [ ] 3개 설계 문서 검토 (DESIGN + API_GUIDE + SUMMARY)
- [ ] 기존 assets 코드 구조 파악 (`app/api/assets/` 폴더)
- [ ] `/history` vs `/audit-log` 구분 확인

### DB 마이그레이션
- [ ] `db/29_asset_master_v2_phase2.sql` Supabase 적용
- [ ] 테이블 생성 확인: `asset_import_batches`, `asset_import_items`
- [ ] RLS 정책 활성화 확인

### API 구현
- [ ] 1~5번 (GET 조회): 10시간
- [ ] 6번 (POST): 기존 코드 재사용, 테스트만 추가
- [ ] 7~9번 (PUT/DELETE/Bulk): 6시간

---

## 예상 효과

| 항목 | 효과 |
|------|------|
| next build 실패 | ✅ 해결 (App Router 통일) |
| 기존 기능 깨짐 | ✅ 방지 (history vs audit-log 분리) |
| 중복 개발 | ✅ 제거 (POST 재사용) |
| 개발 시간 | ✅ 단축 (3시간 절감) |
| 설계 명확성 | ✅ 향상 (상태 표기 추가) |

---

## 다음 단계

1. **2026-05-16 13:00**: 웹개발자에게 이 파일 + 3개 설계 문서 전달
2. **2026-05-16 ~ 17**: Day 1 진행 (DB + GET APIs)
3. **2026-05-17 09:00**: 진행 상황 보고 (예상)
4. **2026-05-19 18:00**: Phase 2 완료 예정

---

**상태:** 🟢 설계 완료, 블로커 0개, 웹개발자 착수 대기
