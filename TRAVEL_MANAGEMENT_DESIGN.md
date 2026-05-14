# Travel Management Module — 완전 설계서

> **상태:** 플레너 최종 설계 (웹개발자 구현 전)  
> **작성일:** 2026-05-14  
> **담당:** 플레너 (설계), 웹개발자 (구현 대기)  
> **목표:** DSC Hub 내 여행/출장 관리 모듈 통합 설계

---

## 📋 목차

1. [모듈 개요](#1-모듈-개요)
2. [UI/UX 설계](#2-uiux-설계)
3. [사용자 흐름](#3-사용자-흐름)
4. [컴포넌트 명세](#4-컴포넌트-명세)
5. [DB 스키마](#5-db-스키마)
6. [API 명세](#6-api-명세)
7. [엣지 케이스 & 예외처리](#7-엣지-케이스--예외처리)
8. [구현 체크리스트](#8-구현-체크리스트)

---

## 1. 모듈 개요

### 1.1 목표

여행/출장 데이터를 **일괄 관리**하는 포탈 내 전용 모듈:
- 항공편, 숙소, 식사 일정 추적
- 비용 정산 (공동비용 분할)
- 준비물 체크리스트
- 서류 보관 (비자, 항공권, 영수증 등)
- 실시간 알림 (출발 전날, 체크인 시간 등)

### 1.2 대상 사용자

| 사용자군 | 역할 | 사용 시나리오 |
|---------|------|-----------|
| **여행 주도자** (Na Kyeongtae) | 여행 생성, 일정 추가, 경비 정산 | 여행 전체 관리자 |
| **동반자** (Huishuwo Leiyawon) | 경비 조회, 체크리스트 확인, 일정 보기 | 읽기/부분 편집 |
| **포탈 관리자** (향후) | 감사, 경비 검증, 통계 | 조회 전용 |

### 1.3 핵심 가치

| 항목 | 설명 |
|------|------|
| **통합성** | 포탈 내에서 항공/숙소/비용을 한곳에서 관리 |
| **투명성** | 누가 얼마를 썼는지 실시간 추적 |
| **효율성** | 체크리스트로 준비 빠뜨림 방지 |
| **보안** | 비자, 여권 등 민감 정보 암호화 저장 |
| **모바일 최적화** | 외출 중 빠른 확인/수정 가능 |

---

## 2. UI/UX 설계

### 2.1 정보 아키텍처

**Travel Records 탭 하위 구조:**

```
Travel Records (Tab 3)
│
├── 📋 Travel List (여행 목록)
│   ├── 카드 뷰 (여행별)
│   │   ├── 여행명
│   │   ├── 기간 (2026-05-15 ~ 05-24)
│   │   ├── 지역 (Ho Chi Minh City)
│   │   ├── 동반자 (1명)
│   │   ├── 총 비용 (₹148,771)
│   │   └── 액션: 열기 / 편집 / 삭제
│   └── 필터/정렬: 상태 (진행중/완료/계획), 날짜순
│
└── 🗺️ Travel Detail (여행 상세)
    │
    ├── 탭 1️⃣: Overview (개요)
    │   ├── 헤더: 여행명, 기간, 지역
    │   ├── 요약 카드:
    │   │   ├── 출발/도착 정보
    │   │   ├── 총 인원
    │   │   ├── 총 비용 + 1인당 비용
    │   │   └── 동반자 목록
    │   └── 빠른 액션: 수정 / 삭제 / 공유
    │
    ├── 탭 2️⃣: Schedule (일정 관리)
    │   ├── 캘린더 뷰 (월간)
    │   ├── 타임라인 뷰 (시간별 이벤트)
    │   │   ├── 비행: 2026-05-15 23:50 (TR 779/516)
    │   │   ├── 체크인: 2026-05-16 14:00 (Lumiere)
    │   │   ├── 식사: 2026-05-21 20:00 (OMAKASE TIGER)
    │   │   ├── 체크아웃: 2026-05-24 12:00
    │   │   └── 비행: 2026-05-24 15:40 (TR 553/778)
    │   ├── 이벤트 추가 버튼
    │   └── 각 이벤트:
    │       ├── 제목, 시간, 장소
    │       ├── 확인 상태 (예정/완료/취소)
    │       └── 알림 설정
    │
    ├── 탭 3️⃣: Costs (경비 관리)
    │   ├── 요약:
    │   │   ├── 총 비용: ₹148,771
    │   │   ├── 정산 상태: "아직 정산 안 됨" 또는 "정산 완료"
    │   │   └── 1인당 평균: ₹74,385.50
    │   ├── 비용 항목 목록:
    │   │   ├── 항공편 (₹96,050) — Na Kyeongtae 결제
    │   │   ├── 숙소 (₹47,721) — Na Kyeongtae 결제
    │   │   ├── 식사 (≈₹5,000) — Na Kyeongtae 결제
    │   │   └── 기타 (미등록)
    │   ├── 정산 계산표:
    │   │   ├── 개인별 지출
    │   │   ├── 개인별 정산액
    │   │   └── 이체 지시
    │   └── 비용 추가 버튼
    │
    ├── 탭 4️⃣: Checklist (준비물)
    │   ├── 카테고리별:
    │   │   ├── 📋 서류 (여권, 비자, 항공권 등)
    │   │   ├── 👕 의류 (반팔, 정장 등)
    │   │   ├── 🧴 세면도구 (칫솔, 선크림 등)
    │   │   ├── 📱 전자기기 (휴대폰, 충전기 등)
    │   │   └── 🏥 의약품 (소화제, 감기약 등)
    │   ├── 각 항목: 체크박스 + 메모
    │   ├── 진행률 표시 (예: 15/30 완료)
    │   └── 항목 추가 버튼
    │
    ├── 탭 5️⃣: Documents (서류 보관)
    │   ├── 폴더 구조:
    │   │   ├── 📄 비자 & 여권
    │   │   ├── 🎫 항공권
    │   │   ├── 🏨 호텔 확인
    │   │   ├── 💳 영수증
    │   │   └── 📝 기타 서류
    │   ├── 각 문서:
    │   │   ├── 파일명 + 날짜
    │   │   ├── 미리보기 (이미지/PDF)
    │   │   ├── 다운로드 버튼
    │   │   └── 삭제 버튼
    │   ├── 파일 업로드 영역
    │   └── 저장소 용량 표시
    │
    └── 탭 6️⃣: Notifications (알림 설정)
        ├── 알림 규칙:
        │   ├── 출발 전 7일: 여행 준비 알림
        │   ├── 출발 1일 전: 짐 확인
        │   ├── 출발 24시간 전: 최종 알림
        │   ├── 출발 6시간 전: 공항 출발
        │   ├── 각 이벤트 1시간 전
        │   └── 체크아웃 전날: 준비 알림
        ├── 알림 채널:
        │   ├── ✓ 인앱 알림
        │   ├── ✓ 이메일
        │   ├── ✓ Telegram
        │   └── ✓ SMS (향후)
        └── 알림 활성화/비활성화 토글
```

### 2.2 화면 레이아웃

#### Travel List 화면

```
┌─────────────────────────────────────────────────────────┐
│ Travel Records  [+ 새 여행] [필터▼] [정렬▼]           │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌───────────────────────────────────────────────────┐ │
│  │ 🌏 Ho Chi Minh City                               │ │
│  │ 2026-05-15 ~ 05-24 (9일)                         │ │
│  │                                                    │ │
│  │ 인원: Na Kyeongtae, Huishuwo Leiyawon (2명)      │ │
│  │ 총 비용: ₹148,771                                │ │
│  │                                                    │ │
│  │  [편집] [공유] [삭제]                           │ │
│  └───────────────────────────────────────────────────┘ │
│                                                           │
│  (더 많은 여행 카드...)                                  │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

#### Travel Detail - Overview 탭

```
┌─────────────────────────────────────────────────────────┐
│ 🏠 Travel Detail (Ho Chi Minh City)  [편집] [공유]     │
├─────────────────────────────────────────────────────────┤
│ [Overview] [Schedule] [Costs] [Checklist] [Documents]   │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  기본 정보                                               │
│  ├─ 출발: 2026-05-15 23:50 (Chennai)                   │
│  ├─ 도착: 2026-05-16 17:15 (Ho Chi Minh City)         │
│  ├─ 귀국: 2026-05-24 22:50 (Chennai)                  │
│  └─ 항공사: Tirupati Airways                           │
│                                                           │
│  숙소 정보                                               │
│  ├─ 이름: Luxurious 1BR @Lumiere                       │
│  ├─ 주소: Quận 2, Ho Chi Minh City                     │
│  ├─ 체크인: 2026-05-16 14:00                           │
│  ├─ 체크아웃: 2026-05-24 12:00                        │
│  ├─ 박수: 8박                                           │
│  └─ 비용: ₹47,721                                      │
│                                                           │
│  인원 및 비용                                           │
│  ├─ 총 인원: 2명                                        │
│  │  └─ Na Kyeongtae (주도자)                           │
│  │  └─ Huishuwo Leiyawon (동반자)                     │
│  ├─ 총 비용: ₹148,771                                 │
│  └─ 1인당 평균: ₹74,385.50                            │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

#### Travel Detail - Schedule 탭

```
┌─────────────────────────────────────────────────────────┐
│ [Overview] [Schedule] [Costs] [Checklist] [Documents]   │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  📅 2026년 5월                        [< | >]          │
│  ┌───┬───┬───┬───┬───┬───┬───┐                       │
│  │ S │ M │ T │ W │ T │ F │ S │                       │
│  ├───┼───┼───┼───┼───┼───┼───┤                       │
│  │   │   │   │   │   │  1│  2│                       │
│  │...│...│15⭐│16⭐│17 │18 │19 │ (15=출발, 16=도착)  │
│  │20 │21⭐│22 │23 │24⭐│...│...│ (21=식사, 24=귀국)  │
│  └───┴───┴───┴───┴───┴───┴───┘                       │
│                                                           │
│  타임라인 뷰                                            │
│  ─────────────────────────────────────────────────      │
│                                                           │
│  2026-05-15 (금) 23:50                                 │
│  🛫 항공편 TR 779/516 출발                             │
│     - 출발지: Chennai (CMB)                            │
│     - 도착지: Ho Chi Minh City (SGN)                   │
│     - 소요: 7시간                                       │
│     - 상태: ○ 예정 ● 완료 ⊘ 취소                      │
│     ☑ 알림 활성화 (출발 6시간 전)                     │
│                                                           │
│  2026-05-16 (토) 17:15                                │
│  🛬 항공편 TR 779/516 도착                             │
│     - 도착지: Ho Chi Minh City (SGN)                   │
│     - 예상시간: 17:15 (UTC+7)                          │
│                                                           │
│  2026-05-16 (토) 14:00                                │
│  🏨 호텔 체크인                                         │
│     - 호텔: Luxurious 1BR @Lumiere                    │
│     - 주소: Quận 2, Ho Chi Minh City                   │
│     - 확인코드: HMF2ZZ9A24                             │
│     ☑ 알림 활성화                                      │
│                                                           │
│  2026-05-21 (수) 20:00                                │
│  🍽️ 레스토랑 예약                                      │
│     - 장소: OMAKASE TIGER Penthouse                   │
│     - 인원: 2명                                         │
│     - 예약번호: (미등록)                               │
│     ☑ 알림 활성화 (1시간 전)                          │
│                                                           │
│  2026-05-24 (토) 12:00                                │
│  🏨 호텔 체크아웃                                       │
│     - 호텔: Luxurious 1BR @Lumiere                    │
│     ☑ 알림 활성화 (1일 전)                            │
│                                                           │
│  2026-05-24 (토) 15:40                                │
│  🛫 항공편 TR 553/778 출발                             │
│     - 출발지: Ho Chi Minh City (SGN)                   │
│     - 도착지: Chennai (CMB)                            │
│     - 소요: 7시간                                       │
│     - 상태: ○ 예정                                     │
│                                                           │
│  2026-05-24 (토) 22:50                                │
│  🛬 항공편 TR 553/778 도착                             │
│     - 도착지: Chennai (CMB)                            │
│     - 예상시간: 22:50 (UTC+5:30)                       │
│                                                           │
│  ─────────────────────────────────────────────────      │
│  [+ 이벤트 추가]                                        │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

#### Travel Detail - Costs 탭

```
┌─────────────────────────────────────────────────────────┐
│ [Overview] [Schedule] [Costs] [Checklist] [Documents]   │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  💰 경비 요약                                            │
│  ┌─────────────────────────────────────┐               │
│  │ 총 비용       ₹148,771              │               │
│  │ 정산 상태     아직 정산 안 됨        │               │
│  │ 1인당 평균    ₹74,385.50            │               │
│  └─────────────────────────────────────┘               │
│                                                           │
│  💳 비용 항목                                            │
│  ├─────────────────────────────────────────────────┐  │
│  │ ✈️ 항공편 (왕복)          ₹96,050              │  │
│  │    결제자: Na Kyeongtae                        │  │
│  │    [편집] [삭제]                              │  │
│  └─────────────────────────────────────────────────┘  │
│  ├─────────────────────────────────────────────────┐  │
│  │ 🏨 숙소 (8박)            ₹47,721              │  │
│  │    결제자: Na Kyeongtae                        │  │
│  │    [편집] [삭제]                              │  │
│  └─────────────────────────────────────────────────┘  │
│  ├─────────────────────────────────────────────────┐  │
│  │ 🍽️ 식사 & 음료           ≈₹5,000              │  │
│  │    결제자: Na Kyeongtae                        │  │
│  │    [편집] [삭제]                              │  │
│  └─────────────────────────────────────────────────┘  │
│                                                           │
│  📊 정산 계산표                                          │
│  ├────────────────┬────────────────┬─────────────────┤ │
│  │ 동반자         │ 개인 지출      │ 정산액          │ │
│  ├────────────────┼────────────────┼─────────────────┤ │
│  │ Na Kyeongtae   │ ₹148,771      │ -₹74,385.50    │ │
│  │ (결제 담당)     │                │ (받을 금액)    │ │
│  ├────────────────┼────────────────┼─────────────────┤ │
│  │ Huishuwo       │ ₹0            │ +₹74,385.50   │ │
│  │ Leiyawon       │                │ (줄 금액)      │ │
│  └────────────────┴────────────────┴─────────────────┘ │
│                                                           │
│  💬 정산 지시                                            │
│  "Huishuwo Leiyawon님이 Na Kyeongtae님에게              │
│   ₹74,385.50을 송금해야 합니다."                        │
│                                                           │
│  [+ 비용 추가]                                          │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

#### Travel Detail - Checklist 탭

```
┌─────────────────────────────────────────────────────────┐
│ [Overview] [Schedule] [Costs] [Checklist] [Documents]   │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  📋 준비물 체크리스트                                   │
│  진행률: 🟢 18/32 완료 (56%)                            │
│                                                           │
│  📄 서류 (4/4 완료)                                    │
│  ☑ 여권 확인                                            │
│  ☑ 비자 확인                                            │
│  ☑ 항공권 인쇄/다운로드                                │
│  ☑ 호텔 확인 이메일 저장                                │
│                                                           │
│  💰 금융 (2/2 완료)                                    │
│  ☑ 보험 가입 확인                                       │
│  ☑ 은행 해외거래 허용 설정                              │
│  ☑ 신용카드 잔액 확인                                   │
│  ☑ 환전 (필요시)                                       │
│                                                           │
│  👕 의류 (2/7 대기)                                    │
│  ☐ 반팔 (5-6장)                                        │
│  ☐ 긴팔 (1-2장)                                        │
│  ☑ 반바지 (2-3장)                                      │
│  ☑ 정장 (저녁 식사용)                                   │
│  ☐ 속옷 (충분량)                                       │
│  ☐ 양말                                                 │
│  ☐ 신발 (편한 신발, 정장)                              │
│                                                           │
│  🧴 세면도구 (5/5 완료)                                │
│  ☑ 칫솔, 치약                                           │
│  ☑ 샴푸, 린스                                           │
│  ☑ 바디워시                                             │
│  ☑ 선크림                                               │
│  ☑ 모기약                                               │
│                                                           │
│  📱 전자기기 (3/5 대기)                                │
│  ☐ 여권 사본 (사진)                                    │
│  ☑ 항공권 (인쇄 또는 PDF)                             │
│  ☐ 카메라                                               │
│  ☑ 휴대폰 + 충전기                                     │
│  ☑ 멀티탭                                               │
│                                                           │
│  [+ 항목 추가]                                          │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

#### Travel Detail - Documents 탭

```
┌─────────────────────────────────────────────────────────┐
│ [Overview] [Schedule] [Costs] [Checklist] [Documents]   │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  📂 서류 보관소                   저장소: 10.2MB / 100MB │
│                                                           │
│  📄 비자 & 여권                                         │
│  ├─ vietnam_visa_approval.pdf (2.1 MB) 2026-04-20    │
│  │  [미리보기] [다운로드] [삭제]                      │
│  ├─ passport_copy.jpg (0.8 MB) 2026-04-15             │
│  │  [미리보기] [다운로드] [삭제]                      │
│  └─ visa_stamp_record.pdf (0.5 MB) 2026-04-20         │
│                                                           │
│  🎫 항공권                                              │
│  ├─ TR779_516_boarding_pass.pdf (1.2 MB) 2026-05-15  │
│  │  [미리보기] [다운로드] [삭제]                      │
│  └─ TR553_778_boarding_pass.pdf (1.2 MB) 2026-05-24  │
│                                                           │
│  🏨 호텔 확인                                           │
│  ├─ lumiere_booking_confirmation.pdf (3.5 MB)         │
│  │  [미리보기] [다운로드] [삭제]                      │
│  └─ hotel_receipt.jpg (0.9 MB) 2026-05-24             │
│                                                           │
│  💳 영수증                                              │
│  ├─ hotel_receipt_detailed.pdf (0.8 MB) 2026-05-24    │
│  │  [미리보기] [다운로드] [삭제]                      │
│  └─ restaurant_receipt.jpg (0.6 MB) 2026-05-21        │
│                                                           │
│  📝 기타 서류                                           │
│  (등록된 서류 없음)                                      │
│                                                           │
│  ┌─────────────────────────────────────────────────┐  │
│  │ 📤 파일 업로드                                  │  │
│  │ (드래그 앤 드롭 또는 클릭)                     │  │
│  └─────────────────────────────────────────────────┘  │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

#### Travel Detail - Notifications 탭

```
┌─────────────────────────────────────────────────────────┐
│ [Overview] [Schedule] [Costs] [Checklist] [Documents]   │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  🔔 알림 설정                                            │
│                                                           │
│  📅 자동 알림 규칙                                       │
│  ┌─────────────────────────────────────────────────┐  │
│  │ ☑ 출발 7일 전 (2026-05-08)                     │  │
│  │   여행 준비 알림 (일일 리마인더)               │  │
│  │                                                  │  │
│  │ ☑ 출발 1일 전 (2026-05-14)                     │  │
│  │   짐 확인 리마인더                              │  │
│  │                                                  │  │
│  │ ☑ 출발 24시간 전 (2026-05-15)                 │  │
│  │   최종 준비 알림                                │  │
│  │                                                  │  │
│  │ ☑ 출발 6시간 전 (2026-05-15 17:50)           │  │
│  │   공항 출발 알림                                │  │
│  │                                                  │  │
│  │ ☑ 각 일정 1시간 전                             │  │
│  │   - 항공편 TR 779/516 (2026-05-15 22:50)      │  │
│  │   - 호텔 체크인 (2026-05-16 13:00)            │  │
│  │   - 식사 OMAKASE TIGER (2026-05-21 19:00)    │  │
│  │   - 호텔 체크아웃 (2026-05-24 11:00)          │  │
│  │   - 항공편 TR 553/778 (2026-05-24 14:40)      │  │
│  │                                                  │  │
│  │ ☑ 귀국 1일 전 (2026-05-23)                     │  │
│  │   체크아웃 준비 알림                            │  │
│  └─────────────────────────────────────────────────┘  │
│                                                           │
│  📢 알림 채널                                            │
│  ☑ 인앱 알림        (실시간)                           │
│  ☑ 이메일           (asdf1390a@gmail.com)            │
│  ☑ Telegram         (Na Kyeongtae 계정)              │
│  ☐ SMS              (향후 지원)                        │
│                                                           │
│  🔧 커스텀 알림 추가                                    │
│  [+ 새 알림 규칙 추가]                                  │
│                                                           │
│  예: "체크아웃 전날 오후 3시에 알림" 등                 │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

### 2.3 모바일 반응형 설계

**모바일 (320px ~ 767px)**
- 탭 내비게이션 → 드롭다운 또는 스크롤
- 카드 레이아웃 → 풀 너비
- 캘린더 → 미니 버전 또는 목록 뷰로 전환
- 문서 업로드 → 터치 최적화

**태블릿 (768px ~ 1023px)**
- 2열 레이아웃 가능
- 캘린더 + 타임라인 사이드 배치

**데스크톱 (1024px+)**
- 3열 그리드
- 모든 정보 동시 표시

---

## 3. 사용자 흐름

### 3.1 Flow 1: 여행 생성

```
사용자가 "새 여행" 클릭
   ↓
여행 기본 정보 입력 폼
   ├─ 여행명 (예: "Ho Chi Minh City")
   ├─ 시작일 (2026-05-15)
   ├─ 종료일 (2026-05-24)
   ├─ 지역 (선택 또는 입력)
   └─ 설명 (선택사항)
   ↓
"계속" 버튼
   ↓
동반자 추가 화면
   ├─ 동반자 이메일 입력
   ├─ 동반자 역할 선택 (주도자/동반자/게스트)
   └─ 권한 설정 (조회만/편집 가능)
   ↓
"완료" 버튼
   ↓
여행 Overview 탭 표시
   ↓
사용자가 일정/비용/체크리스트 추가 시작
```

### 3.2 Flow 2: 일정 추가

```
Schedule 탭에서 "+ 이벤트 추가" 클릭
   ↓
이벤트 생성 모달
   ├─ 이벤트 타입 선택
   │  ├─ ✈️ 항공편
   │  ├─ 🏨 숙소
   │  ├─ 🍽️ 식사/예약
   │  ├─ 🚗 이동
   │  └─ 📌 기타
   ├─ 제목 (예: "항공편 TR 779/516")
   ├─ 날짜 & 시간 (2026-05-15 23:50)
   ├─ 장소 (Chennai → Ho Chi Minh City)
   ├─ 상세 정보 (편명, 항공사, 좌석 등)
   └─ 알림 설정 (예: 6시간 전)
   ↓
"저장" 버튼
   ↓
일정이 Schedule 탭에 추가됨
   ↓
타임라인에 시간순으로 정렬 표시
```

### 3.3 Flow 3: 비용 등록 및 정산

```
Costs 탭에서 "+ 비용 추가" 클릭
   ↓
비용 입력 폼
   ├─ 비용 이름 (예: "항공편")
   ├─ 금액 (₹96,050)
   ├─ 결제자 선택 (Na Kyeongtae)
   ├─ 비용 분배
   │  ├─ 균등 분할
   │  ├─ 개인별 비율 설정
   │  └─ 커스텀 분배
   ├─ 결제 방법 (카드/현금/기타)
   └─ 날짜 (2026-05-15)
   ↓
"저장" 버튼
   ↓
비용이 Costs 탭에 추가됨
   ↓
정산 계산표 자동 업데이트
   ├─ 각 사용자별 지출 합계
   ├─ 정산액 계산 (누가 누구에게 얼마를 보낼지)
   └─ 정산 상태: "아직 정산 안 됨" → "정산 완료"로 변경 가능
   ↓
사용자가 "정산 확인" 버튼으로 정산 완료 표시
```

### 3.4 Flow 4: 체크리스트 관리

```
Checklist 탭 진입
   ↓
기본 체크리스트 표시
   ├─ 서류 (여권, 비자, 항공권 등)
   ├─ 의류
   ├─ 세면도구
   ├─ 전자기기
   └─ 의약품
   ↓
사용자가 완료한 항목 체크
   ├─ 체크박스 클릭
   ├─ 메모 추가 (예: "반팔 5장 구입")
   └─ 진행률 자동 업데이트
   ↓
필요시 "+ 항목 추가"로 커스텀 항목 등록
   ├─ 항목명 입력
   ├─ 카테고리 선택 (또는 신규 카테고리)
   └─ 우선순위 설정 (선택사항)
   ↓
여행 전 모든 항목 확인 완료
```

### 3.5 Flow 5: 서류 보관

```
Documents 탭 진입
   ↓
파일 업로드 영역
   ├─ 드래그 앤 드롭으로 파일 추가
   └─ "파일 선택" 버튼으로 수동 선택
   ↓
파일 정보 입력
   ├─ 파일명 자동 감지
   ├─ 폴더 분류 선택
   │  ├─ 📄 비자 & 여권
   │  ├─ 🎫 항공권
   │  ├─ 🏨 호텔 확인
   │  ├─ 💳 영수증
   │  └─ 📝 기타
   └─ 설명 추가 (선택사항)
   ↓
"저장" 버튼
   ↓
파일이 해당 폴더에 저장됨
   ├─ 파일 크기 표시
   ├─ 업로드 날짜 표시
   └─ 저장소 용량 업데이트
   ↓
사용자가 언제든 미리보기/다운로드 가능
   ├─ PDF: 브라우저 뷰어
   ├─ 이미지: 썸네일 + 전체보기
   └─ 다운로드: 로컬 저장
```

### 3.6 Flow 6: 알림 수신

```
알림 규칙 자동 설정됨 (여행 생성 시)
   ↓
사용자가 Notifications 탭에서 활성화/비활성화 조정 가능
   ↓
정해진 시간에 알림 발송
   ├─ 출발 7일 전: 준비 알림
   ├─ 출발 1일 전: 짐 확인
   ├─ 출발 24시간 전: 최종 알림
   ├─ 출발 6시간 전: 공항 출발
   ├─ 각 이벤트 1시간 전: 개별 알림
   └─ 체크아웃 1일 전: 준비 알림
   ↓
알림 채널별 발송
   ├─ 인앱 알림 (즉시)
   ├─ 이메일 (정시)
   ├─ Telegram (정시)
   └─ SMS (향후)
   ↓
사용자가 알림 클릭 → 해당 여행으로 이동
```

---

## 4. 컴포넌트 명세

### 4.1 신규 컴포넌트

#### TravelList 컴포넌트
- **위치:** `/app/(dsc-hub)/travel`
- **역할:** 여행 목록 표시 + 필터/정렬
- **Props:**
  - `travels: Travel[]` — 여행 배열
  - `onTravelSelect: (id: string) => void` — 클릭 핸들러
  - `onTravelDelete: (id: string) => void` — 삭제 핸들러
- **상태:**
  - `filter: 'all' | 'ongoing' | 'upcoming' | 'completed'`
  - `sortBy: 'date' | 'cost' | 'name'`
- **핵심 기능:**
  - 카드 뷰: 여행명, 기간, 지역, 인원, 비용
  - 필터: 상태별 (진행중/계획/완료)
  - 정렬: 날짜순/비용순/이름순
  - 액션: 열기/편집/삭제

#### TravelDetail 컴포넌트
- **위치:** `/app/(dsc-hub)/travel/[id]`
- **역할:** 여행 상세 정보 + 탭 네비게이션
- **Props:**
  - `travelId: string` — 여행 ID
  - `travel: Travel` — 여행 객체
- **State:** 
  - `activeTab: 'overview' | 'schedule' | 'costs' | 'checklist' | 'documents' | 'notifications'`
- **하위 컴포넌트:**
  - `TravelOverview`
  - `TravelSchedule`
  - `TravelCosts`
  - `TravelChecklist`
  - `TravelDocuments`
  - `TravelNotifications`

#### TravelOverview 컴포넌트
- **역할:** 여행 기본 정보 표시
- **표시 항목:**
  - 항공편 정보 (출발/도착/항공사)
  - 숙소 정보 (이름, 주소, 체크인/아웃)
  - 인원 및 비용 (총액, 1인당 평균)
- **액션:**
  - 편집 / 공유 / 삭제

#### TravelSchedule 컴포넌트
- **역할:** 일정 관리 + 캘린더 + 타임라인
- **하위 구성:**
  - `CalendarView` — 월간 캘린더
  - `TimelineView` — 시간순 이벤트 목록
  - `EventModal` — 이벤트 추가/편집 폼
- **기능:**
  - 캘린더에서 날짜 클릭 → 해당 일정 표시
  - 타임라인에서 이벤트 추가/편집/삭제
  - 각 이벤트별 알림 설정

#### TravelCosts 컴포넌트
- **역할:** 비용 관리 + 정산 계산
- **하위 구성:**
  - `CostSummary` — 요약 (총액, 1인당 평균)
  - `CostItemList` — 비용 항목 목록
  - `SettlementTable` — 정산 계산표
  - `CostForm` — 비용 추가/편집 폼
- **기능:**
  - 비용 추가/편집/삭제
  - 정산액 자동 계산 (균등 분할)
  - 정산 상태 관리 (미정산/정산완료)

#### TravelChecklist 컴포넌트
- **역할:** 준비물 체크리스트 관리
- **하위 구성:**
  - `ChecklistCategory` — 카테고리별 항목
  - `ChecklistItem` — 개별 항목 (체크박스 + 메모)
  - `ProgressBar` — 진행률 표시
  - `AddItemForm` — 항목 추가 폼
- **기능:**
  - 카테고리별 체크리스트 표시
  - 항목 체크/언체크
  - 메모 추가
  - 진행률 자동 계산
  - 커스텀 항목 추가

#### TravelDocuments 컴포넌트
- **역할:** 서류 보관 + 파일 관리
- **하위 구성:**
  - `DocumentFolder` — 폴더별 뷰
  - `DocumentCard` — 파일 카드 (미리보기/다운로드)
  - `FileUploadArea` — 드래그 앤 드롭 영역
  - `StorageStatus` — 저장소 용량 표시
- **기능:**
  - 폴더별 파일 조직
  - 파일 미리보기/다운로드/삭제
  - 파일 업로드 (드래그 & 드롭)
  - 저장소 용량 추적

#### TravelNotifications 컴포너트
- **역할:** 알림 설정 관리
- **하위 구성:**
  - `NotificationRulesList` — 규칙 목록
  - `NotificationChannelToggle` — 채널 활성화
  - `AddRuleForm` — 커스텀 규칙 추가
- **기능:**
  - 자동 알림 규칙 활성화/비활성화
  - 알림 채널 선택 (인앱/이메일/Telegram)
  - 커스텀 규칙 추가

### 4.2 수정 컴포넌트

#### Header / Navigation
- Travel 탭 추가 (기존 Personal History, DSC FMS 옆)

#### Layout
- 6개 탭 지원 (Overview, Schedule, Costs, Checklist, Documents, Notifications)

---

## 5. DB 스키마

### 5.1 신규 테이블

#### travels 테이블
```sql
CREATE TABLE travels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  location VARCHAR(255),
  status VARCHAR(50) DEFAULT 'upcoming', -- 'upcoming', 'ongoing', 'completed'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT check_dates CHECK (end_date >= start_date)
);
```

#### travel_members 테이블
```sql
CREATE TABLE travel_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  travel_id uuid NOT NULL REFERENCES travels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  role VARCHAR(50) DEFAULT 'companion', -- 'organizer', 'companion', 'guest'
  permission VARCHAR(50) DEFAULT 'read_write', -- 'read_only', 'read_write'
  joined_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(travel_id, user_id)
);
```

#### travel_events 테이블
```sql
CREATE TABLE travel_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  travel_id uuid NOT NULL REFERENCES travels(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  event_type VARCHAR(50) NOT NULL, -- 'flight', 'hotel', 'meal', 'transport', 'other'
  event_date DATE NOT NULL,
  event_time TIME,
  location VARCHAR(255),
  description TEXT,
  details JSONB, -- flexible storage for flight/hotel specific data
  status VARCHAR(50) DEFAULT 'planned', -- 'planned', 'completed', 'cancelled'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### travel_costs 테이블
```sql
CREATE TABLE travel_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  travel_id uuid NOT NULL REFERENCES travels(id) ON DELETE CASCADE,
  payer_id uuid NOT NULL REFERENCES auth.users(id),
  title VARCHAR(255) NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'INR',
  cost_type VARCHAR(50), -- 'flight', 'accommodation', 'meal', 'transport', 'other'
  payment_method VARCHAR(50), -- 'card', 'cash', 'bank_transfer'
  cost_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### travel_cost_splits 테이블
```sql
CREATE TABLE travel_cost_splits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cost_id uuid NOT NULL REFERENCES travel_costs(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES travel_members(id) ON DELETE CASCADE,
  amount DECIMAL(12, 2) NOT NULL,
  UNIQUE(cost_id, member_id)
);
```

#### travel_checklist_items 테이블
```sql
CREATE TABLE travel_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  travel_id uuid NOT NULL REFERENCES travels(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(50), -- 'documents', 'clothing', 'toiletries', 'electronics', 'medicine', 'custom'
  is_completed BOOLEAN DEFAULT FALSE,
  notes TEXT,
  priority VARCHAR(50) DEFAULT 'medium', -- 'low', 'medium', 'high'
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### travel_documents 테이블
```sql
CREATE TABLE travel_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  travel_id uuid NOT NULL REFERENCES travels(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL, -- Supabase Storage 경로
  file_size BIGINT,
  file_type VARCHAR(50),
  document_type VARCHAR(50), -- 'visa', 'passport', 'flight_ticket', 'hotel_booking', 'receipt', 'other'
  uploaded_by uuid NOT NULL REFERENCES auth.users(id),
  uploaded_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(travel_id, file_path)
);
```

#### travel_notifications 테이블
```sql
CREATE TABLE travel_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  travel_id uuid NOT NULL REFERENCES travels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  notification_type VARCHAR(50), -- 'auto_rule', 'custom'
  title VARCHAR(255) NOT NULL,
  message TEXT,
  trigger_date DATE,
  trigger_time TIME,
  channels JSONB, -- {'in_app': true, 'email': true, 'telegram': false}
  is_sent BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### travel_notification_rules 테이블
```sql
CREATE TABLE travel_notification_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  travel_id uuid NOT NULL REFERENCES travels(id) ON DELETE CASCADE,
  rule_type VARCHAR(50), -- 'days_before_departure', 'event_time', 'checklist_reminder', 'custom'
  rule_config JSONB, -- {'days': 7, 'channels': ['in_app', 'email']}
  is_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 5.2 스키마 마이그레이션

```sql
-- 인덱스 생성
CREATE INDEX idx_travels_user_id ON travels(user_id);
CREATE INDEX idx_travel_members_travel_id ON travel_members(travel_id);
CREATE INDEX idx_travel_members_user_id ON travel_members(user_id);
CREATE INDEX idx_travel_events_travel_id ON travel_events(travel_id);
CREATE INDEX idx_travel_events_date ON travel_events(event_date);
CREATE INDEX idx_travel_costs_travel_id ON travel_costs(travel_id);
CREATE INDEX idx_travel_costs_payer_id ON travel_costs(payer_id);
CREATE INDEX idx_travel_checklist_items_travel_id ON travel_checklist_items(travel_id);
CREATE INDEX idx_travel_documents_travel_id ON travel_documents(travel_id);
CREATE INDEX idx_travel_notifications_user_id ON travel_notifications(user_id);

-- RLS 설정
ALTER TABLE travels ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_cost_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_notifications ENABLE ROW LEVEL SECURITY;

-- RLS 정책 (예시)
-- travels: 본인 또는 멤버인 여행만 조회 가능
-- travel_members: 해당 여행의 멤버만 조회 가능
-- ... 등등
```

---

## 6. API 명세

### 6.1 여행 관리 API

#### GET /api/travels
- **설명:** 사용자의 여행 목록 조회
- **쿼리 파라미터:**
  - `status` (선택): 'upcoming' | 'ongoing' | 'completed'
  - `sort_by` (선택): 'date' | 'cost' | 'name'
- **응답:**
  ```json
  {
    "data": [
      {
        "id": "uuid",
        "name": "Ho Chi Minh City",
        "start_date": "2026-05-15",
        "end_date": "2026-05-24",
        "location": "Ho Chi Minh City",
        "member_count": 2,
        "total_cost": 148771,
        "currency": "INR",
        "status": "upcoming"
      }
    ]
  }
  ```

#### POST /api/travels
- **설명:** 새 여행 생성
- **요청 본문:**
  ```json
  {
    "name": "Ho Chi Minh City",
    "start_date": "2026-05-15",
    "end_date": "2026-05-24",
    "location": "Ho Chi Minh City",
    "description": "Business trip with colleague"
  }
  ```
- **응답:** 생성된 여행 객체

#### GET /api/travels/[id]
- **설명:** 여행 상세 정보 조회
- **응답:** 전체 여행 객체 (이벤트, 비용, 멤버 포함)

#### PUT /api/travels/[id]
- **설명:** 여행 정보 수정
- **요청 본문:** 수정할 필드만

#### DELETE /api/travels/[id]
- **설명:** 여행 삭제

### 6.2 여행 멤버 API

#### POST /api/travels/[id]/members
- **설명:** 여행에 멤버 추가
- **요청 본문:**
  ```json
  {
    "user_id": "uuid",
    "role": "companion",
    "permission": "read_write"
  }
  ```

#### DELETE /api/travels/[id]/members/[member_id]
- **설명:** 여행에서 멤버 제거

### 6.3 일정 API

#### POST /api/travels/[id]/events
- **설명:** 여행에 이벤트 추가
- **요청 본문:**
  ```json
  {
    "title": "항공편 TR 779/516",
    "event_type": "flight",
    "event_date": "2026-05-15",
    "event_time": "23:50",
    "location": "Chennai → Ho Chi Minh City",
    "details": {
      "flight_number": "TR 779/516",
      "airline": "Tirupati Airways",
      "departure_airport": "CMB",
      "arrival_airport": "SGN"
    }
  }
  ```

#### GET /api/travels/[id]/events
- **설명:** 여행의 모든 이벤트 조회
- **정렬:** 날짜/시간순

#### PUT /api/travels/[id]/events/[event_id]
- **설명:** 이벤트 수정

#### DELETE /api/travels/[id]/events/[event_id]
- **설명:** 이벤트 삭제

### 6.4 비용 관리 API

#### POST /api/travels/[id]/costs
- **설명:** 여행에 비용 항목 추가
- **요청 본문:**
  ```json
  {
    "title": "항공편",
    "amount": 96050,
    "currency": "INR",
    "cost_type": "flight",
    "payer_id": "uuid",
    "cost_date": "2026-05-15",
    "splits": [
      {"member_id": "uuid1", "amount": 48025},
      {"member_id": "uuid2", "amount": 48025}
    ]
  }
  ```

#### GET /api/travels/[id]/costs
- **설명:** 여행의 모든 비용 조회

#### GET /api/travels/[id]/settlement
- **설명:** 정산 계산표 조회
- **응답:**
  ```json
  {
    "settlement": [
      {
        "member_id": "uuid1",
        "member_name": "Na Kyeongtae",
        "total_paid": 148771,
        "share": 74385.50,
        "balance": -74385.50
      },
      {
        "member_id": "uuid2",
        "member_name": "Huishuwo Leiyawon",
        "total_paid": 0,
        "share": 74385.50,
        "balance": 74385.50
      }
    ]
  }
  ```

### 6.5 체크리스트 API

#### POST /api/travels/[id]/checklist
- **설명:** 체크리스트 항목 추가
- **요청 본문:**
  ```json
  {
    "title": "여권 확인",
    "category": "documents",
    "priority": "high"
  }
  ```

#### GET /api/travels/[id]/checklist
- **설명:** 모든 체크리스트 항목 조회
- **정렬:** 카테고리별

#### PUT /api/travels/[id]/checklist/[item_id]
- **설명:** 항목 체크/언체크 또는 수정

#### DELETE /api/travels/[id]/checklist/[item_id]
- **설명:** 항목 삭제

### 6.6 문서 API

#### POST /api/travels/[id]/documents
- **설명:** 파일 업로드
- **요청:** FormData
  - `file` — 파일
  - `document_type` — 'visa' | 'passport' | 'flight_ticket' | 'hotel_booking' | 'receipt' | 'other'

#### GET /api/travels/[id]/documents
- **설명:** 업로드된 모든 문서 조회

#### DELETE /api/travels/[id]/documents/[doc_id]
- **설명:** 문서 삭제

### 6.7 알림 API

#### POST /api/travels/[id]/notifications/setup
- **설명:** 자동 알림 규칙 설정 (여행 생성 시 호출)

#### PUT /api/travels/[id]/notifications/rules/[rule_id]
- **설명:** 알림 규칙 활성화/비활성화

#### GET /api/travels/[id]/notifications
- **설명:** 여행의 모든 알림 조회

---

## 7. 엣지 케이스 & 예외처리

### 7.1 데이터 검증

| 상황 | 처리 방식 |
|------|---------|
| **종료일 < 시작일** | 폼 제출 금지 + 에러 메시지 |
| **동반자 추가 시 이미 추가된 사용자** | "이미 참여자입니다" 메시지 |
| **이벤트 추가 시 날짜가 여행 범위 밖** | 경고 메시지 + 확인 요청 |
| **비용 금액이 음수** | 폼 제출 금지 |
| **파일 크기 > 저장소 한계** | "저장소 부족" 에러 |
| **파일 형식 제한** | PDF, 이미지만 허용 (또는 특정 형식만) |

### 7.2 권한 검증

| 액션 | 권한 |
|------|------|
| **여행 생성** | 모든 인증 사용자 |
| **여행 수정/삭제** | 여행 작성자만 (organizer) |
| **이벤트 추가/수정** | organizer 또는 read_write 권한자 |
| **비용 등록** | organizer 또는 read_write 권한자 |
| **체크리스트 수정** | organizer 또는 read_write 권한자 |
| **문서 업로드/삭제** | organizer 또는 read_write 권한자 |
| **알림 설정 변경** | 각 사용자는 자신의 알림만 수정 가능 |

### 7.3 동시성 처리

| 상황 | 처리 방식 |
|------|---------|
| **동시 비용 등록** | FIFO 처리 + 낙관적 업데이트 (Optimistic UI) |
| **동시 체크리스트 수정** | Last-Write-Wins 또는 충돌 감지 후 알림 |
| **동시 파일 업로드** | 순차 처리 또는 병렬 처리 (저장소 제한 확인) |

### 7.4 예외 상황

| 상황 | 처리 방식 |
|------|---------|
| **여행 삭제 후 구성원 접근** | "삭제된 여행입니다" 메시지 |
| **문서 파일 손상** | 다운로드 실패 메시지 + 재업로드 권고 |
| **알림 발송 실패** | 자동 재시도 (3회) 후 실패 로그 기록 |
| **부분적 데이터 로드** | 로딩 상태 표시 + "새로고침" 버튼 |
| **네트워크 오류** | 자동 재연결 또는 오프라인 모드 지원 (향후) |

### 7.5 비즈니스 로직 엣지 케이스

| 상황 | 처리 방식 |
|------|---------|
| **1인 여행 (동반자 없음)** | 허용, 단 정산 없음 |
| **여행 중 멤버 추가** | 허용, 추가 날부터 비용 분담 |
| **여행 중 멤버 제거** | 허용, 제거 시 정산액 자동 계산 (제거 전까지만) |
| **환율 변동** | 저장된 금액 고정 (동적 환산 미지원, 향후 검토) |
| **비용 수정** | 이미 정산된 비용 수정 불가 (감사 추적) |
| **이미 완료된 체크리스트 항목 삭제** | 삭제 가능하되 이력 기록 |

---

## 8. 구현 체크리스트

### Phase 1: Backend & DB (1주)

- [ ] DB 마이그레이션 스크립트 작성
  - [ ] 8개 테이블 생성 (travels, members, events, costs, splits, checklist, documents, notifications)
  - [ ] 인덱스 & RLS 정책 설정
- [ ] API 엔드포인트 구현
  - [ ] 여행 CRUD (4개)
  - [ ] 멤버 관리 (2개)
  - [ ] 이벤트 CRUD (4개)
  - [ ] 비용 관리 (3개) + 정산 계산 (1개)
  - [ ] 체크리스트 CRUD (4개)
  - [ ] 문서 업로드/관리 (3개)
  - [ ] 알림 설정 (3개)
- [ ] 정산 계산 알고리즘 구현
- [ ] 알림 규칙 엔진 (Cron job)
- [ ] 파일 저장소 (Supabase Storage) 설정

### Phase 2: Frontend UI (1주)

- [ ] 컴포넌트 구조 설정
  - [ ] TravelList, TravelDetail 레이아웃
  - [ ] 6개 탭 컴포넌트
- [ ] TravelList 구현
  - [ ] 카드 뷰
  - [ ] 필터/정렬
  - [ ] CRUD 모달
- [ ] TravelOverview 구현
  - [ ] 항공편, 숙소, 인원 정보 표시
  - [ ] 수정/공유/삭제 버튼
- [ ] TravelSchedule 구현
  - [ ] 캘린더 뷰 (캘린더 라이브러리)
  - [ ] 타임라인 뷰
  - [ ] 이벤트 모달
- [ ] TravelCosts 구현
  - [ ] 비용 항목 목록
  - [ ] 정산 계산표
  - [ ] 비용 추가 폼
- [ ] TravelChecklist 구현
  - [ ] 카테고리별 항목 표시
  - [ ] 체크박스 + 메모
  - [ ] 진행률
- [ ] TravelDocuments 구현
  - [ ] 파일 업로드 (드래그 & 드롭)
  - [ ] 폴더 뷰
  - [ ] 미리보기/다운로드
- [ ] TravelNotifications 구현
  - [ ] 알림 규칙 목록 + 토글
  - [ ] 채널 선택

### Phase 3: 반응형 & 테스트 (1주)

- [ ] 모바일 반응형 디자인
  - [ ] 320px ~ 767px: 탭 드롭다운, 풀 너비 카드
  - [ ] 768px ~ 1023px: 2열 레이아웃
  - [ ] 1024px+: 3열 레이아웃
- [ ] 모바일 터치 최적화
- [ ] E2E 테스트 (여행 생성 → 일정 추가 → 비용 등록 → 정산)
- [ ] 접근성 테스트 (키보드 네비게이션, 스크린리더)
- [ ] 성능 최적화 (로딩, 번들 크기)

### Phase 4: 알림 & 배포 (1주)

- [ ] 알림 엔진 구현
  - [ ] 자동 규칙 생성 (여행 생성 시)
  - [ ] Cron job (매일 자정, 알림 체크)
  - [ ] 이메일/Telegram 발송
- [ ] 알림 대시보드 (Notifications 탭)
- [ ] 사용자 알림 선호도 저장
- [ ] 테스트 및 배포
  - [ ] Staging 환경 테스트
  - [ ] Vercel 배포

---

## 추가 고려사항

### 다국어 지원

현재 설계는 **영어**로 작성. 향후 다국어 (한국어, 타밀어) 지원 시:
- i18n 라이브러리 (next-i18next 또는 react-intl)
- 모든 레이블을 i18n 키로 변환
- 날짜 포맷 지역화
- 통화 심볼 지역화 (₹ vs ₩)

### 확장 기능 (향후)

1. **지도 통합:** 여행 경로 시각화
2. **예산 추적:** 일별 지출 그래프
3. **사진 앨범:** 여행 사진 공유
4. **공동 노트:** 여행 메모/팁 공유
5. **결제 연동:** 카드사 자동 지출 추적
6. **오프라인 모드:** 인터넷 없이 로컬 캐시 사용
7. **화상 회의:** 여행 계획 회의 (zoom/google meet 연동)

---

## 참고

- **기존 포탈 아키텍처:** `/ARCHITECTURE_DSC_HUB.md`
- **JEEPNEY 포탈 설계:** `/JEEPNEY_PORTAL_DESIGN.md`
- **Backup App 설계:** `/BACKUP_APP_PHASE2_DESIGN.md`
- **여행 계획 데이터:** `/travel_plan_2026_05_hcmc.md`

**작성자:** 플레너 (Na Kyeongtae 비서)  
**최종 수정일:** 2026-05-14  
**상태:** 웹개발자 구현 대기
