# Asset Master v2 Phase 2 — 최종 요약 & 체크리스트

> **작성:** 2026-05-16 09:00 KST  
> **상태:** P0 수정 완료, 웹개발자 착수 대기  
> **마감:** 2026-05-19 18:00 KST

---

## 📌 블로커 4개 + P0 수정 완료 사항 (2026-05-16 12:00 기준)

### B1: App Router vs Pages Router 충돌 ✅ [해결됨]
- **문제:** CLAUDE.md 지시는 Pages Router, 기존 자산 API는 모두 App Router
  - 설계의 POST `/api/assets` → pages/api/assets.js 추가 시 충돌
- **해결:** 설계 변경 → **App Router로 통일**
  - 라우트 구조: `app/api/assets/route.ts` (root) + `app/api/assets/[assetId]/route.ts` (nested)
  - 파일: ASSET_MASTER_PHASE2_DESIGN.md (기술 스택 섹션 추가)
- **효과:** next build 성공, 라우트 명확화

### B2: asset_audit 스키마 불일치 ✅ [해결됨]
- **문제:** 설계의 audit trigger INSERT 실패
  - 설계: (table_name, record_id, operation, old_values, new_values, change_description)
  - 기존: (asset_id, changed_at, changed_by, action, diff)
- **해결:** 설계 SQL 수정 → **audit trigger 제거 및 기존 asset_audit_log() 재사용**
  - import_batches/items는 RLS 정책으로만 관리
  - 파일: db/29_asset_master_v2_phase2.sql (트리거 블록 삭제, 주석 추가)
- **효과:** SQL 마이그레이션 성공

### B3: 라우트 명명 충돌 ✅ [해결됨]
- **문제:** 설계의 `GET /api/assets/:id/history` vs 기존 `pages/api/assets/[assetId]/history.js`
  - 기존 history = PM/BM 이벤트 이력 (프로덕션 중)
  - 충돌로 기존 기능 깨짐
- **해결:** 경로 변경 → `GET /api/assets/:id/audit-log`
  - 파일: ASSET_MASTER_PHASE2_DESIGN.md, API_GUIDE.md, SUMMARY.md
- **효과:** 기존 history 엔드포인트 보존, 감사 이력은 별도 경로

### B4: POST /api/assets 중복 ✅ [해결됨]
- **문제:** 설계의 Day 2 "신규 POST 구현" vs 기존 `app/api/assets/route.ts` (이미 완성)
  - 중복 구현 시 검증 로직 충돌
- **해결:** 설계 변경 → **기존 POST 코드 재사용**
  - 표기: "기존 코드 재사용 (app/api/assets/route.ts)" in Group 2 API 6번
  - 파일: DESIGN.md, API_GUIDE.md, SUMMARY.md
- **효과:** 개발 시간 절감 (재검증 불필요)

### P0-1: DB 인덱스 충돌 해결 ✅
- IF NOT EXISTS 사용, 신규 인덱스만 추가
- 파일: `db/29_asset_master_v2_phase2.sql`

### P0-2: Excel 헤더 정정 ✅
- 변경: `category_code` → `asset_class_code`
- 파일: API_GUIDE.md template 섹션

### P0-3: RLS 정책 추가 ✅
- org_id 기반 액세스 제어
- 파일: `db/29_asset_master_v2_phase2.sql`

---

## 📊 설계 범위 재정의

### MVP 16개 API (2026-05-19까지)

**Group 1: 조회 (5개)**
```
1. GET /api/assets                     — 목록 (필터+검색) [신규]
2. GET /api/assets/:id                 — 상세 [기존 재사용]
3. GET /api/asset-categories           — 카테고리 [신규]
4. GET /api/assets/:id/audit-log       — 이력 [신규, /history → /audit-log 경로 변경]
5. GET /api/assets/locations           — 위치 자동완성 [신규]
```

