# Audit System Framework

## 개요

Backup Phase 2 운영 중 시스템 신뢰도를 체계적으로 관리하기 위한 일일·주간·월간 감사 프레임워크. 목표는 **시스템 신뢰도 95% 달성 및 지속적 개선**.

---

## 1. 일일 신뢰도 평가 (Daily Reliability Score)

### 1.1 평가 대상 지표 (4개)

| 지표 | 담당자 | 목표 | 계산 방식 |
|------|--------|------|---------|
| **Backup 성공률** | Secretary | ≥99% | (성공 건수 / 전체 시도) × 100 |
| **API 응답시간** | Evaluator | <2s (avg) | API 호출 시 측정된 평균값 |
| **저장소 신뢰도** | Data-Analyst | ≥98% | (정상 저장소 / 전체) × 100 |
| **알림 전달률** | Secretary | ≥95% | (정상 전달 / 시도) × 100 |

### 1.2 일일 신뢰도 점수 계산

```
Daily Reliability Score (DRS) = (백업성공률 × 0.35) 
                               + (API응답성 × 0.25) 
                               + (저장소신뢰도 × 0.30) 
                               + (알림전달률 × 0.10)

목표: DRS ≥ 95%
```

### 1.3 자동 계산 로직

**실행 시점:** 매일 03:00 KST (백업 완료 후 1시간)

**데이터 수집:**
1. Secretary: Vercel Cron 로그, backup_metrics 테이블 조회
2. Evaluator: API 응답시간 로그 (응답 헤더 타임스탐프)
3. Data-Analyst: backup_storage_quotas 조회, 저장소 상태 검증
4. Secretary: backup_notifications 테이블 조회

**점수 집계:**
- 각 지표별 24시간 데이터 평균 계산
- 가중치 적용 후 합산
- DRS 결과를 backup_metrics.daily_score에 저장
- DRS < 95% 시 🔴 플래그 설정

---

## 2. 팀 피드백 루프 (Team Feedback Loop)

### 2.1 역할 정의

#### **Secretary (비서)**
- **책임:** 메트릭 수집 자동화, 일일 리포트 생성
- **산출물:** Daily Metrics Report (매일 03:30)
- **액션:**
  - backup_metrics 테이블 조회 (자동)
  - DRS 계산 (자동)
  - Telegram 일일 요약 전송

#### **Evaluator (평가자)**
- **책임:** API 성능 검증, 알림 신뢰도 테스트
- **산출물:** Weekly API Audit Report (매주 월요일)
- **액션:**
  - API 응답시간 로그 분석 (주 2회)
  - 알림 전달 체인 테스트 (주 1회)
  - 이상 패턴 리포트

#### **Data-Analyst (데이터분석가)**
- **책임:** 저장소 신뢰도 분석, 추세 분석
- **산출물:** Weekly Storage Analysis Report (매주 수요일)
- **액션:**
  - 저장소 상태 상세 분석 (주 2회)
  - 이상 감지 (Anomaly Detection)
  - 용량 추이 분석

### 2.2 피드백 루프 프로세스

```
매일 03:00
  ├─ Secretary: 메트릭 수집 & DRS 계산
  ├─ 03:30: Telegram 일일 요약 전송
  │
매주 월요일 10:00
  ├─ Evaluator: API 성능 검증 리포트
  ├─ 의사결정자 검토
  │
매주 수요일 14:00
  ├─ Data-Analyst: 저장소 신뢰도 분석 리포트
  ├─ 의사결정자 검토
  │
매주 금요일 16:00
  └─ Weekly Review Meeting
      ├─ DRS 동향 리뷰
      ├─ 개선사항 논의
      └─ 다음주 액션 결정
```

---

## 3. 자동 개선 메커니즘 (Auto-Improvement System)

### 3.1 이상 감지 (Anomaly Detection)

**조건:**
- DRS < 95% → 🔴 즉시 알림
- API 응답시간 > 2.5s (평균) → 🟡 경고
- 저장소 신뢰도 < 97% → 🟡 경고
- 알림 전달률 < 90% → 🔴 즉시 조치

**알림 채널:**
1. **Email:** 담당자 + 의사결정자 (즉시)
2. **Telegram:** 사용자 + 팀 채널 (즉시)
3. **In-App:** 대시보드 알림 (1분 내)

### 3.2 자동 권장사항 생성

**매주 수요일 16:00, Data-Analyst가 분석 후 자동 생성:**

```
IF DRS < 93% THEN
  └─ 권장: API 최적화 필요 (응답시간 > 2.5s 감지)
     조치: API 쿼리 인덱싱 검토, 캐싱 강화

IF 저장소신뢰도 < 96% THEN
  └─ 권장: 저장소 정리 필요
     조치: 유효기간 만료 파일 검토, 중복 제거

IF 알림전달률 < 92% THEN
  └─ 권장: 알림 채널 검증 필요
     조치: Email/Telegram 설정 확인, 재연결 시도
```

### 3.3 체크포인트 (Checkpoint System)

