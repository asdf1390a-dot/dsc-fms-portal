# JEEPNEY Personal Backup App — Phase 2 설계 완료 보고

**작성 완료:** 2026-05-13  
**상태:** ✅ 설계 단계 완료  
**다음 단계:** 웹개발자(Web-Builder) 착수

---

## 📋 작업 완료 현황

### Phase 1 (기 완료)
✅ DB 스키마 (backups, backup_files 테이블)  
✅ API CRUD 구현 (list, create, update, delete, files)  
✅ 기본 UI (백업 목록, 상세 모달)  
✅ RLS 보안 정책  

### Phase 2 (설계 완료)
✅ 자동 백업 스케줄 (Vercel Cron, 매일 02:00 KST)  
✅ 보관 정책 (기본 90일, 자동 삭제)  
✅ 저장소 전략 (Supabase Storage + gzip 압축)  
✅ DB 마이그레이션 SQL (23_backup_module_phase2.sql)  
✅ 모니터링 & 알림 (Email, Telegram, In-App)  
✅ API 엔드포인트 명세 (16개)  
✅ UI/UX 설계 (4개 새 화면)  
✅ 엣지 케이스 처리 정의  

---

## 📁 산출물

### 1. 설계 문서

| 파일 | 내용 | 용도 |
|------|------|------|
| `BACKUP_APP_PHASE2_DESIGN.md` | 상세 설계 문서 (목차 13개 섹션) | 웹개발자 개발 가이드 |
| `BACKUP_APP_PHASE2_API_GUIDE.md` | API 엔드포인트 상세 명세 | API 구현 레퍼런스 |
| `BACKUP_APP_PHASE2_SUMMARY.md` | 이 문서 (요약 & 체크리스트) | 프로젝트 진행 관리 |

### 2. 데이터베이스

| 파일 | 내용 | 라인 수 |
|------|------|--------|
| `db/23_backup_module_phase2.sql` | Phase 2 마이그레이션 SQL | 240+ |
| | - 4개 신규 테이블 | |
| | - 2개 기존 테이블 확장 | |
| | - RLS 정책 | |
| | - 트리거 함수 | |
| | - 뷰 & 유틸 함수 | |

### 3. 구현 가이드

```
BACKUP_APP_PHASE2_API_GUIDE.md에서 제공:
├── 1. Schedule Configuration (1.1-1.3)
│   ├── POST /api/backup/schedule/configure
│   ├── POST /api/backup/schedule/trigger
│   └── POST /api/backup/schedule/daily [Cron]
│
├── 2. Quota Management (2.1-2.2)
│   ├── GET /api/backup/quota/status
│   └── PUT /api/backup/quota/update
│
├── 3. Metrics & Monitoring (3.1-3.3)
│   ├── GET /api/backup/metrics/summary
│   ├── GET /api/backup/metrics/daily
│   └── POST /api/backup/metrics/update-usage [Cron]
│
├── 4. Cleanup Operations (4.1-4.2)
│   ├── POST /api/backup/cleanup/daily [Cron]
│   └── POST /api/backup/cleanup/manual
│
└── 5. Notifications (5.1-5.2)
    ├── GET /api/backup/notifications/list
    └── PUT /api/backup/notifications/[id]/read
```

---

## 🎯 핵심 설계 결정

### 1. 자동 백업 스케줄
```
✓ 방식: Vercel Cron (기존 환경 통합)
✓ 시간: 매일 02:00 KST (18:30 IST - 근무 외)
✓ 트리거: 자동(daily) + 수동(manual)
✓ 동시성: 사용자당 최대 1개 진행중
```

### 2. 보관 정책
```
✓ 기본 보관기간: 90일
✓ 자동 삭제: 만료 백업 (매일 02:05)
✓ 할당량 초과: FIFO 삭제
✓ 경고 임계값: 80% 사용 시 알림
```

### 3. 저장소 전략
```
✓ Provider: Supabase Storage
  - 기존 통합으로 설정 간단
  - RLS 내장
  - 가격 경쟁력

✓ 압축: 개별 파일 gzip (.gz)
  - 저장소 절약
  - 다운로드 시 ZIP 묶음

✓ 암호화: Supabase 기본 암호화
  - 추가 비용 없음
  - 향후 client-side 암호화 확장 가능
```

### 4. 모니터링 & 알림
```
✓ 알림 채널: Email + Telegram + In-App
✓ 알림 종류:
  - 백업 완료
  - 백업 실패
  - 저장소 경고 (80%)
  - 저장소 초과 (100%+)
  - 백업 삭제 예정

✓ 메트릭:
  - 일일 성공률
  - 저장소 사용량
  - 백업 크기 추이
```

