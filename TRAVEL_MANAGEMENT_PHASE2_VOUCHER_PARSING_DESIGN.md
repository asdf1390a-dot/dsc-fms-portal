# Travel Management Phase 2 — 여행 바우처 자동 파싱 설계서

> **상태:** 플레너 설계 완료 (웹개발자 구현 대기)
> **작성일:** 2026-05-14
> **작성자:** 플레너 (Phase 2 추가 기능)
> **목표:** 여행 바우처 PDF를 자동 분석하여 Travel Management 이벤트로 변환
> **연관 문서:**
> - `TRAVEL_MANAGEMENT_DESIGN.md` (Phase 1 + Phase 2 전체 설계)
> - `TRAVEL_MANAGEMENT_API_GUIDE.md` (Phase 1 API 명세)
> - `TRAVEL_MANAGEMENT_PHASE1_COMPLETE.md` (Phase 1 완료 보고)
> - `TRAVEL_MANAGEMENT_PHASE2_PLAN.md` (Phase 2 프론트엔드 계획)

---

## 📋 목차

1. [개요](#1-개요)
2. [UI/UX 설계](#2-uiux-설계)
3. [파싱 로직](#3-파싱-로직)
4. [API 설계](#4-api-설계)
5. [DB 스키마](#5-db-스키마)
6. [Integration & 워크플로우](#6-integration--워크플로우)
7. [에러 핸들링](#7-에러-핸들링)
8. [구현 체크리스트](#8-구현-체크리스트)
9. [부록 A — 9개 샘플 바우처 파싱 결과](#부록-a--9개-샘플-바우처-파싱-결과)
10. [부록 B — 정규표현식 패턴 카탈로그](#부록-b--정규표현식-패턴-카탈로그)

---

## 1. 개요

### 1.1 기능 목표

사용자가 여행사·플랫폼에서 받은 **바우처 PDF**를 일괄 업로드하면, 시스템이 자동으로:

1. **PDF 텍스트 추출** → 구조화된 데이터
2. **활동 정보 식별** → 날짜·시간·활동명·위치·인원·금액
3. **자동 이벤트 생성** → `travel_events` 테이블에 INSERT
4. **사용자 확인** → 파싱 결과 미리보기 → 수동 보정 가능
5. **확정 등록** → 한 번에 여러 이벤트가 캘린더에 반영

### 1.2 해결하려는 문제

| 현재 (수동) | 자동화 후 |
|------------|----------|
| 바우처 9장을 일일이 열어보고 | 9개 PDF를 한 번에 업로드 |
| 날짜·시간·장소를 손으로 옮겨 적음 | 시스템이 자동 추출 |
| 누락·오타·중복 입력 위험 | 자동 검증 + 중복 감지 |
| 입력 시간: 평균 30분 (9개 기준) | 입력 시간: 2분 (확인만) |

### 1.3 핵심 기능

| 기능 | 설명 | 우선순위 |
|-----|------|--------|
| **PDF 업로드** | 멀티 파일 드래그앤드롭, 최대 20MB/파일, 50개/배치 | P0 |
| **자동 파싱** | 텍스트 추출 → 활동 정보 구조화 | P0 |
| **결과 미리보기** | 추출 데이터를 테이블 형태로 확인 | P0 |
| **수동 보정** | 잘못 추출된 필드 수정 후 확정 | P0 |
| **이벤트 자동 생성** | Phase 1 `travel_events` API 호출 | P0 |
| **바우처 원본 보존** | `travel_documents`에 PDF 저장, `voucher_id` 연결 | P1 |
| **중복 감지** | 같은 날짜·시간·활동의 중복 이벤트 경고 | P1 |
| **다국어 지원** | 영어/베트남어/한국어/일본어 텍스트 처리 | P2 |
| **재파싱** | 파싱 실패 PDF 재시도, 알고리즘 개선 후 일괄 재처리 | P2 |

### 1.4 기술 스택

| 구성 요소 | 선택 | 비고 |
|----------|------|-----|
| **PDF 라이브러리** | `pdf-parse` (Node.js 서버 사이드) | 텍스트만 추출 — 빠르고 가벼움 |
| **백업 라이브러리** | `pdfjs-dist` | 텍스트 추출 실패 시 fallback |
| **OCR (선택)** | `tesseract.js` | 이미지 기반 PDF의 마지막 수단 |
| **파싱 방식** | 정규표현식 + 휴리스틱 룰 + 키워드 매칭 | LLM 미사용 (비용·지연·정확도 트레이드오프) |
| **저장소** | Supabase Storage (`travel-documents` 버킷) | Phase 1과 동일 |
| **DB** | PostgreSQL (`travel_vouchers` 신규 테이블) | Phase 1 스키마 확장 |
| **언어 감지** | `franc-min` (라이브러리) 또는 키워드 기반 휴리스틱 | 가벼운 옵션 |

### 1.5 비기능 요구사항

| 항목 | 목표치 |
|-----|-------|
| **파싱 정확도** | 텍스트 PDF: ≥90% (날짜·시간·활동명) |
| **처리 속도** | 단일 PDF (1-2 페이지): ≤3초 |
| **배치 처리** | 9개 PDF 동시 업로드: ≤30초 |
| **파일 크기 제한** | 단일 20MB, 배치 100MB |
| **언어 지원** | 영어·베트남어 (1차), 한국어·일본어 (2차) |
| **백업** | 원본 PDF는 무조건 Storage 저장 (감사용) |

---

## 2. UI/UX 설계

### 2.1 진입 지점

`Travel Detail` 페이지의 **Tab 2: Schedule** 또는 **Tab 5: Documents**에서 진입:

```
TravelDetail (/travels/[id])
│
├── Tab 1: Overview
├── Tab 2: Schedule
│   └── [+] 이벤트 추가 ▼
│       ├── 수동 입력
│       └── 🎫 바우처에서 자동 추가 ← 신규 진입점
├── Tab 3: Costs
├── Tab 4: Checklist
├── Tab 5: Documents
│   └── [+] 파일 업로드 ▼
│       ├── 일반 문서
│       └── 🎫 바우처 자동 파싱 ← 신규 진입점
└── Tab 6: Notifications
```

### 2.2 워크플로우 (4단계)

```
[Step 1] 업로드
   ↓ 사용자: 9개 PDF 드래그
   ↓ 시스템: 파일 검증 (크기, 타입)
   ↓
[Step 2] 파싱
   ↓ 시스템: 백그라운드 파싱 진행 (프로그레스바)
   ↓ 시스템: 각 PDF에서 텍스트 추출 → 활동 정보 추출
   ↓
[Step 3] 미리보기 & 보정
   ↓ 사용자: 9개 결과 카드 확인, 오류 수정
   ↓ 사용자: 중복/낮은 신뢰도 항목 검토
   ↓
[Step 4] 확정
   ↓ 사용자: "확정 등록" 클릭
   ↓ 시스템: travel_events INSERT × 9
   ↓ 시스템: travel_documents에 PDF 저장
   ↓ Schedule 탭에 즉시 반영
```

### 2.3 화면 1: 업로드 모달

**경로:** Schedule 탭 → "바우처에서 자동 추가" 클릭 시 모달 오픈

**모바일 우선 디자인 (Telegram 사용자 고려):**

```
┌──────────────────────────────────────────┐
│ 🎫 바우처 자동 파싱                  [X] │
├──────────────────────────────────────────┤
│                                          │
│  ┌──────────────────────────────────┐   │
│  │                                  │   │
│  │    📄 PDF 파일을 여기 드래그     │   │
│  │       또는 클릭해서 선택         │   │
│  │                                  │   │
│  │   (최대 20MB, 한번에 50개까지)   │   │
│  │                                  │   │
│  └──────────────────────────────────┘   │
│                                          │
│  ─────────── 또는 ──────────────         │
│                                          │
│  [📂 파일 선택]  [📸 사진 촬영]          │
│                                          │
│  💡 영어, 베트남어, 한국어 바우처 지원   │
│                                          │
│           [취소]      [업로드 시작]      │
└──────────────────────────────────────────┘
```

**상태 변화:**

```
[초기] → 드래그 영역 표시
[파일 추가됨] → 파일 목록 표시 (썸네일 + 파일명 + 크기)
[검증 실패] → 빨간 경고 ("citymetro_voucher.docx는 PDF가 아닙니다")
[업로드 시작 클릭] → 다음 단계로 전환
```

**파일 목록 (드래그 후):**

```
┌──────────────────────────────────────────┐
│  파일 9개 추가됨 (총 18.4MB)             │
├──────────────────────────────────────────┤
│  📄 voucher_citymetro_5-17.pdf  2.1MB  ✕ │
│  📄 voucher_mekong_5-18.pdf     1.8MB  ✕ │
│  📄 voucher_landmark81_5-19.pdf 2.3MB  ✕ │
│  📄 voucher_cuchi_5-20.pdf      2.0MB  ✕ │
│  📄 voucher_jjimjilbang.pdf     1.6MB  ✕ │
│  ... (4개 더)                            │
├──────────────────────────────────────────┤
│           [+ 추가]  [업로드 시작]        │
└──────────────────────────────────────────┘
```

### 2.4 화면 2: 파싱 진행 화면

**비동기 처리 시각화:**

```
┌──────────────────────────────────────────┐
│ 🎫 바우처 파싱 중...                     │
├──────────────────────────────────────────┤
│                                          │
│  ████████████████░░░░░░░░  7/9 완료      │
│                                          │
│  ✓ voucher_citymetro_5-17.pdf            │
│  ✓ voucher_mekong_5-18.pdf               │
│  ✓ voucher_landmark81_5-19.pdf           │
│  ✓ voucher_cuchi_5-20.pdf                │
│  ✓ voucher_jjimjilbang.pdf               │
│  ✓ voucher_gokart_5-21.pdf               │
│  ✓ voucher_omakase_5-21.pdf              │
│  ⏳ voucher_metashow_5-21.pdf (분석중)   │
│  ⏳ voucher_saigonprincess_5-23.pdf      │
│                                          │
│  💡 PDF당 약 2-3초 소요                  │
└──────────────────────────────────────────┘
```

**완료 시 자동으로 다음 단계로 전환.**

**부분 실패 시:**

```
✓ 7개 성공
⚠️ 2개 실패 (스캔 이미지 또는 텍스트 추출 불가)
   ↓
[다시 시도] [수동 입력으로 전환] [건너뛰기]
```

### 2.5 화면 3: 파싱 결과 미리보기 (핵심 화면)

**테이블 + 카드 하이브리드 뷰:**

```
┌──────────────────────────────────────────────────────────┐
│ 🎫 파싱 결과 확인  (9건 추출, 1건 경고)          [×]    │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  [전체 선택ㅁ] [중복 숨기기ㅁ] [신뢰도순▾]              │
│                                                          │
│ ┌────────────────────────────────────────────────────┐  │
│ │ ☑ 🚌 City Sightseeing Bus     [신뢰도 95% 🟢]      │  │
│ │    📅 2026-05-17 (Sat)  ⏰ 17:00 - 21:00           │  │
│ │    📍 Ho Chi Minh City                             │  │
│ │    💰 ₫450,000 / 2명                               │  │
│ │    📄 voucher_citymetro_5-17.pdf                   │  │
│ │    [편집 ✏️]  [이벤트 미리보기 👁]                  │  │
│ └────────────────────────────────────────────────────┘  │
│                                                          │
│ ┌────────────────────────────────────────────────────┐  │
│ │ ☑ 🚐 Mekong Delta Tour       [신뢰도 92% 🟢]       │  │
│ │    📅 2026-05-18 (Sun)  ⏰ 07:30 - 17:00           │  │
│ │    📍 My Tho, Ben Tre                              │  │
│ │    💰 ₫1,200,000 / 2명                             │  │
│ │    [편집] [미리보기]                                │  │
│ └────────────────────────────────────────────────────┘  │
│                                                          │
│ ┌────────────────────────────────────────────────────┐  │
│ │ ⚠ ☑ 🎨 Metashow                [신뢰도 68% 🟡]     │  │
│ │    📅 2026-05-21 (Wed)  ⏰ ? (시간 미상)           │  │
│ │    📍 ?                                            │  │
│ │    경고: 시간·위치 추출 실패 — 수동 입력 필요       │  │
│ │    [편집 ✏️]                                       │  │
│ └────────────────────────────────────────────────────┘  │
│                                                          │
│  ... (6개 더)                                            │
│                                                          │
├──────────────────────────────────────────────────────────┤
│  체크된 항목 9개 / 9개                                   │
│  [취소]   [모두 편집]   [확정 등록 ▶]                    │
└──────────────────────────────────────────────────────────┘
```

**신뢰도 색상 코드:**
- 🟢 90-100%: 자동 등록 안전 — 사용자 확인 가벼움
- 🟡 70-89%: 일부 필드 누락/모호 — 사용자 검토 권장
- 🔴 <70%: 다수 필드 실패 — 수동 보정 필수

**경고 종류:**
- ⚠️ 필드 누락 (시간/위치/금액)
- 🔁 중복 의심 (이미 등록된 이벤트와 충돌)
- ❓ 모호한 날짜 형식 (예: `05/06/2026`이 May 6인지 June 5인지)
- 💱 통화 단위 미상

### 2.6 화면 4: 항목 편집 모달

**개별 항목 클릭 시 인라인 또는 모달:**

```
┌──────────────────────────────────────────┐
│ ✏️ 이벤트 편집                       [×] │
├──────────────────────────────────────────┤
│                                          │
│  [PDF 원본 미리보기]  [추출 텍스트]      │
│                                          │
│  활동명:    [City Sightseeing Bus    ]   │
│  타입:      [🚌 Transport          ▾]   │
│  날짜:      [2026-05-17       📅]        │
│  시작 시간: [17:00     ⏰] - [21:00]     │
│  위치:      [Ho Chi Minh City       ]   │
│  설명:                                   │
│  ┌────────────────────────────────────┐  │
│  │ 4-hour open-top bus tour with     │  │
│  │ guided commentary. Pickup 16:45.  │  │
│  └────────────────────────────────────┘  │
│                                          │
│  추가 정보 (JSONB):                      │
│  - Booking ref: CMT-2026-051712          │
│  - Pickup point: Lumiere lobby           │
│  - Pax: 2 adults                         │
│  - Price: ₫450,000                       │
│                                          │
│           [되돌리기]   [저장]            │
└──────────────────────────────────────────┘
```

**원본 텍스트 표시 영역 (디버깅·검증용):**

```
─── 추출된 원본 텍스트 ───
CITY SIGHTSEEING HO CHI MINH
Booking Confirmation #CMT-2026-051712
─────────────────────────
Date: 17/05/2026 (Saturday)
Time: 17:00 - 21:00
Pickup: Lumiere Riverside Hotel
Pax: 2 Adults
Total: 450,000 VND
─────────────────────────
Activity: 4-hour Open-Top Bus Tour
Includes audio guide in English/Korean
```

### 2.7 화면 5: 확정 등록 후 결과

```
┌──────────────────────────────────────────┐
│ ✅ 등록 완료                             │
├──────────────────────────────────────────┤
│                                          │
│   9개 이벤트가 일정에 추가되었습니다.     │
│                                          │
│   ✓ 5/17 City Sightseeing Bus           │
│   ✓ 5/18 Mekong Delta Tour              │
│   ✓ 5/19 Landmark 81 Skyview            │
│   ✓ 5/20 Cu Chi Tunnels                 │
│   ✓ 5/20 Jjimjilbang                    │
│   ✓ 5/21 Go Kart                        │
│   ✓ 5/21 OMAKASE TIGER                  │
│   ✓ 5/21 Metashow                       │
│   ✓ 5/23 Saigon Princess Cruise         │
│                                          │
│   원본 바우처 9개는 Documents 탭에        │
│   자동 저장되었습니다.                    │
│                                          │
│       [스케줄 보기]   [닫기]             │
└──────────────────────────────────────────┘
```

### 2.8 컴포넌트 명세 (Phase 2 신규)

| 컴포넌트 | 경로 | 책임 |
|---------|------|------|
| `VoucherUploadModal` | `components/travels/VoucherUploadModal.tsx` | Step 1 (업로드) UI |
| `VoucherParsingProgress` | `components/travels/VoucherParsingProgress.tsx` | Step 2 (진행) UI |
| `VoucherPreviewList` | `components/travels/VoucherPreviewList.tsx` | Step 3 (결과 목록) |
| `VoucherPreviewCard` | `components/travels/VoucherPreviewCard.tsx` | Step 3 (개별 카드) |
| `VoucherEditModal` | `components/travels/VoucherEditModal.tsx` | Step 3 (편집 모달) |
| `VoucherConfirmResult` | `components/travels/VoucherConfirmResult.tsx` | Step 4 (완료 화면) |
| `useVoucherParser` (hook) | `hooks/useVoucherParser.ts` | API 호출 + 상태 관리 |

### 2.9 모바일 반응형 (Telegram WebApp 고려)

- 카드는 세로 1열로 스택
- 편집 모달은 풀스크린 슬라이드업
- 드래그앤드롭 대신 파일 선택 버튼 우선
- PDF 미리보기는 새 탭에서 오픈 (성능 부담)

---

## 3. 파싱 로직

### 3.1 전체 파이프라인

```
[PDF 파일]
   ↓
[Step 1] PDF → 텍스트 추출 (pdf-parse)
   ↓ 실패 시 fallback (pdfjs-dist)
   ↓ 텍스트가 거의 없으면 → OCR (tesseract.js)
   ↓
[Step 2] 텍스트 전처리 (공백/줄바꿈 정규화, 유니코드 정규화)
   ↓
[Step 3] 언어 감지 (영어/베트남어/한국어/일본어)
   ↓
[Step 4] 활동 유형 감지 (키워드 매칭)
   ↓
[Step 5] 필드 추출 (정규표현식 + 휴리스틱)
   ├── 날짜
   ├── 시간 (시작·종료)
   ├── 활동명
   ├── 위치
   ├── 인원
   ├── 금액·통화
   └── 예약 번호
   ↓
[Step 6] 정규화 (날짜 ISO 변환, 통화 코드화)
   ↓
[Step 7] 신뢰도 점수 계산
   ↓
[Step 8] 결과 JSON 반환
```

### 3.2 Step 1 — PDF 텍스트 추출

**Primary: `pdf-parse`**

```ts
import pdf from 'pdf-parse';

async function extractText(buffer: Buffer): Promise<string> {
  const data = await pdf(buffer);
  return data.text;
}
```

**Fallback chain:**

| 시도 | 라이브러리 | 조건 |
|------|----------|------|
| 1차 | `pdf-parse` | 기본 |
| 2차 | `pdfjs-dist` | pdf-parse 빈 결과 또는 에러 |
| 3차 | `tesseract.js` (OCR) | 텍스트 길이 < 50자 (이미지 PDF) |

**OCR은 별도 큐로 분리** (3-10초 소요, 동기 요청 부담).

### 3.3 Step 2 — 텍스트 전처리

```ts
function preprocess(raw: string): string {
  return raw
    // 줄바꿈 정규화
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // 다중 공백 → 단일 공백
    .replace(/[ \t]+/g, ' ')
    // 다중 줄바꿈 → 이중 줄바꿈
    .replace(/\n{3,}/g, '\n\n')
    // 유니코드 정규화 (NFC: 결합 문자 → 단일 코드포인트)
    .normalize('NFC')
    // PDF 특수문자 정리
    .replace(/[​-‍﻿]/g, '')  // zero-width chars
    .trim();
}
```

### 3.4 Step 3 — 언어 감지

**경량 휴리스틱 (라이브러리 없이도 가능):**

```ts
function detectLanguage(text: string): 'en' | 'vi' | 'ko' | 'ja' | 'unknown' {
  // 한국어: 한글 음절 범위
  if (/[가-힯]/.test(text)) return 'ko';
  // 일본어: 히라가나/가타카나
  if (/[぀-ゟ゠-ヿ]/.test(text)) return 'ja';
  // 베트남어: 특수 모음 (ặ, ế, ơ, ư 등)
  if (/[ăâđêôơưặếốớứ]/i.test(text)) return 'vi';
  // ASCII 라틴 위주면 영어로 가정
  if (/[a-zA-Z]/.test(text)) return 'en';
  return 'unknown';
}
```

`franc-min` 라이브러리를 쓰면 더 정확하지만, 4개 언어만 구분하면 위 방식이 충분.

### 3.5 Step 4 — 활동 유형 감지

**키워드 사전 (다국어):**

```ts
const ACTIVITY_KEYWORDS = {
  transport: {
    en: ['bus', 'metro', 'taxi', 'transfer', 'shuttle', 'pickup', 'transport'],
    vi: ['xe buýt', 'tàu', 'di chuyển', 'đưa đón'],
    ko: ['버스', '셔틀', '교통', '픽업'],
    ja: ['バス', 'シャトル', '送迎']
  },
  hotel: {
    en: ['hotel', 'check-in', 'check-out', 'accommodation', 'stay', 'lodge', 'room'],
    vi: ['khách sạn', 'lưu trú', 'nhận phòng', 'trả phòng'],
    ko: ['호텔', '체크인', '체크아웃', '숙소'],
    ja: ['ホテル', 'チェックイン', '宿泊']
  },
  meal: {
    en: ['dinner', 'lunch', 'breakfast', 'restaurant', 'omakase', 'buffet', 'cuisine'],
    vi: ['ăn tối', 'ăn trưa', 'nhà hàng', 'bữa ăn'],
    ko: ['저녁', '점심', '아침', '식당', '레스토랑'],
    ja: ['ディナー', 'ランチ', 'レストラン', '懐石']
  },
  flight: {
    en: ['flight', 'airline', 'boarding', 'departure', 'arrival', 'airport'],
    vi: ['chuyến bay', 'sân bay', 'hãng hàng không'],
    ko: ['항공', '비행', '공항', '탑승'],
    ja: ['フライト', '航空', '空港']
  },
  // 'other'로 분류되는 활동 (관광, 액티비티 등)
  activity: {
    en: ['tour', 'sightseeing', 'cruise', 'spa', 'sauna', 'exhibition',
         'kart', 'archery', 'tunnel', 'skyview', 'tower', 'museum'],
    vi: ['du lịch', 'tham quan', 'tour', 'triển lãm'],
    ko: ['투어', '관광', '크루즈', '전시', '찜질방'],
    ja: ['ツアー', '観光', 'クルーズ']
  }
};

function detectEventType(text: string, lang: string): EventType {
  const lower = text.toLowerCase();
  const scores: Record<string, number> = {
    flight: 0, hotel: 0, meal: 0, transport: 0, activity: 0
  };

  for (const [type, dict] of Object.entries(ACTIVITY_KEYWORDS)) {
    const keywords = dict[lang] || dict.en;
    for (const kw of keywords) {
      if (lower.includes(kw.toLowerCase())) {
        scores[type] += 1;
      }
    }
  }

  const top = Object.entries(scores).sort(([,a],[,b]) => b - a)[0];
  if (top[1] === 0) return 'other';
  // 'activity'는 DB enum에 없으므로 'other'로 매핑
  return top[0] === 'activity' ? 'other' : top[0] as EventType;
}
```

**이모지 결정 룰 (UI 표시용):**

```ts
const ACTIVITY_ICONS = {
  flight: '✈️',
  hotel: '🏨',
  meal: '🍽',
  transport: '🚌',
  other_tour: '🗺',
  other_cruise: '🚢',
  other_spa: '💆',
  other_exhibition: '🎨',
  other_sport: '⛳',
  other: '📌'
};
```

### 3.6 Step 5a — 날짜 추출

**다양한 포맷 처리:**

```ts
const DATE_PATTERNS = [
  // ISO 8601
  /\b(\d{4})-(\d{2})-(\d{2})\b/g,
  // DD/MM/YYYY (유럽·아시아)
  /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g,
  // DD-MM-YYYY
  /\b(\d{1,2})-(\d{1,2})-(\d{4})\b/g,
  // DD Month YYYY (e.g., "17 May 2026", "17th May 2026")
  /\b(\d{1,2})(?:st|nd|rd|th)?\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{4})\b/gi,
  // Month DD, YYYY (e.g., "May 17, 2026")
  /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2}),?\s+(\d{4})\b/gi,
  // YYYY년 MM월 DD일 (Korean)
  /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/g,
  // YYYY年MM月DD日 (Japanese)
  /(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日/g,
  // Vietnamese: "ngày 17 tháng 5 năm 2026"
  /ngày\s*(\d{1,2})\s*tháng\s*(\d{1,2})\s*năm\s*(\d{4})/gi,
];

interface ExtractedDate {
  date: string;  // ISO YYYY-MM-DD
  confidence: number;  // 0.0 - 1.0
  raw: string;  // 원본 텍스트
  ambiguous?: boolean;  // DD/MM vs MM/DD 모호
}

function extractDate(text: string, lang: string): ExtractedDate | null {
  // 명시적 ISO 우선
  const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) {
    return { date: iso[0], confidence: 1.0, raw: iso[0] };
  }

  // DD/MM/YYYY (베트남·인도·한국 모두 이 방식 우선)
  const slash = text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (slash) {
    const [, d, m, y] = slash;
    const dd = parseInt(d), mm = parseInt(m);

    // 둘 다 12 이하면 모호 (DD/MM vs MM/DD)
    const ambiguous = dd <= 12 && mm <= 12 && dd !== mm;

    // 한국·일본은 YYYY/MM/DD가 일반적이나 바우처에서는 드묾
    // 베트남·영국·인도는 DD/MM/YYYY
    return {
      date: `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`,
      confidence: ambiguous ? 0.7 : 0.95,
      raw: slash[0],
      ambiguous
    };
  }

  // "17 May 2026"
  const monthName = text.match(
    /\b(\d{1,2})(?:st|nd|rd|th)?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})\b/i
  );
  if (monthName) {
    const months: Record<string, string> = {
      jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',
      jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'
    };
    const [, d, mStr, y] = monthName;
    const m = months[mStr.toLowerCase().slice(0,3)];
    return {
      date: `${y}-${m}-${d.padStart(2,'0')}`,
      confidence: 0.98,
      raw: monthName[0]
    };
  }

  // 한국어
  if (lang === 'ko') {
    const ko = text.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
    if (ko) {
      const [, y, m, d] = ko;
      return {
        date: `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`,
        confidence: 1.0,
        raw: ko[0]
      };
    }
  }

  return null;
}
```

**모호 케이스 처리:**
- `05/06/2026`: 사용자에게 "May 6 or June 5?" 확인 UI 노출
- 컨텍스트 힌트 활용: 여행 기간이 May 15-24면 May 17이 명확

### 3.7 Step 5b — 시간 추출

```ts
const TIME_PATTERNS = [
  // 24h: HH:MM, HH:MM-HH:MM, HH:MM ~ HH:MM
  /\b(\d{1,2}):(\d{2})\b/g,
  // 12h: 5:30 PM, 5:30pm
  /\b(\d{1,2}):(\d{2})\s*(am|pm|AM|PM)\b/g,
  // Hour only: 5pm, 5 pm
  /\b(\d{1,2})\s*(am|pm|AM|PM)\b/g,
];

interface ExtractedTime {
  startTime?: string;  // HH:MM (24h)
  endTime?: string;
  confidence: number;
}

function extractTime(text: string): ExtractedTime {
  // 1) Range with dash/hyphen/tilde: "17:00 - 21:00"
  const range = text.match(
    /\b(\d{1,2}):(\d{2})\s*(?:am|pm|AM|PM)?\s*[-–~~]\s*(\d{1,2}):(\d{2})\s*(?:am|pm|AM|PM)?/
  );
  if (range) {
    return {
      startTime: `${range[1].padStart(2,'0')}:${range[2]}`,
      endTime: `${range[3].padStart(2,'0')}:${range[4]}`,
      confidence: 0.95
    };
  }

  // 2) "Pickup at 16:45" / "Start: 07:30"
  const start = text.match(
    /(?:pickup|start|begin|departure|시작|출발).*?(\d{1,2}):(\d{2})/i
  );
  if (start) {
    return {
      startTime: `${start[1].padStart(2,'0')}:${start[2]}`,
      confidence: 0.85
    };
  }

  // 3) Single time
  const single = text.match(/\b(\d{1,2}):(\d{2})\b/);
  if (single) {
    return {
      startTime: `${single[1].padStart(2,'0')}:${single[2]}`,
      confidence: 0.6
    };
  }

  // 4) "8pm dinner"
  const m12 = text.match(/\b(\d{1,2})\s*(am|pm)\b/i);
  if (m12) {
    let hr = parseInt(m12[1]);
    if (m12[2].toLowerCase() === 'pm' && hr < 12) hr += 12;
    if (m12[2].toLowerCase() === 'am' && hr === 12) hr = 0;
    return {
      startTime: `${hr.toString().padStart(2,'0')}:00`,
      confidence: 0.7
    };
  }

  return { confidence: 0 };
}
```

### 3.8 Step 5c — 활동명·위치 추출

**활동명은 PDF 제목 또는 첫 굵은 줄에 있는 경우가 많음:**

```ts
function extractTitle(text: string): { title: string; confidence: number } {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // 1) 첫 5줄 중 모두 대문자이고 5단어 이하인 줄 (제목 가능성)
  for (const line of lines.slice(0, 5)) {
    if (line === line.toUpperCase() && line.split(' ').length <= 6 && line.length > 3) {
      return { title: titleCase(line), confidence: 0.9 };
    }
  }

  // 2) "Activity:", "Tour:", "Service:" 같은 라벨 뒤
  const labeled = text.match(
    /(?:activity|tour|service|product|experience|title|name)\s*[::]\s*(.+?)(?:\n|$)/i
  );
  if (labeled) {
    return { title: labeled[1].trim(), confidence: 0.85 };
  }

  // 3) 첫 줄 (보통 PDF 제목)
  if (lines.length > 0) {
    return { title: lines[0], confidence: 0.6 };
  }

  return { title: '(제목 없음)', confidence: 0 };
}

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}
```

**위치 추출:**

```ts
function extractLocation(text: string): { location: string; confidence: number } {
  // 1) "Location:", "Address:", "Venue:", "Pickup:"
  const labeled = text.match(
    /(?:location|address|venue|pickup\s*(?:point|location)?|meeting\s*point)\s*[::]\s*(.+?)(?:\n|$)/i
  );
  if (labeled) {
    return { location: labeled[1].trim().slice(0, 200), confidence: 0.9 };
  }

  // 2) 알려진 지명 매칭
  const VIETNAM_PLACES = [
    'Ho Chi Minh', 'Saigon', 'Hanoi', 'Da Nang', 'Nha Trang',
    'Hoi An', 'Hue', 'My Tho', 'Ben Tre', 'Mekong', 'Cu Chi',
    'Phu Quoc', 'Dalat', 'Sapa', 'District 1', 'District 2'
  ];
  for (const place of VIETNAM_PLACES) {
    if (text.toLowerCase().includes(place.toLowerCase())) {
      return { location: place, confidence: 0.75 };
    }
  }

  return { location: '', confidence: 0 };
}
```

### 3.9 Step 5d — 금액·통화 추출

```ts
const CURRENCY_PATTERNS = [
  // 베트남 동
  { code: 'VND', pattern: /(?:₫|VND|đồng)\s*([\d,.\s]+)/i, scale: 1 },
  { code: 'VND', pattern: /([\d,.\s]+)\s*(?:₫|VND|đồng)/i, scale: 1 },
  // 미국 달러
  { code: 'USD', pattern: /(?:\$|USD)\s*([\d,.\s]+)/i, scale: 1 },
  // 한국 원
  { code: 'KRW', pattern: /(?:₩|KRW|원)\s*([\d,.\s]+)/i, scale: 1 },
  // 일본 엔
  { code: 'JPY', pattern: /(?:¥|JPY|円)\s*([\d,.\s]+)/i, scale: 1 },
  // 인도 루피
  { code: 'INR', pattern: /(?:₹|INR|Rs\.?)\s*([\d,.\s]+)/i, scale: 1 },
];

interface ExtractedAmount {
  amount: number;
  currency: string;
  confidence: number;
  raw: string;
}

function extractAmount(text: string): ExtractedAmount | null {
  // 1) "Total: XXX VND" 같은 라벨 우선
  const totalLabel = text.match(
    /(?:total|grand\s*total|amount|price|cost|payable|합계|총액)\s*[::]?\s*(?:₫|VND|đồng|\$|USD|₩|KRW|원|¥|JPY|₹|INR|Rs\.?)?\s*([\d,]+(?:\.\d+)?)\s*(VND|USD|KRW|JPY|INR|đồng|đ|₫|\$|₩|¥|₹)?/i
  );

  if (totalLabel) {
    const amount = parseFloat(totalLabel[1].replace(/,/g, ''));
    const currencyRaw = totalLabel[2]?.toUpperCase() || '';
    let currency = 'VND'; // 베트남 기본
    if (/USD|\$/.test(currencyRaw)) currency = 'USD';
    if (/KRW|₩|원/.test(currencyRaw)) currency = 'KRW';
    if (/JPY|¥|円/.test(currencyRaw)) currency = 'JPY';
    if (/INR|₹|RS/.test(currencyRaw)) currency = 'INR';
    return { amount, currency, confidence: 0.9, raw: totalLabel[0] };
  }

  // 2) 정규식 순차 시도
  for (const cur of CURRENCY_PATTERNS) {
    const m = text.match(cur.pattern);
    if (m) {
      const amount = parseFloat(m[1].replace(/[,\s]/g, ''));
      if (!isNaN(amount) && amount > 0) {
        return { amount, currency: cur.code, confidence: 0.8, raw: m[0] };
      }
    }
  }

  return null;
}
```

### 3.10 Step 5e — 인원·예약번호

```ts
function extractPax(text: string): { pax: number; confidence: number } {
  // "2 adults", "Pax: 2", "2 명", "2인"
  const pax = text.match(
    /(?:pax|adults?|persons?|guests?|people|명|인)\s*[::]?\s*(\d+)|(\d+)\s*(?:pax|adults?|persons?|guests?|people|명|인)/i
  );
  if (pax) {
    const n = parseInt(pax[1] || pax[2]);
    return { pax: n, confidence: 0.85 };
  }
  return { pax: 1, confidence: 0.3 };  // 기본 1명
}

function extractBookingRef(text: string): string | null {
  // "Booking #ABC123", "Ref: XYZ-789", "Confirmation: 12345"
  const m = text.match(
    /(?:booking\s*(?:reference|ref|#|no\.?|number|id)?|confirmation\s*(?:#|no\.?|number)?|예약\s*번호)\s*[::#]?\s*([A-Z0-9\-]{4,20})/i
  );
  return m ? m[1] : null;
}
```

### 3.11 Step 6 — 정규화

```ts
function normalize(parsed: RawParsedVoucher): NormalizedVoucher {
  return {
    event_type: parsed.eventType,
    event_date: parsed.date?.date || null,
    event_time: parsed.time?.startTime || null,
    end_time: parsed.time?.endTime || null,
    title: parsed.title.title.slice(0, 255),  // VARCHAR(255) 제한
    location: parsed.location.location.slice(0, 255),
    description: parsed.rawText.slice(0, 5000),
    details: {
      pax: parsed.pax.pax,
      booking_ref: parsed.bookingRef,
      amount: parsed.amount?.amount,
      currency: parsed.amount?.currency,
      source: 'voucher_auto_parse',
      voucher_id: parsed.voucherId,
      raw_text: parsed.rawText,
    },
    status: 'planned',
  };
}
```

### 3.12 Step 7 — 신뢰도 점수

```ts
function calculateConfidence(parsed: RawParsedVoucher): number {
  const weights = {
    date: 0.30,      // 가장 중요
    time: 0.20,
    title: 0.20,
    location: 0.15,
    eventType: 0.10,
    amount: 0.05,    // 금액은 보조 (없어도 OK)
  };

  let score = 0;
  score += (parsed.date?.confidence || 0) * weights.date;
  score += ((parsed.time?.confidence || 0)) * weights.time;
  score += (parsed.title.confidence) * weights.title;
  score += (parsed.location.confidence) * weights.location;
  score += (parsed.eventTypeConfidence) * weights.eventType;
  score += (parsed.amount?.confidence || 0) * weights.amount;

  return Math.round(score * 100) / 100;
}
```

**색상 임계값:**
- ≥ 0.85: 🟢 high
- 0.65 - 0.84: 🟡 medium
- < 0.65: 🔴 low

### 3.13 Step 8 — 결과 JSON 구조

```ts
interface ParsedVoucherResult {
  voucher_id: string;        // 임시 UUID (확정 전)
  file_name: string;
  file_size: number;

  // 파싱 결과
  parsed: {
    title: string;
    event_type: 'flight' | 'hotel' | 'meal' | 'transport' | 'other';
    event_date: string | null;  // YYYY-MM-DD
    event_time: string | null;  // HH:MM
    end_time: string | null;
    location: string;
    description: string;
    details: {
      pax: number;
      booking_ref: string | null;
      amount: number | null;
      currency: string | null;
      icon_hint: string;
    };
  };

  // 메타
  meta: {
    language: 'en' | 'vi' | 'ko' | 'ja' | 'unknown';
    confidence: number;       // 0.0 - 1.0
    confidence_level: 'high' | 'medium' | 'low';
    warnings: string[];       // ['ambiguous_date', 'missing_time', ...]
    raw_text: string;
    parsing_time_ms: number;
  };

  // 원본 PDF (Supabase Storage path)
  storage_path: string;
}
```

### 3.14 다국어 처리 전략

| 언어 | 특이사항 | 대응 |
|------|--------|-----|
| **영어** | 가장 일반적 (Klook, Viator, Booking.com) | 1차 지원, 풍부한 정규식 |
| **베트남어** | 현지 운영사 (Saigon Princess, Mekong tour) | 키워드 사전, đ/₫ 통화 |
| **한국어** | 한인 운영 (찜질방, 한국식당) | 한글 정규식, ₩ 통화 |
| **일본어** | 일본 셰프 식당 (OMAKASE TIGER) | 키워드 사전, ¥ 통화 |

**언어가 섞인 PDF (이중 언어 바우처):**
- 영어 부분을 우선 파싱 (정확도 ↑)
- 보조 필드는 현지어에서 추출 가능

### 3.15 휴리스틱 보강 룰

| 룰 | 설명 | 예시 |
|----|-----|-----|
| **시간 컨텍스트** | "Dinner" 키워드 있고 시간만 추출됐다면 PM 가정 | "Reservation at 8" → 20:00 |
| **여행 기간 매칭** | 추출된 날짜가 여행 기간 밖이면 경고 | 5/30 추출 (여행은 5/15-24) → 경고 |
| **활동→타입 우선순위** | meal vs transport 동시 키워드면 컨텍스트 점수 | "Dinner cruise" → meal+other |
| **위치 컨텍스트** | 한 PDF의 모든 활동은 같은 도시일 가능성 | Ho Chi Minh 누락이면 여행 기본 location |
| **PDF 파일명 힌트** | 파일명에서 날짜·활동 추출 보조 | `voucher_5-17_citymetro.pdf` → 5/17 |

```ts
function applyHeuristics(parsed: RawParsedVoucher, travel: Travel, fileName: string) {
  // 파일명에서 날짜 보강
  if (!parsed.date) {
    const fileDate = fileName.match(/(\d{1,2})[-_](\d{1,2})/);
    if (fileDate && travel.start_date) {
      const [, m, d] = fileDate;
      const year = new Date(travel.start_date).getFullYear();
      parsed.date = {
        date: `${year}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`,
        confidence: 0.5,
        raw: fileName
      };
    }
  }

  // 위치 보강: 여행 기본 location
  if (!parsed.location.location && travel.location) {
    parsed.location = {
      location: travel.location,
      confidence: 0.4
    };
  }

  // 시간 컨텍스트 보정
  if (parsed.title.title.toLowerCase().includes('dinner') &&
      parsed.time?.startTime &&
      parsed.time.startTime < '12:00') {
    // 아침 시간으로 잡힌 dinner → PM으로 보정
    const [h, m] = parsed.time.startTime.split(':');
    const newH = (parseInt(h) + 12).toString().padStart(2, '0');
    parsed.time.startTime = `${newH}:${m}`;
    parsed.time.confidence *= 0.9;  // 보정으로 신뢰도 약간 감소
  }
}
```

---

## 4. API 설계

### 4.1 신규 엔드포인트 요약

| 메서드 | 경로 | 역할 | 인증 |
|------|------|------|------|
| `POST` | `/api/travels/[id]/vouchers/upload` | PDF 업로드 (multipart) | required |
| `POST` | `/api/travels/[id]/vouchers/parse` | 업로드된 PDF 파싱 | required |
| `GET` | `/api/travels/[id]/vouchers` | 바우처 목록 | required |
| `GET` | `/api/travels/[id]/vouchers/[voucherId]` | 단일 바우처 상세 | required |
| `PUT` | `/api/travels/[id]/vouchers/[voucherId]` | 파싱 결과 수정 | required |
| `POST` | `/api/travels/[id]/vouchers/[voucherId]/confirm` | 이벤트로 확정 | required |
| `POST` | `/api/travels/[id]/vouchers/batch-confirm` | 일괄 확정 | required |
| `DELETE` | `/api/travels/[id]/vouchers/[voucherId]` | 바우처 삭제 | required |

### 4.2 POST `/api/travels/[id]/vouchers/upload`

**입력 (multipart/form-data):**

```
files[]: File[]  (1~50개, 각 ≤20MB)
```

**처리:**

1. 권한 확인 (`hasWriteAccess()`)
2. 파일 검증 (MIME, size)
3. Supabase Storage 업로드 (`travel-documents/[travel_id]/vouchers/`)
4. `travel_vouchers` 행 INSERT (status='uploaded')
5. 비동기 파싱 큐 enqueue (또는 동기 응답으로 파싱 결과 포함 — 옵션 B)

**응답 (200 OK):**

```json
{
  "ok": true,
  "data": {
    "vouchers": [
      {
        "id": "uuid-1",
        "file_name": "voucher_citymetro_5-17.pdf",
        "file_size": 2150400,
        "storage_path": "travel-documents/{travel_id}/vouchers/uuid-1.pdf",
        "status": "uploaded",
        "created_at": "2026-05-14T10:00:00Z"
      },
      ...
    ]
  }
}
```

**에러:**
- 401: 미인증
- 403: write 권한 없음
- 413: 파일 크기 초과
- 415: PDF가 아님

### 4.3 POST `/api/travels/[id]/vouchers/parse`

**입력 (JSON):**

```json
{
  "voucher_ids": ["uuid-1", "uuid-2", ...],  // optional, 미지정 시 모든 'uploaded'
  "force_reparse": false                      // optional, 이미 'parsed' 항목 재파싱
}
```

**처리:**

1. 권한 확인
2. 각 voucher 순회:
   - Storage에서 PDF 다운로드
   - `pdf-parse`로 텍스트 추출
   - 파싱 파이프라인 실행
   - `parsed_data` JSONB 업데이트
   - status='parsed' 또는 'parse_failed'
3. 응답으로 전체 결과 반환

**응답 (200 OK):**

```json
{
  "ok": true,
  "data": {
    "summary": {
      "total": 9,
      "succeeded": 8,
      "failed": 1,
      "avg_confidence": 0.87
    },
    "results": [
      {
        "id": "uuid-1",
        "status": "parsed",
        "parsed": {
          "title": "City Sightseeing Bus",
          "event_type": "transport",
          "event_date": "2026-05-17",
          "event_time": "17:00",
          "end_time": "21:00",
          "location": "Ho Chi Minh City",
          "description": "4-hour Open-Top Bus Tour...",
          "details": {
            "pax": 2,
            "booking_ref": "CMT-2026-051712",
            "amount": 450000,
            "currency": "VND",
            "icon_hint": "🚌"
          }
        },
        "meta": {
          "language": "en",
          "confidence": 0.95,
          "confidence_level": "high",
          "warnings": [],
          "parsing_time_ms": 1240
        }
      },
      ...
    ]
  }
}
```

**비동기 옵션 (큐 사용 시):**

```json
{
  "ok": true,
  "data": {
    "job_id": "parse-job-uuid",
    "status": "queued",
    "poll_url": "/api/travels/[id]/vouchers/jobs/parse-job-uuid"
  }
}
```

### 4.4 PUT `/api/travels/[id]/vouchers/[voucherId]`

**입력:**

```json
{
  "parsed_data": {
    "title": "City Sightseeing Bus (Open-Top)",
    "event_type": "transport",
    "event_date": "2026-05-17",
    "event_time": "16:45",
    "end_time": "21:00",
    "location": "Lumiere Riverside Hotel, HCMC",
    "description": "Pickup 16:45, tour starts 17:00.",
    "details": {
      "pax": 2,
      "booking_ref": "CMT-2026-051712",
      "amount": 450000,
      "currency": "VND"
    }
  }
}
```

**처리:**
- 권한 확인
- `travel_vouchers.parsed_data` 업데이트
- `user_corrected` flag = true
- 응답: 업데이트된 행

### 4.5 POST `/api/travels/[id]/vouchers/[voucherId]/confirm`

**입력 (선택):**

```json
{
  "create_cost": true,        // 동시에 cost 생성 여부
  "cost_payer_id": "user-uuid",  // 결제자 (기본: 현재 사용자)
  "cost_currency_override": "INR"  // 환율 변환 (옵션)
}
```

**처리:**

1. 권한 확인
2. `travel_vouchers.parsed_data`를 읽어
3. `travel_events` INSERT:
   ```sql
   INSERT INTO travel_events
     (travel_id, title, event_type, event_date, event_time, location, description, details, status)
   VALUES (...)
   ```
4. `travel_vouchers.event_id = <new_event_id>`, status='confirmed'
5. (옵션) `travel_costs` INSERT (`create_cost=true`인 경우)
6. (옵션) `travel_documents`에 PDF를 voucher type으로 INSERT (이미 storage에 있음)

**응답:**

```json
{
  "ok": true,
  "data": {
    "voucher": { "id": "uuid-1", "status": "confirmed", "event_id": "event-uuid" },
    "event": { "id": "event-uuid", "title": "City Sightseeing Bus", ... },
    "cost": { "id": "cost-uuid", "amount": 450000, ... }  // create_cost=true 시
  }
}
```

### 4.6 POST `/api/travels/[id]/vouchers/batch-confirm`

**입력:**

```json
{
  "voucher_ids": ["uuid-1", "uuid-2", ...],
  "create_costs": true,
  "default_payer_id": "user-uuid"
}
```

**처리:**

- 트랜잭션 단위로 전체 처리 (한 건이라도 실패하면 롤백 옵션)
- 또는 best-effort (성공한 것만 반영, 실패는 응답에 포함)

**응답:**

```json
{
  "ok": true,
  "data": {
    "summary": { "total": 9, "succeeded": 9, "failed": 0 },
    "events_created": ["event-1", ..., "event-9"],
    "costs_created": ["cost-1", ..., "cost-9"],
    "failures": []
  }
}
```

### 4.7 GET `/api/travels/[id]/vouchers`

**쿼리:**

- `status`: `uploaded` | `parsed` | `confirmed` | `parse_failed` | `all` (기본 all)
- `sort`: `created_at_desc` (기본) | `event_date_asc`

**응답:**

```json
{
  "ok": true,
  "data": {
    "vouchers": [
      {
        "id": "uuid-1",
        "file_name": "voucher_citymetro_5-17.pdf",
        "status": "confirmed",
        "parsed_data": { ... },
        "event_id": "event-uuid",
        "confidence": 0.95,
        "created_at": "..."
      },
      ...
    ],
    "count": 9
  }
}
```

### 4.8 DELETE `/api/travels/[id]/vouchers/[voucherId]`

**처리:**

1. 권한 확인 (organizer 또는 업로더 본인)
2. `confirmed` 상태이면 사용자 확인 필요 (`?confirm=true` 쿼리 강제)
3. Storage에서 PDF 삭제
4. `travel_vouchers` 행 삭제
5. (옵션) 연결된 `travel_events`는 보존 (사용자가 별도 삭제)

### 4.9 인증·권한

**Phase 1과 동일한 패턴:**

```ts
// app/api/travels/[id]/vouchers/upload/route.ts (skeleton)
import { createClient } from '@supabase/supabase-js';
import { hasWriteAccess } from '@/lib/travel/service';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const userId = req.headers.get('x-user-id');
  if (!userId) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const access = await hasWriteAccess(userId, params.id);
  if (!access) return Response.json({ error: 'forbidden' }, { status: 403 });

  // ... 처리
}
```

### 4.10 응답 표준화

**Phase 1과 동일한 `ApiResponse<T>` 래퍼:**

```ts
type ApiResponse<T> = {
  ok: true;
  data: T;
} | {
  ok: false;
  error: string;
  details?: any;
};
```

---

## 5. DB 스키마

### 5.1 신규 테이블: `travel_vouchers`

**마이그레이션 파일:** `db/25_travel_vouchers.sql`

```sql
-- ============================================================================
-- TRAVEL_VOUCHERS TABLE (바우처 자동 파싱)
-- ============================================================================

CREATE TABLE IF NOT EXISTS travel_vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  travel_id uuid NOT NULL REFERENCES travels(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,

  -- 원본 파일 정보
  file_name VARCHAR(500) NOT NULL,
  file_size BIGINT NOT NULL,
  file_mime VARCHAR(100) NOT NULL DEFAULT 'application/pdf',
  storage_path TEXT NOT NULL,
  -- 예: travel-documents/{travel_id}/vouchers/{id}.pdf

  -- 파싱 상태
  status VARCHAR(50) NOT NULL DEFAULT 'uploaded',
  -- Status:
  --   'uploaded'     : 업로드 완료, 파싱 전
  --   'parsing'      : 파싱 진행 중
  --   'parsed'       : 파싱 완료 (이벤트 미확정)
  --   'confirmed'    : 이벤트로 확정
  --   'parse_failed' : 파싱 실패
  --   'rejected'     : 사용자 거부

  -- 파싱 결과 (구조화된 데이터)
  parsed_data JSONB DEFAULT '{}'::jsonb,
  /*
  Example:
  {
    "title": "City Sightseeing Bus",
    "event_type": "transport",
    "event_date": "2026-05-17",
    "event_time": "17:00",
    "end_time": "21:00",
    "location": "Ho Chi Minh City",
    "description": "4-hour Open-Top Bus Tour...",
    "details": {
      "pax": 2,
      "booking_ref": "CMT-2026-051712",
      "amount": 450000,
      "currency": "VND"
    }
  }
  */

  -- 파싱 메타데이터
  parse_meta JSONB DEFAULT '{}'::jsonb,
  /*
  Example:
  {
    "language": "en",
    "confidence": 0.95,
    "confidence_level": "high",
    "warnings": ["ambiguous_date"],
    "parsing_time_ms": 1240,
    "parser_version": "1.0.0",
    "raw_text_length": 1850
  }
  */

  -- 원본 텍스트 (디버깅·재처리용)
  raw_text TEXT,

  -- 확정 시 생성된 이벤트 연결
  event_id uuid REFERENCES travel_events(id) ON DELETE SET NULL,

  -- 확정 시 생성된 비용 연결 (옵션)
  cost_id uuid REFERENCES travel_costs(id) ON DELETE SET NULL,

  -- 사용자가 파싱 결과를 수정했는지
  user_corrected BOOLEAN DEFAULT false,

  -- 오류 메시지 (parse_failed 시)
  error_message TEXT,

  -- 타임스탬프
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  parsed_at TIMESTAMP WITH TIME ZONE,
  confirmed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT check_voucher_status CHECK (
    status IN ('uploaded', 'parsing', 'parsed', 'confirmed', 'parse_failed', 'rejected')
  )
);

CREATE INDEX idx_travel_vouchers_travel_id ON travel_vouchers(travel_id);
CREATE INDEX idx_travel_vouchers_status ON travel_vouchers(status);
CREATE INDEX idx_travel_vouchers_event_id ON travel_vouchers(event_id);
CREATE INDEX idx_travel_vouchers_uploaded_by ON travel_vouchers(uploaded_by);
CREATE INDEX idx_travel_vouchers_created_at ON travel_vouchers(created_at DESC);

-- ============================================================================
-- RLS Policies
-- ============================================================================

ALTER TABLE travel_vouchers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view travel vouchers"
  ON travel_vouchers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM travel_members
      WHERE travel_members.travel_id = travel_vouchers.travel_id
        AND travel_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Members with write access can insert vouchers"
  ON travel_vouchers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM travel_members
      WHERE travel_members.travel_id = travel_vouchers.travel_id
        AND travel_members.user_id = auth.uid()
        AND travel_members.permission IN ('read_write', 'organizer')
    )
  );

CREATE POLICY "Members with write access can update vouchers"
  ON travel_vouchers FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM travel_members
      WHERE travel_members.travel_id = travel_vouchers.travel_id
        AND travel_members.user_id = auth.uid()
        AND travel_members.permission IN ('read_write', 'organizer')
    )
  );

CREATE POLICY "Uploader or organizer can delete vouchers"
  ON travel_vouchers FOR DELETE
  USING (
    uploaded_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM travels
      WHERE travels.id = travel_vouchers.travel_id
        AND travels.organizer_id = auth.uid()
    )
  );

-- ============================================================================
-- Triggers
-- ============================================================================

CREATE TRIGGER travel_vouchers_update_timestamp
  BEFORE UPDATE ON travel_vouchers
  FOR EACH ROW
  EXECUTE FUNCTION update_modified_timestamp();
```

### 5.2 기존 테이블 확장 (옵션)

**`travel_events`에 voucher 추적 컬럼 추가:**

```sql
ALTER TABLE travel_events
  ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'manual';
-- 'manual' | 'voucher_auto' | 'voucher_corrected'

ALTER TABLE travel_events
  ADD COLUMN IF NOT EXISTS voucher_id uuid REFERENCES travel_vouchers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_travel_events_voucher_id
  ON travel_events(voucher_id) WHERE voucher_id IS NOT NULL;
```

**`travel_documents`에 voucher 연결:**

```sql
ALTER TABLE travel_documents
  ADD COLUMN IF NOT EXISTS voucher_id uuid REFERENCES travel_vouchers(id) ON DELETE SET NULL;
```

### 5.3 Storage 버킷 정책

`travel-documents` 버킷 (Phase 1 기존)에 vouchers 경로 권한 추가:

```sql
-- 멤버는 자기 여행의 voucher PDF에 접근 가능
CREATE POLICY "Members can read voucher PDFs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'travel-documents'
    AND (storage.foldername(name))[1] = 'vouchers'
    AND EXISTS (
      SELECT 1 FROM travel_vouchers tv
      JOIN travel_members tm ON tm.travel_id = tv.travel_id
      WHERE tv.storage_path = name
        AND tm.user_id = auth.uid()
    )
  );
```

### 5.4 마이그레이션 절차

```bash
# 1. SQL 파일 작성
db/25_travel_vouchers.sql

# 2. 로컬 테스트
psql $DATABASE_URL -f db/25_travel_vouchers.sql

# 3. Supabase Dashboard에서 실행 (운영)
# SQL Editor → Paste → Run

# 4. RLS 정책 검증
SELECT * FROM pg_policies WHERE tablename = 'travel_vouchers';

# 5. 롤백 SQL 준비
DROP POLICY IF EXISTS "Members can view travel vouchers" ON travel_vouchers;
... (모든 정책 + 인덱스 + 테이블)
```

---

## 6. Integration & 워크플로우

### 6.1 Phase 1 API와의 연결

```
[Voucher Upload]
   ↓ POST /api/travels/[id]/vouchers/upload
   ↓ Storage: travel-documents/{travel_id}/vouchers/{id}.pdf
   ↓ INSERT travel_vouchers (status='uploaded')
   ↓
[Voucher Parse]
   ↓ POST /api/travels/[id]/vouchers/parse
   ↓ pdf-parse → 텍스트 추출
   ↓ 파싱 파이프라인 실행
   ↓ UPDATE travel_vouchers SET parsed_data=..., status='parsed'
   ↓
[User Review & Edit]
   ↓ PUT /api/travels/[id]/vouchers/[voucherId]
   ↓ UPDATE travel_vouchers SET parsed_data=..., user_corrected=true
   ↓
[Confirm to Events]
   ↓ POST /api/travels/[id]/vouchers/[voucherId]/confirm
   │
   ├─→ INSERT travel_events (재사용: Phase 1 API)
   │     POST /api/travels/[id]/events (내부 호출 또는 직접 INSERT)
   │
   ├─→ (옵션) INSERT travel_costs (재사용: Phase 1 API)
   │     POST /api/travels/[id]/costs
   │
   └─→ (옵션) INSERT travel_documents
         POST /api/travels/[id]/documents
```

### 6.2 서비스 레이어 (재사용)

**Phase 1 `lib/travel/service.ts`에 추가:**

```ts
// lib/travel/voucher.ts (신규)

import { supabase } from './client';
import { hasWriteAccess } from './service';

export async function createEventFromVoucher(
  voucherId: string,
  travelId: string,
  userId: string
): Promise<{ event_id: string }> {
  // 1. 권한 확인
  const access = await hasWriteAccess(userId, travelId);
  if (!access) throw new Error('forbidden');

  // 2. Voucher 가져오기
  const { data: voucher } = await supabase
    .from('travel_vouchers')
    .select('*')
    .eq('id', voucherId)
    .single();

  if (!voucher || voucher.status === 'confirmed') {
    throw new Error('voucher_not_ready');
  }

  // 3. travel_events INSERT
  const { data: event, error } = await supabase
    .from('travel_events')
    .insert({
      travel_id: travelId,
      title: voucher.parsed_data.title,
      event_type: voucher.parsed_data.event_type,
      event_date: voucher.parsed_data.event_date,
      event_time: voucher.parsed_data.event_time,
      location: voucher.parsed_data.location,
      description: voucher.parsed_data.description,
      details: voucher.parsed_data.details,
      source: voucher.user_corrected ? 'voucher_corrected' : 'voucher_auto',
      voucher_id: voucher.id,
      status: 'planned',
    })
    .select('id')
    .single();

  if (error) throw error;

  // 4. travel_vouchers 업데이트
  await supabase
    .from('travel_vouchers')
    .update({
      event_id: event.id,
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
    })
    .eq('id', voucherId);

  return { event_id: event.id };
}

export async function createCostFromVoucher(
  voucherId: string,
  travelId: string,
  payerId: string
): Promise<{ cost_id: string } | null> {
  const { data: voucher } = await supabase
    .from('travel_vouchers')
    .select('*')
    .eq('id', voucherId)
    .single();

  const amount = voucher?.parsed_data?.details?.amount;
  const currency = voucher?.parsed_data?.details?.currency;

  if (!amount || amount <= 0) return null;

  const costType = mapEventTypeToCostType(voucher.parsed_data.event_type);

  const { data: cost, error } = await supabase
    .from('travel_costs')
    .insert({
      travel_id: travelId,
      payer_id: payerId,
      title: voucher.parsed_data.title,
      amount,
      currency: currency || 'INR',
      cost_type: costType,
      cost_date: voucher.parsed_data.event_date,
    })
    .select('id')
    .single();

  if (error) throw error;

  // travel_vouchers에 cost_id 연결
  await supabase
    .from('travel_vouchers')
    .update({ cost_id: cost.id })
    .eq('id', voucherId);

  return { cost_id: cost.id };
}

function mapEventTypeToCostType(eventType: string): string {
  const map: Record<string, string> = {
    flight: 'flight',
    hotel: 'accommodation',
    meal: 'meal',
    transport: 'transport',
    other: 'other',
  };
  return map[eventType] || 'other';
}
```

### 6.3 백엔드 파싱 모듈 구조

```
lib/travel/voucher/
├── parser.ts             # 메인 파싱 진입점
├── extractors/
│   ├── pdf.ts            # pdf-parse 래퍼
│   ├── date.ts           # 날짜 추출
│   ├── time.ts           # 시간 추출
│   ├── title.ts          # 활동명
│   ├── location.ts       # 위치
│   ├── amount.ts         # 금액
│   ├── pax.ts            # 인원
│   └── bookingRef.ts     # 예약번호
├── language.ts           # 언어 감지
├── activity-type.ts      # 활동 유형 분류
├── normalize.ts          # 정규화
├── confidence.ts         # 신뢰도 계산
├── heuristics.ts         # 휴리스틱 룰
├── keywords.ts           # 다국어 사전
└── types.ts              # 타입 정의
```

### 6.4 메인 파싱 엔진 의사 코드

```ts
// lib/travel/voucher/parser.ts

import { extractText } from './extractors/pdf';
import { detectLanguage } from './language';
import { detectEventType } from './activity-type';
import { extractDate } from './extractors/date';
import { extractTime } from './extractors/time';
import { extractTitle } from './extractors/title';
import { extractLocation } from './extractors/location';
import { extractAmount } from './extractors/amount';
import { extractPax } from './extractors/pax';
import { extractBookingRef } from './extractors/bookingRef';
import { normalize } from './normalize';
import { calculateConfidence } from './confidence';
import { applyHeuristics } from './heuristics';

export async function parseVoucher(
  buffer: Buffer,
  context: {
    fileName: string;
    travel: { start_date: string; end_date: string; location: string };
  }
): Promise<ParsedVoucherResult> {
  const startTime = Date.now();

  // 1. PDF → 텍스트
  let rawText: string;
  try {
    rawText = await extractText(buffer);
  } catch (e) {
    return {
      status: 'parse_failed',
      error: 'pdf_extraction_failed',
      details: { message: (e as Error).message },
    } as any;
  }

  // 2. 전처리
  const text = preprocess(rawText);

  // 3. 언어 감지
  const language = detectLanguage(text);

  // 4. 활동 유형
  const { type: eventType, confidence: typeConfidence } = detectEventType(text, language);

  // 5. 필드 추출
  const date = extractDate(text, language);
  const time = extractTime(text);
  const title = extractTitle(text);
  const location = extractLocation(text);
  const amount = extractAmount(text);
  const pax = extractPax(text);
  const bookingRef = extractBookingRef(text);

  const raw: RawParsedVoucher = {
    rawText: text,
    eventType,
    eventTypeConfidence: typeConfidence,
    date,
    time,
    title,
    location,
    amount,
    pax,
    bookingRef,
  };

  // 6. 휴리스틱 보강 (여행 컨텍스트 활용)
  applyHeuristics(raw, context.travel, context.fileName);

  // 7. 정규화
  const normalized = normalize(raw);

  // 8. 신뢰도
  const confidence = calculateConfidence(raw);
  const confidenceLevel: 'high' | 'medium' | 'low' =
    confidence >= 0.85 ? 'high' :
    confidence >= 0.65 ? 'medium' : 'low';

  // 9. 경고 수집
  const warnings: string[] = [];
  if (!date) warnings.push('missing_date');
  if (date?.ambiguous) warnings.push('ambiguous_date');
  if (!time.startTime) warnings.push('missing_time');
  if (!location.location) warnings.push('missing_location');
  if (!amount) warnings.push('missing_amount');

  return {
    status: 'parsed',
    parsed: normalized,
    meta: {
      language,
      confidence,
      confidence_level: confidenceLevel,
      warnings,
      raw_text_length: text.length,
      parsing_time_ms: Date.now() - startTime,
      parser_version: '1.0.0',
    },
    raw_text: text,
  };
}
```

### 6.5 프론트엔드 통합 (커스텀 훅)

```ts
// hooks/useVoucherParser.ts

import { useState, useCallback } from 'react';

export function useVoucherParser(travelId: string) {
  const [vouchers, setVouchers] = useState<ParsedVoucher[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isParsing, setIsParsing] = useState(false);

  const upload = useCallback(async (files: File[]) => {
    setIsUploading(true);
    const form = new FormData();
    files.forEach(f => form.append('files', f));

    const res = await fetch(`/api/travels/${travelId}/vouchers/upload`, {
      method: 'POST',
      body: form,
    });
    const data = await res.json();
    setIsUploading(false);
    return data.data.vouchers;
  }, [travelId]);

  const parse = useCallback(async (voucherIds: string[]) => {
    setIsParsing(true);
    const res = await fetch(`/api/travels/${travelId}/vouchers/parse`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ voucher_ids: voucherIds }),
    });
    const data = await res.json();
    setVouchers(data.data.results);
    setIsParsing(false);
    return data.data.results;
  }, [travelId]);

  const updateVoucher = useCallback(async (voucherId: string, updates: any) => {
    const res = await fetch(`/api/travels/${travelId}/vouchers/${voucherId}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ parsed_data: updates }),
    });
    const data = await res.json();
    setVouchers(prev => prev.map(v => v.id === voucherId ? data.data : v));
  }, [travelId]);

  const confirm = useCallback(async (voucherIds: string[], options?: any) => {
    const res = await fetch(`/api/travels/${travelId}/vouchers/batch-confirm`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ voucher_ids: voucherIds, ...options }),
    });
    return await res.json();
  }, [travelId]);

  return {
    vouchers,
    isUploading,
    isParsing,
    upload,
    parse,
    updateVoucher,
    confirm,
  };
}
```

### 6.6 Realtime 업데이트 (Supabase Realtime)

확정 후 Schedule 탭이 자동 갱신되도록 구독:

```ts
// app/travels/[id]/page.tsx

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

