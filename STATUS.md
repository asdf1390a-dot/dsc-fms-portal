# DSC FMS 포털 — 프로젝트 현황판

> 자동 관리 파일. 현황 조회 시 자동 업데이트됨.

---

## 현재 상태 (Last updated: 2026-05-11 17:40 KST)

| 상태 | 항목 | 담당 |
|------|------|------|
| 🟢 완료 | BM 모듈 DB 스키마 설계 | 비서 |
| 🟢 완료 | BM 테이블 필드 확장 (priority/cause_code/downtime) | 비서 |
| 🟢 완료 | KPI RPC 함수 (MTTR/MTBF/get_monthly_kpi) | 비서 |
| 🟢 완료 | BM 신고 폼 4언어 + 4단계 계층 선택 | 웹빌더 |
| 🟢 완료 | 설비 마스터 Excel → DB 임포트 (Machine/JIG/Mould) | 데이터분석가 |
| 🟢 완료 | JIG/Mould 공정 분류 DB 정리 (extra.process) | 데이터분석가 |
| 🟢 완료 | BM 이력 목록/상세 다크 테마 리디자인 + BottomNav | 웹빌더 |
| 🟢 완료 | KPI 대시보드 (MTTR/MTBF/OEE/원인분포) | 웹빌더 |
| 🟢 완료 | PM 계획 모듈 (/pm + /pm/new + /pm/[id]) | 웹빌더 |
| 🟢 완료 | 전체 페이지 모바일 UI 수정 | 웹빌더 |
| 🟢 완료 | 현황판 /status 페이지 + 다운로드 | 웹빌더 |
| 🟢 완료 | 예비품/재고 모듈 (/inventory + DB) | 웹빌더 |
| 🟢 완료 | 작업지시 모듈 (/wo + DB) | 웹빌더 |
| 🟢 완료 | 자산 마스터 QR 코드 (BM 신고 링크) | 웹빌더 |
| 🟢 완료 | Discord 웹훅 API + BM/PM 연동 코드 | 웹빌더 |
| 🔴 컨펌필요 | Discord 웹훅 URL 입력 (서버 생성 후) | Discord URL 필요 |
| 🔴 컨펌필요 | DB 마이그레이션 실행 (07, 08 SQL) | Supabase 실행 필요 |
| 🔴 컨펌필요 | 팀 관리 technicians 데이터 입력 | 팀원 명단 필요 |
| 🔴 컨펌필요 | Excel 임포트 실패 26건 CWJ-501~539 | 추가 여부 결정 필요 |
| 🔴 컨펌필요 | GitHub PAT 보안 교체 + git push | PAT 갱신 권고 |

---

## 변경 히스토리

### 2026-05-11

| 시각 (KST) | 항목 | 변경 |
|-----------|------|------|
| 17:40 | 예비품/재고 모듈 /inventory + DB | ⚪→🟢 완료 |
| 17:40 | 작업지시 모듈 /wo + DB | ⚪→🟢 완료 |
| 17:40 | 자산 QR코드 + Discord 웹훅 API | ⚪→🟢 완료 |
| 17:10 | 현황판 /status 페이지 + 다운로드 | ⚪→🟢 완료 |
| 16:46 | 전체 페이지 모바일 UI 수정 | ⚪→🟢 완료 |
| 16:30 | PM 계획 모듈 /pm + /pm/new + /pm/[id] | ⚪→🟢 완료 (평가자 100점) |
| 16:15 | KPI 대시보드 MTTR/MTBF/OEE | ⚪→🟢 완료 (평가자 93점) |
| 15:53 | BM 이력 목록/상세 다크 테마 리디자인 + BottomNav | ⚪→🟢 완료 |
| 15:30 | BM 신고 폼 4단계 계층 선택 (부서→차종→공정→자산) | 업데이트 완료 |
| 14:00 | JIG/Mould 공정 분류 DB 정리 (extra.process) | ⚪→🟢 완료 |
| 13:00 | 설비 마스터 Excel → DB 임포트 전체 | ⚪→🟢 완료 (353건 Machine, JIG/Mould) |
| 12:00 | KPI RPC 함수 (05_kpi_rpc.sql) | ⚪→🟢 완료 |
| 11:00 | BM 모듈 DB 스키마 + 테이블 확장 | ⚪→🟢 완료 |

---

*DSC Mannur FMS Portal · 자동 생성 파일 · 수동 편집 금지*