---

## 📊 데이터 모델

### 신규 테이블

#### backup_policies
```sql
user_id          — 사용자 참조
backup_enabled   — 자동 백업 활성화 여부
backup_time      — 백업 시간 (HH:MM:SS)
backup_interval  — 주기 (daily/weekly/monthly)
retention_days   — 보관기간 (기본 90일)
auto_delete_enabled — 자동 삭제 활성화
max_storage_bytes   — 최대 저장소 (기본 10GB)
warning_threshold_percent — 경고 임계값 (기본 80%)
```

#### backup_storage_quotas
```sql
user_id              — 사용자 참조
plan_type            — 요금제 (basic/standard/premium/unlimited)
max_storage_bytes    — 최대 저장소
current_usage_bytes  — 현재 사용량
last_calculated_at   — 마지막 계산 시간
```

#### backup_notifications
```sql
user_id              — 사용자 참조
backup_id            — 백업 참조 (선택)
notification_type    — 알림 종류
message              — 메시지 내용
notification_channel — 채널 (email/telegram/in_app)
sent_at              — 발송 시간
read_at              — 읽은 시간
```

#### backup_metrics
```sql
user_id                  — 사용자 참조
metric_date              — 측정 날짜
total_backups            — 전체 백업 수
successful_backups       — 성공한 백업 수
failed_backups           — 실패한 백업 수
total_size_bytes         — 총 크기
average_duration_seconds — 평균 소요 시간
```

### 기존 테이블 확장

#### backups 테이블
```sql
storage_provider    — 저장소 제공자 (supabase/s3/local)
is_compressed       — 압축 여부
compression_ratio   — 압축률 (0.0-1.0)
```

#### backup_files 테이블
```sql
is_compressed       — 파일 압축 여부
original_size_bytes — 압축 전 크기
```

---

## 🔄 API 엔드포인트 요약

### 설정 (Schedule)
```
POST   /api/backup/schedule/configure      — 백업 설정 저장
GET    /api/backup/schedule/configure      — 백업 설정 조회
POST   /api/backup/schedule/trigger        — 수동 백업 실행
POST   /api/backup/schedule/daily [Cron]   — 자동 일일 백업
```

### 할당량 (Quota)
```
GET    /api/backup/quota/status            — 할당량 상태 조회
PUT    /api/backup/quota/update            — 할당량 설정 변경
```

### 메트릭 (Metrics)
```
GET    /api/backup/metrics/summary         — 메트릭 요약
GET    /api/backup/metrics/daily           — 일일 메트릭 이력
POST   /api/backup/metrics/update-usage    — 사용량 업데이트 [Cron]
```

### 정리 (Cleanup)
```
POST   /api/backup/cleanup/daily [Cron]    — 자동 정리
POST   /api/backup/cleanup/manual          — 수동 삭제
```

### 알림 (Notifications)
```
GET    /api/backup/notifications/list      — 알림 목록 조회
PUT    /api/backup/notifications/[id]/read — 알림 읽음 처리
```

---

## 🖥️ UI/UX 추가 기능

### 신규 화면

#### 1. 자동 백업 설정
```
- 자동 백업 활성화/비활성화
- 백업 시간 선택 (드롭다운)
- 백업 간격 선택
- 보관기간 입력
- 저장 버튼
```

#### 2. 저장소 관리
```
- 저장소 사용량 게이지 (진행률 바)
- 상세 사용량 (활성/만료/스킵)
- 삭제 정책 설정
- 경고 임계값 설정
- 초과 경고 배너
```

#### 3. 백업 통계 대시보드
```
- 4개 KPI 카드 (성공률, 백업 수, 실패, 용량)
- 성공률 추이 그래프
- 기간 선택 (7/30/90일)
- 상세 백업 테이블
```

#### 4. 알림 설정
```
- 이메일 알림 토글
- Telegram 연동 (계정 변경)
- 인앱 알림 토글
- 알림 히스토리 표시
```

### 신규 컴포넌트

| 컴포넌트 | 역할 |
|---------|------|
| `AutoBackupSettings.js` | 자동 백업 설정 폼 |
| `StorageManagement.js` | 저장소 관리 화면 |
| `BackupMetrics.js` | 통계 대시보드 |
| `NotificationSettings.js` | 알림 설정 |
| `StorageUsageBar.js` | 용량 게이지 |
| `RetentionPolicyForm.js` | 보관 정책 폼 |
| `BackupMetricsCards.js` | KPI 카드 세트 |
| `SuccessRateChart.js` | 성공률 그래프 |
| `NotificationHistory.js` | 알림 로그 |
| `QuotaWarning.js` | 초과 경고 배너 |