useEffect(() => {
  const channel = supabase
    .channel(`travel_events:${travelId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'travel_events', filter: `travel_id=eq.${travelId}` },
      (payload) => {
        setEvents(prev => [...prev, payload.new as TravelEvent]);
      }
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}, [travelId]);
```

### 6.7 비용 자동 등록 흐름

**옵션 A: 자동 (기본 OFF)**
- 파싱 결과에 `amount`가 있으면 확정 시 비용도 자동 등록
- 결제자 = 업로더 (기본값), 분담 = N분의 1 (자동)
- 사용자가 토글로 켜고 끌 수 있음

**옵션 B: 수동 (사용자 결정)**
- 미리보기 화면에서 항목별로 "비용으로도 등록" 체크박스
- 확정 시 체크된 항목만 cost로 등록

권장: **옵션 B** (사용자 통제권, 잘못된 통화 등록 방지)

### 6.8 Phase 1 통합 영향 분석

| Phase 1 모듈 | 영향 | 변경 |
|------------|------|-----|
| `travel_events` | 컬럼 추가 (`source`, `voucher_id`) | 마이그레이션 필요 |
| `travel_costs` | 변경 없음 | - |
| `travel_documents` | 컬럼 추가 (`voucher_id`) | 마이그레이션 필요 |
| `POST /api/travels/[id]/events` | 변경 없음 (내부 재사용) | - |
| `POST /api/travels/[id]/costs` | 변경 없음 (내부 재사용) | - |
| `lib/travel/service.ts` | `getEventsByVoucher()` 추가 | 비파괴적 |
| RLS | 신규 정책 추가 (voucher) | - |

---

## 7. 에러 핸들링

### 7.1 에러 카테고리

| 카테고리 | 코드 | HTTP | 설명 | 사용자 메시지 |
|---------|-----|------|------|------------|
| **인증** | `AUTH_REQUIRED` | 401 | 미인증 | "로그인이 필요합니다" |
| **권한** | `FORBIDDEN` | 403 | write 권한 없음 | "이 여행에 항목을 추가할 권한이 없습니다" |
| **파일** | `FILE_TOO_LARGE` | 413 | 20MB 초과 | "파일이 너무 큽니다 (최대 20MB)" |
| **파일** | `INVALID_FILE_TYPE` | 415 | PDF 아님 | "PDF 파일만 업로드 가능합니다" |
| **파일** | `TOO_MANY_FILES` | 400 | 50개 초과 | "한 번에 최대 50개까지 업로드 가능합니다" |
| **저장소** | `STORAGE_ERROR` | 500 | Supabase Storage 실패 | "업로드에 실패했습니다. 다시 시도해주세요" |
| **파싱** | `PDF_EXTRACTION_FAILED` | 500 | PDF 텍스트 추출 실패 | "PDF에서 텍스트를 읽을 수 없습니다 (이미지 PDF 의심)" |
| **파싱** | `INSUFFICIENT_DATA` | 200 + warning | 핵심 필드 추출 실패 | (UI에서 노란 경고) |
| **파싱** | `LANGUAGE_UNSUPPORTED` | 200 + warning | 미지원 언어 | "이 언어는 자동 파싱이 제한적입니다" |
| **확정** | `DUPLICATE_EVENT` | 409 | 중복 의심 | "이미 같은 시간대 이벤트가 있습니다" |
| **확정** | `INVALID_DATE` | 400 | 여행 기간 밖 | "이벤트 날짜가 여행 기간 밖입니다" |

### 7.2 PDF 파싱 실패 시나리오

**A. 이미지 기반 PDF (스캔본)**

- 증상: `pdf-parse` 결과가 빈 문자열 또는 50자 미만
- 처리: 
  1. `pdfjs-dist` fallback 시도
  2. 그래도 실패 시 OCR 큐로 전송 (`tesseract.js` 백그라운드)
  3. OCR도 실패 시 사용자에게 수동 입력 안내

**구현:**

```ts
async function extractWithFallback(buffer: Buffer): Promise<string> {
  // 1차: pdf-parse
  try {
    const result = await pdfParse(buffer);
    if (result.text && result.text.length > 50) return result.text;
  } catch (e) {
    console.warn('pdf-parse failed', e);
  }

  // 2차: pdfjs-dist
  try {
    const result = await extractWithPdfJs(buffer);
    if (result && result.length > 50) return result;
  } catch (e) {
    console.warn('pdfjs-dist failed', e);
  }

  // 3차: OCR (비동기, 별도 큐)
  throw new Error('IMAGE_PDF_NEEDS_OCR');
}
```

**B. 깨진 PDF**

- 증상: `pdf-parse`가 에러 throw
- 처리: 즉시 fail, 사용자에게 "파일이 손상되었습니다" 안내

**C. 보호된 PDF (암호)**

- 증상: 에러 메시지에 "encrypted" 또는 "password"
- 처리: 사용자에게 "암호 해제된 PDF를 업로드해주세요" 안내

### 7.3 필드 추출 실패 처리

| 누락 필드 | 신뢰도 영향 | UI 처리 |
|---------|-----------|--------|
| **날짜** | -0.3 | 🔴 강제 수동 입력 (확정 불가) |
| **활동명** | -0.2 | 🟡 기본값 "(제목 없음)" → 편집 권장 |
| **시간** | -0.2 | 🟡 시간 없이도 등록 가능 (event_time nullable) |
| **위치** | -0.15 | 🟢 여행 기본 location으로 폴백 |
| **금액** | -0.05 | 🟢 비용 등록만 영향 (이벤트는 OK) |

**확정 차단 룰:**

```ts
function canConfirm(voucher: ParsedVoucher): { ok: boolean; reason?: string } {
  if (!voucher.parsed.title || voucher.parsed.title === '(제목 없음)') {
    return { ok: false, reason: 'missing_title' };
  }
  if (!voucher.parsed.event_date) {
    return { ok: false, reason: 'missing_date' };
  }
  if (!isWithinTravelRange(voucher.parsed.event_date, travel)) {
    return { ok: false, reason: 'date_out_of_range' };
  }
  return { ok: true };
}
```

### 7.4 중복 감지

**알고리즘:**

```ts
async function detectDuplicates(
  voucher: ParsedVoucher,
  travelId: string
): Promise<{ isDuplicate: boolean; matches: TravelEvent[] }> {
  const { event_date, event_time, event_type } = voucher.parsed;

  // 1. 같은 여행, 같은 날짜, 같은 타입 이벤트 조회
  const { data: candidates } = await supabase
    .from('travel_events')
    .select('*')
    .eq('travel_id', travelId)
    .eq('event_date', event_date)
    .eq('event_type', event_type);

  const matches = candidates?.filter(e => {
    // 시간 비교: ±1시간 내 또는 시간 없음
    if (!event_time || !e.event_time) return true;
    const diff = Math.abs(timeToMinutes(event_time) - timeToMinutes(e.event_time));
    return diff <= 60;
  }) || [];

  return {
    isDuplicate: matches.length > 0,
    matches,
  };
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}
```

**UI 처리:**

```
⚠️ 중복 의심:
이미 등록된 이벤트와 충돌합니다.
- 기존: City Sightseeing Bus, 2026-05-17 17:00
- 신규: City Sightseeing Tour, 2026-05-17 17:00

[그래도 추가]  [건너뛰기]  [기존 항목으로 보기]
```

### 7.5 통화·금액 검증

```ts
function validateAmount(amount: any, currency: string): { valid: boolean; warning?: string } {
  if (typeof amount !== 'number' || isNaN(amount)) {
    return { valid: false, warning: 'invalid_amount_format' };
  }
  if (amount < 0) {
    return { valid: false, warning: 'negative_amount' };
  }

  // 통화별 합리성 체크
  const RANGES: Record<string, [number, number]> = {
    VND: [10_000, 100_000_000],       // 1만~1억동
    USD: [1, 10_000],                  // $1~$10,000
    KRW: [1_000, 10_000_000],          // 1천~1천만원
    JPY: [100, 1_000_000],             // 100~100만엔
    INR: [50, 1_000_000],              // 50~100만루피
  };

  const range = RANGES[currency];
  if (range && (amount < range[0] || amount > range[1])) {
    return {
      valid: true,
      warning: `amount_unusual_for_${currency}`,
    };
  }

  return { valid: true };
}
```

### 7.6 로깅·모니터링

**파싱 실패율 추적:**

```sql
-- 일일 파싱 통계
SELECT
  DATE(created_at) AS day,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE status = 'parsed') AS succeeded,
  COUNT(*) FILTER (WHERE status = 'parse_failed') AS failed,
  COUNT(*) FILTER (WHERE status = 'confirmed') AS confirmed,
  AVG((parse_meta->>'confidence')::numeric) FILTER (WHERE status = 'parsed') AS avg_confidence
FROM travel_vouchers
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY day DESC;
```

**알림 발송 (선택):**

```ts
// 파싱 실패가 너무 많으면 운영자에게 알림
if (failureRate > 0.3) {
  await sendTelegramAlert('Travel voucher parsing failure rate > 30%');
}
```

### 7.7 사용자 친화적 에러 메시지

**i18n 키 설계:**

```ts
const ERROR_MESSAGES = {
  ko: {
    AUTH_REQUIRED: '로그인이 필요합니다',
    FORBIDDEN: '이 여행에 권한이 없습니다',
    FILE_TOO_LARGE: '파일이 너무 큽니다 (최대 20MB)',
    INVALID_FILE_TYPE: 'PDF 파일만 업로드 가능합니다',
    TOO_MANY_FILES: '한 번에 최대 50개까지 업로드 가능합니다',
    PDF_EXTRACTION_FAILED: 'PDF에서 텍스트를 읽을 수 없습니다. 스캔본 PDF는 OCR이 필요합니다',
    MISSING_DATE: '날짜를 추출하지 못했습니다. 직접 입력해주세요',
    MISSING_TITLE: '활동명을 추출하지 못했습니다',
    DUPLICATE_EVENT: '같은 시간대 이벤트가 이미 있습니다',
    INVALID_DATE: '여행 기간을 벗어나는 날짜입니다',
  },
  en: {
    AUTH_REQUIRED: 'Authentication required',
    FORBIDDEN: 'No permission for this travel',
    FILE_TOO_LARGE: 'File too large (max 20MB)',
    // ...
  },
};
```

---

## 8. 구현 체크리스트

웹개발자가 따라야 할 순서 (총 20단계):

### Sprint 1 — Backend Foundation (3일)

- [ ] **1. DB 마이그레이션 작성**
  - `db/25_travel_vouchers.sql` 생성
  - travel_vouchers 테이블 + 인덱스 + RLS
  - travel_events ALTER (source, voucher_id 컬럼)
  - travel_documents ALTER (voucher_id 컬럼)

- [ ] **2. 마이그레이션 적용·검증**
  - Supabase Dashboard에서 SQL 실행
  - RLS 정책 동작 확인 (SELECT/INSERT 테스트)
  - 롤백 SQL 준비

- [ ] **3. 타입 정의 추가**
  - `types/travel.ts`에 `TravelVoucher`, `ParsedVoucherData`, `VoucherParseMeta` 추가

- [ ] **4. PDF 라이브러리 설치**
  - `npm install pdf-parse pdfjs-dist`
  - 옵션: `tesseract.js` (OCR fallback)

- [ ] **5. 파서 모듈 구현**
  - `lib/travel/voucher/parser.ts` 메인 진입점
  - `lib/travel/voucher/extractors/` 각 필드 추출기
  - `lib/travel/voucher/keywords.ts` 다국어 사전

### Sprint 2 — API Routes (3일)

- [ ] **6. POST /api/travels/[id]/vouchers/upload**
  - multipart/form-data 처리
  - Supabase Storage 업로드
  - travel_vouchers INSERT

- [ ] **7. POST /api/travels/[id]/vouchers/parse**
  - PDF 다운로드 → 파서 호출
  - 결과 UPDATE
  - 응답으로 전체 결과 반환

- [ ] **8. GET /api/travels/[id]/vouchers + PUT /[voucherId]**
  - 조회·수정 엔드포인트

- [ ] **9. POST /api/travels/[id]/vouchers/[voucherId]/confirm**
  - createEventFromVoucher() 호출
  - 옵션: createCostFromVoucher() 호출

- [ ] **10. POST /api/travels/[id]/vouchers/batch-confirm**
  - 일괄 처리, 트랜잭션 또는 best-effort

### Sprint 3 — Frontend (4일)

- [ ] **11. VoucherUploadModal 컴포넌트**
  - 드래그앤드롭 + 파일 선택
  - 파일 검증 (크기, 타입)
  - 모바일 반응형

- [ ] **12. VoucherParsingProgress 컴포넌트**
  - 프로그레스바 + 파일별 상태
  - 부분 실패 처리

- [ ] **13. VoucherPreviewList & VoucherPreviewCard**
  - 결과 목록 카드 뷰
  - 신뢰도 색상 표시
  - 경고 아이콘

- [ ] **14. VoucherEditModal 컴포넌트**
  - 인라인 편집 폼
  - 원본 PDF 미리보기 (iframe)
  - 추출 텍스트 표시

- [ ] **15. useVoucherParser 훅**
  - upload/parse/update/confirm 메서드
  - 상태 관리

- [ ] **16. Schedule 탭 진입점 연결**
  - "바우처에서 자동 추가" 버튼
  - 모달 연결

### Sprint 4 — Polish & Test (2일)

- [ ] **17. Realtime 업데이트**
  - travel_events 구독으로 자동 새로고침

- [ ] **18. 에러 핸들링 강화**
  - 친화적 에러 메시지 (한국어)
  - 중복 감지 다이얼로그
  - 부분 실패 복구

- [ ] **19. 9개 샘플 바우처로 E2E 테스트**
  - 각 바우처 업로드 → 파싱 → 확정
  - 신뢰도 90% 이상 달성 확인
  - 실패 케이스 디버깅

- [ ] **20. 평가자 QA 인계**
  - 테스트 시나리오 문서 작성
  - 평가자 3회 반복 테스트 통과
  - 문서 업데이트 (`COMPLETION_STATUS.md`)

### 산출물

- `db/25_travel_vouchers.sql` (~150줄)
- `lib/travel/voucher/` 모듈 (~800줄)
- API routes (~500줄)
- 컴포넌트 (~1,200줄)
- 훅 (~150줄)
- **총 ~2,800줄**

### 예상 일정

| 스프린트 | 일수 | 시작 | 종료 |
|--------|------|------|-----|
| Sprint 1 (Backend Foundation) | 3 | 2026-05-15 | 2026-05-17 |
| Sprint 2 (API Routes) | 3 | 2026-05-18 | 2026-05-20 |
| Sprint 3 (Frontend) | 4 | 2026-05-21 | 2026-05-24 |
| Sprint 4 (Polish & Test) | 2 | 2026-05-25 | 2026-05-26 |
| **완료** | **12일** | | **2026-05-26** |

Phase 2 전체 완료 (2026-05-27)에 맞춤.

---

## 부록 A — 9개 샘플 바우처 파싱 결과

각 바우처별 예상 파싱 결과 JSON. 실제 PDF가 손에 있지 않으므로, **예상되는 텍스트 추출 결과를 가정**한 파싱 결과.

### A.1 City Sightseeing Bus (5/17)

**예상 입력 텍스트:**

```
CITY SIGHTSEEING HO CHI MINH
Booking Confirmation #CMT-2026-051712

Date: 17/05/2026 (Saturday)
Time: 17:00 - 21:00
Pickup: Lumiere Riverside Hotel
Pax: 2 Adults
Total: 450,000 VND

Activity: 4-hour Open-Top Bus Tour
Includes audio guide in English/Korean
```

**파싱 결과 JSON:**

```json
{
  "voucher_id": "voucher-001",
  "file_name": "voucher_citymetro_5-17.pdf",
  "file_size": 2150400,
  "parsed": {
    "title": "City Sightseeing Bus",
    "event_type": "transport",
    "event_date": "2026-05-17",
    "event_time": "17:00",
    "end_time": "21:00",
    "location": "Ho Chi Minh City",
    "description": "4-hour Open-Top Bus Tour. Pickup at Lumiere Riverside Hotel. Includes audio guide in English/Korean.",
    "details": {
      "pax": 2,
      "booking_ref": "CMT-2026-051712",
      "amount": 450000,
      "currency": "VND",
      "pickup_point": "Lumiere Riverside Hotel",
      "icon_hint": "🚌"
    }
  },
  "meta": {
    "language": "en",
    "confidence": 0.95,
    "confidence_level": "high",
    "warnings": [],
    "raw_text_length": 245,
    "parsing_time_ms": 1240,
    "parser_version": "1.0.0"
  }
}
```

### A.2 Mekong Delta Tour (5/18)

**예상 입력:**

```
MEKONG DELTA FULL-DAY TOUR
Booking Ref: MD-2026-0518-XY42

Date: 18 May 2026, Sunday
Pickup time: 07:30 (return ~17:00)
Pickup location: Lumiere Riverside Hotel, District 1
Pax: 2 adults

Itinerary:
- My Tho riverboat
- Coconut candy workshop
- Lunch in Ben Tre
- Honey bee farm

Total: 1,200,000 VND (₫600,000 per pax)
```

**파싱 결과:**

```json
{
  "voucher_id": "voucher-002",
  "file_name": "voucher_mekong_5-18.pdf",
  "file_size": 1843200,
  "parsed": {
    "title": "Mekong Delta Full-Day Tour",
    "event_type": "other",
    "event_date": "2026-05-18",
    "event_time": "07:30",
    "end_time": "17:00",
    "location": "My Tho, Ben Tre",
    "description": "Full-day tour: My Tho riverboat, coconut candy workshop, lunch in Ben Tre, honey bee farm. Pickup at Lumiere Riverside.",
    "details": {
      "pax": 2,
      "booking_ref": "MD-2026-0518-XY42",
      "amount": 1200000,
      "currency": "VND",
      "pickup_point": "Lumiere Riverside Hotel, District 1",
      "icon_hint": "🗺"
    }
  },
  "meta": {
    "language": "en",
    "confidence": 0.92,
    "confidence_level": "high",
    "warnings": [],
    "raw_text_length": 380,
    "parsing_time_ms": 1180
  }
}
```

### A.3 Landmark 81 Skyview (5/19)

**예상 입력:**

```
LANDMARK 81 SKYVIEW
Vinhomes Central Park
Observation Deck Admission

Date: 19/05/2026
Time: Open 09:00 - 23:00 (entry valid all day)
Pax: 2

Booking #LM81-2026-0519
Total: 540,000 VND
```

**파싱 결과:**

```json
{
  "voucher_id": "voucher-003",
  "file_name": "voucher_landmark81_5-19.pdf",
  "file_size": 2304000,
  "parsed": {
    "title": "Landmark 81 Skyview",
    "event_type": "other",
    "event_date": "2026-05-19",
    "event_time": null,
    "end_time": null,
    "location": "Vinhomes Central Park, Ho Chi Minh City",
    "description": "Observation Deck Admission. Entry valid any time 09:00 - 23:00.",
    "details": {
      "pax": 2,
      "booking_ref": "LM81-2026-0519",
      "amount": 540000,
      "currency": "VND",
      "icon_hint": "🏙"
    }
  },
  "meta": {
    "language": "en",
    "confidence": 0.78,
    "confidence_level": "medium",
    "warnings": ["no_specific_time"],
    "raw_text_length": 175,
    "parsing_time_ms": 950
  }
}
```

### A.4 Cu Chi Tunnels (5/20 오전)

**예상 입력:**

```
CU CHI TUNNELS HALF-DAY TOUR
Operator: Saigon Heritage Tours
Booking #SHT-CC-2026-0520

Tour date: 20 May 2026, Tuesday
Departure: 07:30 AM
Return: approx. 15:00
Meeting point: Lumiere Riverside Hotel lobby

Pax: 2 adults
Price: 980,000 VND

Includes:
- Round-trip transport
- English-speaking guide
- Tunnel entrance fee
- Bottled water
```

**파싱 결과:**

```json
{
  "voucher_id": "voucher-004",
  "file_name": "voucher_cuchi_5-20.pdf",
  "file_size": 2004800,
  "parsed": {
    "title": "Cu Chi Tunnels Half-Day Tour",
    "event_type": "other",
    "event_date": "2026-05-20",
    "event_time": "07:30",
    "end_time": "15:00",
    "location": "Cu Chi, Ho Chi Minh City",
    "description": "Half-day tour to Cu Chi Tunnels. Includes round-trip transport, English-speaking guide, tunnel entrance fee, bottled water. Meeting at Lumiere lobby.",
    "details": {
      "pax": 2,
      "booking_ref": "SHT-CC-2026-0520",
      "amount": 980000,
      "currency": "VND",
      "pickup_point": "Lumiere Riverside Hotel lobby",
      "icon_hint": "🗺"
    }
  },
  "meta": {
    "language": "en",
    "confidence": 0.94,
    "confidence_level": "high",
    "warnings": [],
    "raw_text_length": 320,
    "parsing_time_ms": 1090
  }
}
```

### A.5 Jjimjilbang + Sauna (5/20 저녁)

**예상 입력 (한국어 포함):**

```
사이공 한국식 찜질방
Saigon Korean Sauna & Jjimjilbang
District 7, Phu My Hung

날짜: 2026-05-20
시간: 자유 입장 (운영 시간 06:00 ~ 24:00)
인원: 2명

예약번호: SKS-051420
요금: 700,000 VND (₫350,000/인)

포함: 찜질방, 사우나, 한국식 식당 이용
```

**파싱 결과:**

```json
{
  "voucher_id": "voucher-005",
  "file_name": "voucher_jjimjilbang.pdf",
  "file_size": 1638400,
  "parsed": {
    "title": "사이공 한국식 찜질방",
    "event_type": "other",
    "event_date": "2026-05-20",
    "event_time": null,
    "end_time": null,
    "location": "District 7, Phu My Hung, Ho Chi Minh City",
    "description": "찜질방, 사우나, 한국식 식당 이용. 운영시간 06:00 ~ 24:00 자유 입장.",
    "details": {
      "pax": 2,
      "booking_ref": "SKS-051420",
      "amount": 700000,
      "currency": "VND",
      "icon_hint": "💆"
    }
  },
  "meta": {
    "language": "ko",
    "confidence": 0.82,
    "confidence_level": "medium",
    "warnings": ["no_specific_time"],
    "raw_text_length": 220,
    "parsing_time_ms": 1310
  }
}
```

### A.6 Go Kart + Archery (5/21 오후)

**예상 입력:**

```
SAIGON ADVENTURE PARK
Combo Pass: Go-Kart + Archery

Date: 21 May 2026, Wednesday
Session start: 14:00
Duration: 2.5 hours
Location: District 9, Saigon Adventure Park

Pax: 2
Booking ID: SAP-COMBO-2026-0521-A14
Total: 1,600,000 VND
```

**파싱 결과:**

```json
{
  "voucher_id": "voucher-006",
  "file_name": "voucher_gokart_5-21.pdf",
  "file_size": 1945600,
  "parsed": {
    "title": "Go-Kart + Archery Combo",
    "event_type": "other",
    "event_date": "2026-05-21",
    "event_time": "14:00",
    "end_time": "16:30",
    "location": "Saigon Adventure Park, District 9",
    "description": "Combo Pass: Go-Kart + Archery, 2.5 hour session.",
    "details": {
      "pax": 2,
      "booking_ref": "SAP-COMBO-2026-0521-A14",
      "amount": 1600000,
      "currency": "VND",
      "icon_hint": "⛳"
    }
  },
  "meta": {
    "language": "en",
    "confidence": 0.93,
    "confidence_level": "high",
    "warnings": [],
    "raw_text_length": 245,
    "parsing_time_ms": 1080
  }
}
```

### A.7 OMAKASE TIGER Dinner (5/21 저녁)

**예상 입력 (영어+일본어 혼재):**

```
OMAKASE TIGER
Premium Japanese Cuisine
リバーサイド店

Reservation Confirmation
予約番号: OT-2026-052120

Date: 21st May 2026 (Wed)
Time: 20:00 (90 minutes)
Pax: 2 guests
Course: Omakase Premium (12 courses)

Address: 21F, Saigon Centre, District 1
Price: ₫2,800,000 (¥17,500 per person × 2)

Note: Please arrive 10 minutes early.
```

**파싱 결과:**

```json
{
  "voucher_id": "voucher-007",
  "file_name": "voucher_omakase_5-21.pdf",
  "file_size": 1740800,
  "parsed": {
    "title": "OMAKASE TIGER Dinner",
    "event_type": "meal",
    "event_date": "2026-05-21",
    "event_time": "20:00",
    "end_time": "21:30",
    "location": "21F, Saigon Centre, District 1",
    "description": "Premium Japanese Omakase Course (12 courses). 90 minutes. Please arrive 10 minutes early.",
    "details": {
      "pax": 2,
      "booking_ref": "OT-2026-052120",
      "amount": 2800000,
      "currency": "VND",
      "icon_hint": "🍣",
      "additional_currency": { "JPY": 35000 }
    }
  },
  "meta": {
    "language": "en",
    "confidence": 0.96,
    "confidence_level": "high",
    "warnings": [],
    "raw_text_length": 320,
    "parsing_time_ms": 1420
  }
}
```

### A.8 Metashow Art Exhibition (5/21)

**예상 입력 (제한적 정보):**

```
METASHOW 2026
Immersive Digital Art Experience

Admission Ticket
2 Adults

Valid: 2026-05-21
Venue: Saigon Exhibition Center
```

**파싱 결과 (낮은 신뢰도):**

```json
{
  "voucher_id": "voucher-008",
  "file_name": "voucher_metashow_5-21.pdf",
  "file_size": 1228800,
  "parsed": {
    "title": "Metashow Art Exhibition",
    "event_type": "other",
    "event_date": "2026-05-21",
    "event_time": null,
    "end_time": null,
    "location": "Saigon Exhibition Center",
    "description": "Metashow 2026 — Immersive Digital Art Experience. Admission for 2 adults.",
    "details": {
      "pax": 2,
      "booking_ref": null,
      "amount": null,
      "currency": null,
      "icon_hint": "🎨"
    }
  },
  "meta": {
    "language": "en",
    "confidence": 0.68,
    "confidence_level": "medium",
    "warnings": ["missing_time", "missing_amount", "missing_booking_ref"],
    "raw_text_length": 140,
    "parsing_time_ms": 720
  }
}
```

### A.9 Saigon Princess Cruise (5/23)

**예상 입력 (베트남어 + 영어):**

```
SAIGON PRINCESS CRUISE
Du thuyền Sài Gòn Princess

Booking Confirmation #SPC-2026-052319

Date / Ngày: 23/05/2026 (Friday)
Boarding / Lên tàu: 19:15
Return / Về bến: 21:30

Pickup: Bach Dang Wharf, District 1
Pax: 2 adults
Total: ₫3,500,000 VND

Includes:
- 4-course Western dinner
- Live music
- Sunset view
- Free welcome drink
```

**파싱 결과:**

```json
{
  "voucher_id": "voucher-009",
  "file_name": "voucher_saigonprincess_5-23.pdf",
  "file_size": 2150400,
  "parsed": {
    "title": "Saigon Princess Cruise",
    "event_type": "other",
    "event_date": "2026-05-23",
    "event_time": "19:15",
    "end_time": "21:30",
    "location": "Bach Dang Wharf, District 1",
    "description": "Dinner cruise: 4-course Western dinner, live music, sunset view, welcome drink. Boarding at Bach Dang Wharf.",
    "details": {
      "pax": 2,
      "booking_ref": "SPC-2026-052319",
      "amount": 3500000,
      "currency": "VND",
      "icon_hint": "🚢"
    }
  },
  "meta": {
    "language": "vi",
    "confidence": 0.91,
    "confidence_level": "high",
    "warnings": [],
    "raw_text_length": 365,
    "parsing_time_ms": 1280
  }
}
```

### A.10 9개 바우처 종합 통계 (예상)

| 항목 | 값 |
|------|-----|
| 총 바우처 | 9개 |
| 평균 신뢰도 | 0.876 |
| 🟢 high (≥0.85) | 6개 |
| 🟡 medium (0.65-0.84) | 3개 |
| 🔴 low (<0.65) | 0개 |
| 언어 분포 | EN: 6, KO: 1, VI: 1, EN+JA: 1 |
| 총 처리 시간 (예상) | ~10.5초 (병렬), ~25초 (직렬) |
| 총 금액 (VND) | ₫11,770,000 (≈₩600,000 @ 환율 51.0) |

---

## 부록 B — 정규표현식 패턴 카탈로그

빠른 참조용 정규식 모음.

### B.1 날짜

```regex
# ISO 8601: 2026-05-17
\b(\d{4})-(\d{2})-(\d{2})\b

# DD/MM/YYYY: 17/05/2026
\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b

# DD-MM-YYYY: 17-05-2026
\b(\d{1,2})-(\d{1,2})-(\d{4})\b

# DD Month YYYY: "17 May 2026", "17th May 2026"
\b(\d{1,2})(?:st|nd|rd|th)?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})\b

# Month DD, YYYY: "May 17, 2026"
\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2}),?\s+(\d{4})\b

# Korean: 2026년 5월 17일
(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일

# Japanese: 2026年5月17日
(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日

# Vietnamese: ngày 17 tháng 5 năm 2026
ngày\s*(\d{1,2})\s*tháng\s*(\d{1,2})\s*năm\s*(\d{4})
```

### B.2 시간

```regex
# 24h range: 17:00 - 21:00
\b(\d{1,2}):(\d{2})\s*[-–~]\s*(\d{1,2}):(\d{2})\b

# 12h with am/pm: 5:30 PM
\b(\d{1,2}):(\d{2})\s*(am|pm|AM|PM)\b

# Labeled: "Pickup at 16:45"
(?:pickup|start|begin|departure|시작|출발).*?(\d{1,2}):(\d{2})

# Single 12h: 8pm
\b(\d{1,2})\s*(am|pm|AM|PM)\b
```

### B.3 금액·통화

```regex
# VND: ₫450,000 or 450,000 VND
(?:₫|VND|đồng)\s*([\d,.\s]+)
([\d,.\s]+)\s*(?:₫|VND|đồng)

# USD
(?:\$|USD)\s*([\d,.\s]+)

# KRW
(?:₩|KRW|원)\s*([\d,.\s]+)

# JPY
(?:¥|JPY|円)\s*([\d,.\s]+)

# INR
(?:₹|INR|Rs\.?)\s*([\d,.\s]+)

# Labeled: "Total: ..." or "합계: ..."
(?:total|grand\s*total|amount|price|cost|합계|총액)\s*[::]?\s*(?:₫|VND|\$|USD|₩|KRW|원|¥|JPY|₹|INR|Rs\.?)?\s*([\d,]+(?:\.\d+)?)\s*(VND|USD|KRW|JPY|INR|đồng|đ|₫|\$|₩|¥|₹)?
```

### B.4 인원·예약번호

```regex
# Pax: "2 adults", "Pax: 2", "2명"
(?:pax|adults?|persons?|guests?|people|명|인)\s*[::]?\s*(\d+)
(\d+)\s*(?:pax|adults?|persons?|guests?|people|명|인)

# Booking ref: "Booking #ABC-123", "Ref: XYZ789", "예약번호: ABC123"
(?:booking\s*(?:reference|ref|#|no\.?|number|id)?|confirmation\s*(?:#|no\.?|number)?|예약\s*번호)\s*[::#]?\s*([A-Z0-9\-]{4,20})
```

### B.5 위치

```regex
# Labeled location
(?:location|address|venue|pickup\s*(?:point|location)?|meeting\s*point)\s*[::]\s*(.+?)(?:\n|$)

# Korean
(?:위치|장소|주소)\s*[::]\s*(.+?)(?:\n|$)
```

### B.6 활동명 (PDF 제목)

```regex
# All-caps line (typical headline)
^([A-Z][A-Z\s\d&'-]+)$

# Labeled
(?:activity|tour|service|product|experience|title|name)\s*[::]\s*(.+?)(?:\n|$)
```

---

## 변경 이력

| 날짜 | 작성자 | 변경 |
|------|-------|------|
| 2026-05-14 | 플레너 | 최초 설계서 작성 |

---

## 다음 단계

1. **웹개발자 인계** — 이 설계서 + Phase 1 코드베이스 리뷰
2. **DB 마이그레이션** — `db/25_travel_vouchers.sql` 작성·적용
3. **파서 구현** — `lib/travel/voucher/` 모듈 개발
4. **API 구현** — 8개 신규 엔드포인트
5. **UI 구현** — 4단계 워크플로우 컴포넌트
6. **평가자 QA** — 9개 샘플로 3회 반복 테스트
7. **운영 배포** — Phase 2 최종 완료 (2026-05-27)

설계 완료. 웹개발자 시작 대기.
