# DSC FMS 포털 — 프로젝트 현황판

> 자동 관리 파일. 현황 조회 시 자동 업데이트됨.

---

## 현재 상태 (Last updated: 2026-05-12 KST)

| 상태 | 항목 | 담당 |
|------|------|------|
| 🟢 완료 | BM 모듈 (DB + UI 전체) | 비서/웹빌더 |
| 🟢 완료 | KPI 모듈 v2 (목표/실적/추세) — DESIGN_KPI.md 기준 | 웹빌더 |
| 🟢 완료 | Parts & Inventory 모듈 v2 (vendor/BM연동/대시보드) — DESIGN_PARTS.md 기준 | 웹빌더 |
| 🟢 완료 | PM 모듈 v2 (작업일지/부품사용/이행률) — DESIGN_PM.md 기준 | 웹빌더 |
| 🟢 완료 | 자산 마스터 + QR + 폐기 | 웹빌더 |
| 🟢 완료 | 작업지시(WO) 모듈 | 웹빌더 |
| 🟢 완료 | Discord 웹훅 연동 | 웹빌더 |
| 🔴 컨펌필요 | DB 마이그레이션 15/16/17 SQL 실행 | Supabase 실행 필요 |
| 🔴 컨펌필요 | Discord 웹훅 URL 입력 (재고부족 알림) | DISCORD_WEBHOOK_URL env |
| 🔴 대기중 | 4월 경영실적 보고서 업데이트 (2번 파일) | 1번자료 필요 |

---

## DB 마이그레이션 실행 순서 (Supabase SQL Editor)

기존 01~11 SQL은 이미 실행됨. 이번에 추가된 3개 파일을 순서대로 실행:

1. **`db/15_kpi_module.sql`** — KPI 모듈
   - kpi_categories (11개 항목 시드 자동 입력)
   - kpi_targets, kpi_actuals, kpi_comments
   - kpi_auto_sync RPC (BM 이력 → MTTR/MTBF 자동 집계)
   - kpi_dashboard_monthly 뷰
   - RLS: 읽기 anon 허용, 쓰기 authenticated 허용

2. **`db/16_parts_module.sql`** — Parts/Inventory v2
   - vendors 테이블 신규
   - spare_parts: vendor_id, unit_price, currency, lead_time_days, specs, maker, image_url, updated_at, low_stock_notified_at 컬럼 추가
   - stock_movements: bm_event_id, performed_by_uid, vendor_id, unit_price, currency, reference_no 컬럼 추가
   - apply_stock_movement 트리거 (입출고 시 spare_parts.quantity 자동 증감)
   - v_low_stock, v_stock_monthly 뷰
   - RLS: vendors / spare_parts DELETE policy 추가

3. **`db/17_pm_worklog.sql`** — PM 모듈 v2
   - pm_plans: frequency_label, category, checklist (jsonb), created_by, updated_at 컬럼 추가
   - pm_schedules: updated_at 컬럼 추가
   - pm_work_logs (작업일지), pm_parts_used (사용 부품) 신규
   - pm_plan_summary 뷰
   - pm_generate_schedules RPC (12회치 자동 생성)
   - get_pm_compliance_annual / get_pm_compliance_monthly RPC

**Supabase Dashboard → SQL Editor에서 위 순서대로 붙여넣기 실행. 모두 idempotent하게 작성됨 (재실행 안전).**

---

## 신규 페이지/API 목록

### KPI 모듈
- `/kpi` — 목표 대비 실적 카드 + 그룹별(생산/품질/보전/안전) + admin 입력 버튼
- `/kpi/input` — 실적/목표 입력 폼 (탭 전환, BM 자동 동기화 버튼)
- `/kpi/trend` — 6개월 추세 LineChart (recharts) + 월별 테이블
- API: `/api/kpi/dashboard`, `/api/kpi/targets`, `/api/kpi/actuals`, `/api/kpi/sync`, `/api/kpi/trend`

### Parts/Inventory 모듈
- `/inventory` — 기존 + LowStockBanner + 대시보드/공급업체 링크
- `/inventory/[id]` — 기존 + BM 이벤트 select(OUT) + vendor 정보 + 편집 버튼 + 이력에 BM 링크
- `/inventory/new` — 기존 + maker/specs/vendor/unit_price/currency
- `/inventory/edit/[id]` — 신규 편집 페이지
- `/inventory/dashboard` — 신규 재고현황 대시보드 (요약 카드 + 부족 목록 + Discord 알림 + 카테고리 바)
- `/vendors`, `/vendors/new`, `/vendors/[id]` — 공급업체 CRUD
- API: `/api/vendors`, `/api/vendors/[id]`, `/api/inventory/low-stock-alert`

### PM 모듈
- `/pm` — 기존 + 이번 달 이행률 요약 카드 (compliance API 연동)
- `/pm/[id]` — 기존 + 작업 결과 라디오(정상/이상/미룸) + 체크리스트 체크박스 + 사용 부품 인라인 입력 + 이전 작업 기록 목록
- `/pm/new` — 기존 + 작업유형(카테고리) + 체크리스트 항목 추가 UI + frequency_label + 일정 자동 생성 RPC 호출 (실패 시 단건 fallback)
- `/pm/plans` — 신규 계획 마스터 목록 (활성/비활성/전체 탭, 검색)
- API: `/api/pm/compliance`, `/api/pm/work-logs`, `/api/pm/generate`

### 공통 신규
- `lib/api-auth.js` — Bearer 토큰 → user / user-scoped client 헬퍼
- `components/kpi/`, `components/vendors/` — 컴포넌트 모듈화

---

## 빌드 상태

`npm run build` — 🟢 통과 (모든 페이지/API 컴파일 성공)

```
Route (pages)                              Size     First Load JS
├ ○ /kpi                                   5 kB            152 kB
├ ○ /kpi/input                             4.84 kB         152 kB
├ ○ /kpi/trend                             5.61 kB         153 kB
├ ○ /inventory                             4.89 kB         152 kB
├ ○ /inventory/dashboard                   4.99 kB         152 kB
├ ○ /inventory/edit/[id]                   4.79 kB         152 kB
├ ○ /vendors                               3.51 kB         151 kB
├ ○ /pm                                    5.17 kB         152 kB
├ ○ /pm/[id]                               7.09 kB         154 kB
├ ○ /pm/plans                              3.83 kB         151 kB
... (기타 모든 페이지 통과)
```

---

## 의존성 변경

- `recharts ^3.8.1` 추가 — KPI 추세 LineChart용. SSR 비활성 dynamic import 적용.

---

## 사용자 액션 필요

1. Supabase Dashboard → SQL Editor에서 `db/15_kpi_module.sql`, `db/16_parts_module.sql`, `db/17_pm_worklog.sql`을 **순서대로** 실행
2. (선택) 재고부족 Discord 알림을 사용하려면 Vercel 환경변수에 `DISCORD_WEBHOOK_URL` 추가
3. Git push & Vercel 배포

---

*DSC Mannur FMS Portal · 자동 생성 파일 · 수동 편집 금지*