| 주기 | 시점 | 책임자 | 액션 |
|------|------|--------|------|
| **일일** | 매일 03:30 | Secretary | DRS 점수 확인, 🔴 알림 처리 |
| **주간** | 매주 금요일 16:00 | Team Lead | Weekly Review, 개선사항 선정 |
| **월간** | 매월 1일 | 의사결정자 | Monthly Retrospective, Q1/Q2 목표 설정 |

---

## 4. 팀 논의 체계 (Team Discussion Framework)

### 4.1 주간 리뷰 프로세스

**매주 금요일 16:00-17:00 (온라인 스레드 기반)**

**순서:**
1. **10분:** DRS 동향 리뷰 (매주 목표 달성 여부)
2. **15분:** 이슈 분석 (Evaluator/Data-Analyst 리포트 검토)
3. **20분:** 개선사항 논의 (다음주 우선순위 결정)
4. **15분:** 액션 정리 (담당자 할당, 완료 예상일)

**참석자:**
- Secretary (메트릭 담당)
- Evaluator (성능 담당)
- Data-Analyst (분석 담당)
- Web-Builder (개발 담당)
- 의사결정자 (최종 승인)

### 4.2 에스컬레이션 기준

| 심각도 | 조건 | 대응 |
|--------|------|------|
| 🔴 **Critical** | DRS < 85% OR 알림전달률 < 80% | 즉시 호출, 2시간 내 조치 |
| 🟡 **High** | DRS < 90% OR 3회 연속 🔴 | 6시간 내 리뷰, 24시간 내 조치 |
| 🟢 **Normal** | DRS 90~95% | 주간 리뷰에서 논의 |
| ✅ **Good** | DRS ≥ 95% | 정상 운영, 품질 유지 |

### 4.3 의사결정 권한

| 결정 사항 | 권한자 | 합의 기준 |
|----------|--------|---------|
| **일일 알림 처리** | Secretary + Evaluator | 2인 이상 동의 |
| **주간 개선사항** | Team Lead | 팀 코멘트 수집 후 결정 |
| **API/성능 최적화** | Web-Builder + Evaluator | 성능 테스트 후 승인 |
| **저장소 정책 변경** | Data-Analyst + Secretary | 영향도 분석 후 결정 |
| **월간 목표 수정** | 의사결정자 | 팀 리뷰 후 최종 승인 |

### 4.4 문제해결 플로우

```
Issue Detection (Automated)
     ↓
Telegram/Email Alert (Immediate)
     ↓
Team Investigation (< 6시간)
     ├─ Evaluator: 성능 분석
     ├─ Data-Analyst: 데이터 분석
     └─ Secretary: 메트릭 수집
     ↓
Root Cause Analysis
     ↓
Solution Proposal
     ├─ Web-Builder: 개발 가능성 검토
     └─ Secretary: 영향도 평가
     ↓
Implementation (< 24시간)
     ├─ Code change (Web-Builder)
     ├─ Testing (Evaluator)
     └─ Monitoring (Secretary)
     ↓
Verification (< 48시간)
     ├─ DRS 모니터링
     └─ Telegram 결과 리포트
```

---

## 5. 통합 대시보드 (Integration Dashboard)

### 5.1 실시간 메트릭 표시

```
┌─────────────────────────────────────┐
│ Daily Reliability Score (DRS)        │
│ ◀──────────────── 94.2% ────────────▶│
│ 목표: 95%  [상태: 🟡 주의]          │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ 각 지표별 분석                       │
├─────────────────────────────────────┤
│ • Backup 성공률: 99.1% ✅           │
│ • API 응답시간: 1.92s ✅            │
│ • 저장소 신뢰도: 96.8% 🟡          │
│ • 알림 전달률: 98.5% ✅             │
└─────────────────────────────────────┘
```

### 5.2 주간 추이 그래프

- DRS 동향 (7일 이동평균)
- 각 지표별 주간 추이
- 이상 구간 표시
- 개선 전후 비교

---

## 6. 운영 일정

| 날짜 | 시간 | 담당자 | 내용 |
|------|------|--------|------|
| 매일 | 03:00 | Secretary | 메트릭 자동 수집 & DRS 계산 |
| 매일 | 03:30 | Secretary | Telegram 일일 요약 전송 |
| 매주 월 | 10:00 | Evaluator | API 성능 검증 리포트 |
| 매주 수 | 14:00 | Data-Analyst | 저장소 신뢰도 분석 리포트 |
| 매주 금 | 16:00 | Team | Weekly Review Meeting |
| 매월 1일 | 10:00 | 의사결정자 | Monthly Retrospective |

---

## 7. 초기 목표 (Phase 2 기간)

| 주차 | 목표 DRS | 주요 작업 |
|------|---------|---------|
| W1-W2 | 90% | Backup 안정화, API 최적화 |
| W3-W4 | 92% | 저장소 신뢰도 향상 |
| W5-W6 | 94% | 알림 시스템 고도화 |
| W7+ | 95%+ | 지속적 모니터링 & 개선 |

---

**문서 작성일:** 2026-05-15  
**시행일:** Backup Phase 2 운영 시작 (2026-05-16)  
**검토 주기:** 월간 (매월 1일)