**Group 2: CRUD (4개)**
```
6.  POST /api/assets                   — 생성 [기존 코드 재사용 app/api/assets/route.ts]
7.  PUT /api/assets/:id                — 수정 [신규]
8.  DELETE /api/assets/:id             — 삭제 [신규]
9.  POST /api/assets/bulk-update       — 일괄 수정 [신규]
```

**Group 3: Import (5개)**
```
10. GET /api/assets/import/template.xlsx       — 템플릿 DL
11. POST /api/assets/import/preview            — 미리보기+검증
12. POST /api/assets/import/execute            — 실행
13. GET /api/assets/import/batches             — 배치 목록
14. GET /api/assets/import/batches/:batch_id   — 배치 상세
15. GET /api/assets/import/batches/:batch_id/items  — 배치 아이템
```

**Group 4: Export & Stats (2개)**
```
16. GET /api/assets/export/excel       — Excel 내보내기
17. GET /api/assets/statistics         — 통계
```

### Phase 2.5 Defer (2026-05-22~)

```
9개 엔드포인트: deduplicate, merge, retry-failed, validate, validation-report, missing-fields, timeline, batch-delete, bulk-delete
UI 1개: 고급 검색 → 목록 필터 드로어로 통합 (화면 1에 포함)
```

---

## 🎯 최종 산출물

### 1. 설계 문서 (3개)
- ✅ `ASSET_MASTER_PHASE2_DESIGN.md` (6.5K) — 최종 설계
- ✅ `ASSET_MASTER_PHASE2_API_GUIDE.md` (18K) — API 명세 (16개)
- ✅ `ASSET_MASTER_PHASE2_SUMMARY.md` (현재 문서)

### 2. DB 마이그레이션 SQL
- ✅ `db/29_asset_master_v2_phase2.sql` (4.2K)
  - 2개 신규 테이블 (batches, items)
  - 4개 신규 인덱스
  - 2개 RLS 정책
  - 1개 RPC 함수 (bulk_insert_assets)
  - 감시 트리거

### 3. 웹개발자 체크리스트

#### Phase 2 DB 적용
- [ ] `db/29_*.sql` 파일 검토
- [ ] Supabase SQL Editor에서 실행
- [ ] 테이블 생성 확인: `select * from information_schema.tables where table_name in ('asset_import_batches', 'asset_import_items');`
- [ ] RLS 활성화 확인: `select tablename from pg_tables where rowsecurity = true;`

#### MVP 16개 API 구현
- [ ] Group 1 (조회): 1~5번
- [ ] Group 2 (CRUD): 6~9번
- [ ] Group 3 (Import): 10~15번
- [ ] Group 4 (Export/Stats): 16~17번

#### UI 3개 화면
- [ ] 화면 1: 자산 목록 개선 (`/assets`)
  - 검색바 + 필터 드로어
  - 모바일 카드 / 데스크톱 테이블
  - [대량 등록] [내보내기] [통계] 버튼
  
- [ ] 화면 2: 대량 등록 마법사 (`/assets/bulk-import`)
  - Step 1: 파일 업로드
  - Step 2: 미리보기 & 검증 + [오류 행 다운로드]
  - Step 3: 실행 & 진행률
  
- [ ] 화면 3: 통계 대시보드 (`/assets/statistics`)
  - 요약 카드 (총 자산 수)
  - 바 차트: 상태별, 카테고리별
  - 테이블: 위치별, 제조사별

#### 테스트 & 배포
- [ ] 16개 API 단위 테스트 (최소 happy path)
- [ ] 3개 UI 화면 e2e 테스트
- [ ] Vercel 빌드 성공
- [ ] Vercel 배포 (main 브랜치)

---

## 🔄 구현 일정 (5일)