---

## ⚠️ 엣지 케이스 처리

| 상황 | 처리 방식 |
|------|---------|
| 아직 백업 없음 | Empty state 메시지 + 권장 사항 |
| 백업 생성 실패 | 에러 토스트 + Retry 버튼 |
| 저장소 초과 | 빨간 경고 배너 + 액션 버튼 |
| 저장소 연결 실패 | 폴백: DB만 저장 + 재시도 큐 |
| 다른 사용자 접근 | RLS 차단 (DB 레벨) |
| 동시 백업 | 중복 확인 + 진행중 상태 표시 |
| 타임아웃 (30분 초과) | status='failed'로 자동 변경 |

---

## 📝 구현 순서 (Web-Builder)

### Week 1: DB & 자동화
- [ ] DB 마이그레이션 (23_backup_module_phase2.sql)
- [ ] 자동 백업 API (/schedule/daily)
- [ ] 정리 API (/cleanup/daily)
- [ ] 메트릭 업데이트 API (/metrics/update-usage)

### Week 2: 알림 & 메트릭
- [ ] 알림 시스템 (Email, Telegram)
- [ ] 알림 API (/notifications/list, /read)
- [ ] 메트릭 API (/metrics/summary, /daily)
- [ ] 할당량 API (/quota/status, /update)

### Week 3: UI & 배포
- [ ] UI 컴포넌트 (AutoBackupSettings, Storage, Metrics, Notifications)
- [ ] 설정 페이지 통합
- [ ] 테스트 (Unit, E2E, Performance)
- [ ] Staging 배포 후 Production

---

## ✅ 최종 검증 체크리스트

### Go-Live 전 확인

**DB:**
- [ ] 모든 테이블 생성 확인
- [ ] 인덱스 생성 확인
- [ ] RLS 정책 적용 확인
- [ ] 기존 데이터 무결성 검증

**API:**
- [ ] 모든 엔드포인트 작동 확인
- [ ] 요청/응답 형식 검증
- [ ] 에러 처리 확인
- [ ] 성능 테스트 (응답시간)

**자동화:**
- [ ] Vercel Cron 트리거 작동
- [ ] 매일 정시에 백업 생성
- [ ] 자동 정리 작동
- [ ] 메트릭 업데이트 작동

**알림:**
- [ ] 이메일 발송 (성공/실패)
- [ ] Telegram 발송
- [ ] 경고/초과 알림 정확
- [ ] 알림 로그 저장

**UI:**
- [ ] 모든 화면 렌더링
- [ ] 모바일 반응형 확인
- [ ] 폼 검증 작동
- [ ] 로드 성능 (< 3초)

**보안:**
- [ ] RLS 검증 (다른 사용자 데이터 접근 불가)
- [ ] API 인증 검증
- [ ] CSRF 검증
- [ ] SQL Injection 방지

---

## 📚 문서 참조

### 웹개발자용 문서
1. **BACKUP_APP_PHASE2_DESIGN.md** (520줄)
   - 상세한 설계 방향
   - 결정 배경 및 근거
   - 엣지 케이스 처리

2. **BACKUP_APP_PHASE2_API_GUIDE.md** (650줄)
   - 각 API 엔드포인트 상세 명세
   - 요청/응답 형식
   - 구현 예제 코드

3. **db/23_backup_module_phase2.sql** (240줄)
   - 마이그레이션 SQL
   - 테이블 정의
   - 트리거 및 함수

### 평가자용 문서
- BACKUP_APP_PHASE2_DESIGN.md (섹션 9-13)
  - 테스트 체크리스트
  - 마이그레이션 계획
  - 최종 검증 항목

---

## 🚀 다음 단계

### 즉시 (비서)
- [x] Phase 2 설계 완료
- [ ] 웹개발자에게 전달 (지금)

### 웹개발자
- [ ] BACKUP_APP_PHASE2_DESIGN.md 리뷰
- [ ] BACKUP_APP_PHASE2_API_GUIDE.md 리뷰
- [ ] 개발 환경 준비
- [ ] Week 1 구현 시작

### 평가자
- [ ] 설계 문서 검토 (완료 후)
- [ ] API 테스트
- [ ] UI 테스트
- [ ] 최종 품질 검증

---

## 📞 연락처 & 질문

**설계자:** Planner Agent (Web App Designer for DSC FMS Portal)  
**완료일:** 2026-05-13  
**예상 개발 기간:** 3주 (Week 1-3 구현)  
**예상 완료:** 2026-06-03 (Staging 배포)

---

**Phase 2 설계 완료. 웹개발자 착수 준비 완료.**