| 날짜 | 단계 | 작업 | 결과 |
|------|------|------|------|
| 05-16 (금) | 설계 완료 | P0 수정 + 설계서 배포 | ✅ DESIGN + API_GUIDE + SQL |
| 05-16~17 | DB + GET | 마이그레이션 + 조회 API 5개 | 1~5번 구현 |
| 05-17~18 | CRUD + Bulk | 생성/수정/삭제 + 일괄 수정 | 6~9번 구현 |
| 05-18~19 | Import | 템플릿 DL + 임포트 5개 | 10~15번 구현 |
| 05-19 | Export/Stats + UI | 내보내기 + 통계 + 3개 화면 | 16~17번 + UI + build |

---

## ⚠️ 성능 & 보안 체크리스트

### 성능
- [ ] 1000+ 행 import → Supabase RPC 함수 사용
- [ ] FTS 인덱스 → 506행 기준 무시 가능
- [ ] 페이지네이션 → per_page=20 기본값
- [ ] 배치 폴링 간격 → 1초 (클라이언트)

### 보안
- [ ] Formidable MIME 화이트리스트: xlsx, xls만
- [ ] 파일 크기 제한: 10MB
- [ ] RLS 정책: org_id 기반
- [ ] Import execute: service_role 필수 (anon 금지)
- [ ] Bulk-update: server-side API만

### 라이브러리
- ✅ xlsx (읽기) — 이미 설치
- ✅ exceljs (쓰기) — 이미 설치
- ✅ formidable (업로드) — 이미 설치
- ✅ crypto (해시) — Node 내장

---

## 📝 Excel 템플릿 예시

### 헤더행
```
machine_asset_number | name_en | name_ta | location | status | model | make | year_of_manufacture | asset_class_code | serial_no | remark
```

### 예시 데이터 (1행)
```
DCMI-UTL-PSF-03 | SUB STATION | சப் ஸ்டேஷன் | EB YARD | active | EB - SUB STATION | TRINITY | 2015 | 01.001 | SN-2015-001 | Sample asset
```

### 검증 규칙
| 필드 | 필수 | 유일 | 타입 | 규칙 |
|------|------|------|------|------|
| machine_asset_number | ✅ | ✅ | text | 기존 중복 없음 |
| name_en | ✅ | ❌ | text | 글자 수 제한 없음 |
| name_ta | ❌ | ❌ | text | 타밀 글자만 |
| asset_class_code | ✅ | ❌ | text | asset_classes.code 참조 |
| status | ✅ | ❌ | enum | active/idle/maintenance/sold/scrapped |
| year_of_manufacture | ❌ | ❌ | int | 1900~2100 |
| location | ❌ | ❌ | text | 자유 입력 |
| model, make, serial_no | ❌ | ❌ | text | 자유 입력 |
| remark | ❌ | ❌ | text | 자유 입력 |

---

## 🔗 참고 문서

- 설계: `/ASSET_MASTER_PHASE2_DESIGN.md`
- API: `/ASSET_MASTER_PHASE2_API_GUIDE.md`
- SQL: `/db/29_asset_master_v2_phase2.sql`
- 웹개발자 피드백: `/ASSET_MASTER_PHASE2_WEB_FEEDBACK.md`

---

## 다음 액션

### 플레너 (완료) ✅
1. ✅ P0 3건 수정
2. ✅ 설계서 3개 작성 (DESIGN, API_GUIDE, SUMMARY)
3. ✅ SQL 마이그레이션 작성
4. ⏳ 웹개발자 피드백 대기 및 진도 리포트 (매일 14:00)

### 웹개발자 (대기중)
1. ⏳ 설계서 리뷰 (05-16 AM)
2. 🔴 DB 마이그레이션 적용 (05-16)
3. 🔴 MVP 16개 API 구현 (05-16~19)
4. 🔴 UI 3개 화면 개발 (05-18~19)
5. 🔴 테스트 & 배포 (05-19 18:00)

### 사용자
- 📍 Supabase SQL Editor에서 db/29_*.sql 실행 (웹개발자 요청 시)

---

**상태:** 🟢 **P0 완료, 웹개발자 착수 대기**  
**ETA:** 2026-05-19 18:00 KST (MVP 16개 배포)
