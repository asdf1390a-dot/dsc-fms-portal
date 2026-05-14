# JEEPNEY Personal Portal — 완전 설계서

> **상태:** 최종 설계 (웹개발자 구현 전)  
> **작성일:** 2026-05-13  
> **담당:** 비서 (플레너)  
> **목표:** Next.js 14 + Supabase 기반 모던 포탈 아키텍처

---

## 📋 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [아키텍처 & 구조 설계](#2-아키텍처--구조-설계)
3. [UI/UX 디자인 시스템](#3-uiux-디자인-시스템)
4. [페이지 & 컴포넌트 명세](#4-페이지--컴포넌트-명세)
5. [개인이력 배치 옵션 비교](#5-개인이력-배치-옵션-비교)
6. [DB 스키마 (신규/변경)](#6-db-스키마-신규변경)
7. [구현 로드맵](#7-구현-로드맵)

---

## 1. 프로젝트 개요

### 1.1 목표

**JEEPNEY 포탈:** 사용자의 모든 일상 + 업무를 한곳에 통합하는 개인 포탈  
- **개인이력:** 경력, 프로젝트, 성과 기록
- **DSC HUB:** 공장 운영 업무 모음
  - DSC FMS: 설비, 보전, KPI 관리
  - Travel Records: 출장 기록 관리
- **확장 가능성:** 추가 카테고리/앱 수용

### 1.2 핵심 가치

| 항목 | 설명 |
|------|------|
| **통합성** | 여러 앱을 하나의 포탈에서 관리 |
| **모바일 우선** | 인도 현장 + 이동 중 접근 최적화 |
| **모던 디자인** | Vercel/Notion/Linear 수준의 세련됨 |
| **확장성** | 새로운 앱/카테고리 추가 용이 |
| **보안** | Supabase 인증 + RLS 기반 권한 제어 |

### 1.3 스택

- **Frontend:** Next.js 14 (React 18)
- **Backend:** Supabase (Postgres + Auth + Real-time)
- **Styling:** Inline CSS (기존 패턴) + CSS Modules (신규)
- **UI Library:** Heroicons (아이콘), Recharts (차트)
- **Deployment:** Vercel
- **Analytics:** Supabase Analytics (추가 검토)

---

## 2. 아키텍처 & 구조 설계

### 2.1 URL 구조 (라우팅 맵)

```
https://dsc-fms-portal.vercel.app/

├── /                                    [JEEPNEY 메인 홈/대시보드]
│   └── BottomNav: [Home | DSC HUB | Personal | Settings | Profile]
│
├── /jeepney-personal                    [개인이력 - Tab 1]
│   ├── /jeepney-personal                (Overview/Timeline 또는 Hub)
│   ├── /jeepney-personal/career         (회사 & 프로젝트 목록)
│   ├── /jeepney-personal/career/companies
│   │   ├── /companies                   (목록)
│   │   ├── /companies/new               (신규 회사 추가)
│   │   └── /companies/[id]              (회사 상세 + 편집)
│   ├── /jeepney-personal/career/projects
│   │   ├── /projects                    (목록)
│   │   ├── /projects/new                (신규 프로젝트)
│   │   └── /projects/[id]               (프로젝트 상세)
│   ├── /jeepney-personal/career/achievements
│   │   ├── /achievements                (성과/스킬/인증서 목록)
│   │   ├── /achievements/new            (신규 추가)
│   │   └── /achievements/[id]           (상세)
│   └── /jeepney-personal/timeline       (통합 타임라인)
│
├── /dsc-hub                             [DSC HUB - 메인 대시보드]
│   ├── /dsc-hub                         (Overview)
│   ├── /dsc-hub/fms                     [Tab 2: DSC FMS]
│   │   ├── /assets                      (설비 마스터)
│   │   ├── /bm                          (BM 이력)
│   │   ├── /pm                          (PM 계획)
│   │   ├── /inventory                   (재고)
│   │   ├── /kpi                         (KPI 대시보드)
│   │   ├── /wo                          (작업지시)
│   │   ├── /reports                     (경영실적)
│   │   └── /vendors                     (협력사 관리)
│   │
│   └── /dsc-hub/travel                  [Tab 3: Travel Records]
│       ├── /travel                      (여행 목록)
│       ├── /travel/new                  (신규 여행 추가)
│       ├── /travel/[id]                 (여행 상세)
│       │   ├── /travel/[id]/schedule    (일정)
│       │   ├── /travel/[id]/costs       (비용)
│       │   ├── /travel/[id]/photos      (사진)
│       │   └── /travel/[id]/map         (지도)
│       └── /travel/[id]/edit            (편집)
│
├── /settings                            [설정]
│   ├── /settings/profile                (프로필 편집)
│   ├── /settings/language               (언어)
│   ├── /settings/theme                  (테마)
│   ├── /settings/notifications          (알림)
│   └── /settings/privacy                (프라이버시)
│
├── /login                               [로그인 (기존)]
├── /status                              [상태 페이지 (기존)]
└── /api/*                               [API 엔드포인트]
```

### 2.2 네비게이션 아키텍처

**3단계 네비게이션 모델:**

```
┌─────────────────────────────────────────────────────┐
│ L1: JEEPNEY 로고 + 메인 탭 (Home | DSC HUB | ...)  │  ← Header/TopNav
├─────────────────────────────────────────────────────┤
│                                                       │
│  L2: DSC HUB (3개 탭) 또는 Personal Menu             │
│  [개인이력] [DSC FMS] [여행기록]                    │
│  또는 서브메뉴 (회사 | 프로젝트 | ...)               │
│                                                       │
│  L3: 콘텐츠 영역                                     │
│  (페이지별 세부 UI)                                   │
│                                                       │
└─────────────────────────────────────────────────────┘
│ L4: BottomNav (5개 항목)                            │  ← Footer/BottomNav
└─────────────────────────────────────────────────────┘
```

**구현 가이드:**
- **L1 (Header):** `JeepneyHeader` 컴포넌트 (기존)
  - 로고: "JEEPNEY" (클릭 시 `/`)
  - 메인 탭: [DSC HUB] [Personal] [Settings] [👤 Profile]
  - 모바일: 햄버거 메뉴
  
- **L2 (Sub-Navigation):** 페이지마다 다름
  - DSC HUB: 3개 탭 (개인이력 | FMS | Travel)
  - Personal: 3개 탭 (회사 | 프로젝트 | 성과)
  - Travel: 목록 + 필터
  
- **L3 (Content):** 페이지 콘텐츠
  - 카드, 테이블, 폼, 대시보드 등
  
- **L4 (Bottom Nav):** 고정 네비게이션 (모바일 최적화)
  - 5개 메인 섹션: Home | DSC HUB | Personal | Settings | Profile

---

## 3. UI/UX 디자인 시스템

### 3.1 색상 팔레트

**기본 테마:** 다크 모드 (기존 패턴 유지)

| 용도 | 색상 | Hex | 사용처 |
|------|------|-----|--------|
| **배경 (Primary)** | 매우 어두운 슬레이트 | `#0f172a` | 페이지 배경 |
| **배경 (Secondary)** | 어두운 슬레이트 | `#1e293b` | 카드, 폼 배경 |
| **테두리** | 슬레이트-700 | `#334155` | 구분선, 테두리 |
| **텍스트 (Primary)** | 슬레이트-50 | `#f8fafc` | 메인 텍스트 |
| **텍스트 (Secondary)** | 슬레이트-400 | `#cbd5e1` | 보조 텍스트 |
| **텍스트 (Tertiary)** | 슬레이트-500 | `#64748b` | 비활성/힌트 |
| **악센트 (Primary)** | 사이언 | `#06b6d4` | CTA 버튼, 활성 링크 |
| **악센트 (Secondary)** | 바이올렛 | `#a78bfa` | 개인이력 섹션 |
| **악센트 (Danger)** | 빨강 | `#ef4444` | 에러, 긴급, 삭제 |
| **성공** | 초록 | `#10b981` | 완료, 성공 |
| **경고** | 황색 | `#f59e0b` | 경고, 주의 |
| **정보** | 파랑 | `#3b82f6` | 정보 메시지 |

**라이트 모드 (향후):**
```
배경: #ffffff → #f8fafc
텍스트: 색상 반전 (dark → light)
악센트: 동일
```

### 3.2 타이포그래피

**폰트 스택:**
```css
/* 한글 (기본) */
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, 
            "Noto Sans KR", "Apple SD Gothic Neo", sans-serif;

/* 영어 (우선) */
font-family: "Inter", -apple-system, sans-serif;

/* 단색폭 (코드, 번호) */
font-family: "Menlo", "Monaco", "Courier New", monospace;
```

**크기 & 가중치:**

| 용도 | 크기 | 가중치 | 행간 |
|------|------|--------|------|
| **Page Title (H1)** | 32px | 700 | 1.2 |
| **Section Title (H2)** | 24px | 600 | 1.3 |
| **Subsection (H3)** | 20px | 600 | 1.4 |
| **Card Title (H4)** | 16px | 600 | 1.5 |
| **Body Text** | 14px | 400 | 1.6 |
| **Small Text** | 12px | 400 | 1.5 |
| **Label** | 11px | 600 | 1.4 |
| **Button Text** | 14px | 600 | 1.5 |

### 3.3 레이아웃 & 여백

**간격 시스템 (4px 그리드):**
```
xs: 4px
sm: 8px
md: 12px
lg: 16px
xl: 20px
2xl: 24px
3xl: 32px
4xl: 40px
```

**컨테이너:**
```
모바일:     100% (padding: 12px)
태블릿:     600px (padding: 16px)
데스크톱:   960px (padding: 24px)
와이드:     1280px (padding: 32px)
```

**모바일 세이프 에어리어:**
```css
padding-top: max(16px, env(safe-area-inset-top));
padding-bottom: max(16px, env(safe-area-inset-bottom) + 64px); /* BottomNav 영역 */
```

### 3.4 컴포넌트 디자인 명세

#### 3.4.1 버튼 (Button)

**변종:**

| 타입 | 배경 | 텍스트 | 테두리 | 사용처 |
|------|------|--------|--------|--------|
| **Primary** | `#06b6d4` | White | None | 주요 CTA |
| **Secondary** | `#334155` | Slate-50 | None | 보조 CTA |
| **Danger** | `#ef4444` | White | None | 삭제/위험 |
| **Ghost** | Transparent | Slate-50 | Slate-400 | 취소/선택 |
| **Loading** | Slate-600 | Slate-400 | None | 로딩 중 (비활성) |

**크기:**
- **sm:** 32px 높이, 12px 패딩 (모바일)
- **md:** 40px 높이, 16px 패딩 (기본)
- **lg:** 48px 높이, 20px 패딩 (데스크톱)

**상태:**
- Idle: 기본
- Hover: 명도 -10%
- Active: 명도 -20%
- Disabled: opacity 50%, cursor not-allowed

#### 3.4.2 카드 (Card)

```
┌─────────────────────────────────┐
│ [Avatar] Title      [•••]       │  Header (12px padding)
├─────────────────────────────────┤
│                                 │
│ Content Area                    │  Body (16px padding)
│ (텍스트, 양식, 이미지)          │
│                                 │
├─────────────────────────────────┤
│ [Cancel] [Save]                 │  Footer (12px padding) [선택]
└─────────────────────────────────┘
```

**스타일:**
- 배경: `#1e293b`
- 테두리: `1px solid #334155`
- 보더레이디우스: 8px
- 박스셰도우: `0 1px 3px rgba(0,0,0,0.3)`
- Hover 상태: 테두리 색상 → `#475569`

#### 3.4.3 입력 필드 (Input)

```
┌──────────────────────────────┐
│ Label                        │  12px, Slate-400
├──────────────────────────────┤
│ [Input field]                │  14px, Slate-50, padding: 10px
├──────────────────────────────┤
│ Help text / Error message    │  11px, Slate-500 or Red-400
└──────────────────────────────┘
```

**포커스 상태:**
- 테두리: `2px solid #06b6d4`
- 박스셰도우: `0 0 0 3px rgba(6,182,212,0.1)`

#### 3.4.4 탭 (Tab)

```
[Tab 1] [Tab 2] [Tab 3]
  ↓
┌─────┬─────┬─────┐
│ T1  │ T2  │ T3  │
├─────┤
│     ← 활성 탭 아래 언더라인 (2px, #06b6d4)
```

**모바일:**
```
→ [T1] [T2] [T3] ← (가로 스크롤)
또는
┌─────┐
│ T1  │
├─────┤
│ ▼ 드롭다운 (T2, T3)
```

#### 3.4.5 모달 & 시트

**모달:**
- 배경: 검은색 (opacity 60%)
- 컨테이너: 중앙, 최대 너비 480px
- 보더레이디우스: 12px

**바텀 시트 (모바일):**
- 위치: 화면 하단에서 미끄러짐
- 배경: `#1e293b`
- 드래그 핸들: 상단 중앙 (3px × 24px, Slate-600)
- 높이: 최대 80vh

### 3.5 아이콘

**라이브러리:** Heroicons (Outline, 24px)

주요 아이콘:
```
Home:       home-icon
Dashboard:  squares-2x2-icon
Users:      users-icon
Calendar:   calendar-icon
MapPin:     map-pin-icon
CreditCard: credit-card-icon
Settings:   cog-6-tooth-icon
LogOut:     arrow-right-on-rectangle-icon
Plus:       plus-icon
Edit:       pencil-icon
Trash:      trash-icon
ChevronRight: chevron-right-icon
ChevronLeft:  chevron-left-icon
```

### 3.6 애니메이션

**전환 (Transition):**
```css
transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
```

**효과:**
- 페이지 전환: Fade (200ms)
- 메뉴 열기: Slide up + Fade (250ms)
- 버튼 호버: Scale (1 → 1.02) + 색상 변화
- 로딩: Spinner (선형 회전, 1s 무한)

---

## 4. 페이지 & 컴포넌트 명세

### 4.1 메인 레이아웃 컴포넌트

#### `JeepneyLayout` (루트 래퍼)

```jsx
// pages/_app.js 또는 pages/index.js의 메인 컴포넌트
export default function JeepneyLayout({ children, currentPage }) {
  return (
    <div style={S.root}>
      <JeepneyHeader title={currentPage?.title} />
      <main style={S.main}>
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
```

**구조:**
```
<JeepneyLayout>
  ├── <JeepneyHeader />          (L1: 로고 + 메인 탭)
  ├── <main>
  │   ├── [L2: 서브 네비게이션]  (페이지마다 다름)
  │   └── [L3: 콘텐츠]
  └── <BottomNav />              (L4: 고정 네비게이션)
</JeepneyLayout>
```

#### `JeepneyHeader` (기존 → 확장)

**변경사항:**
- 메인 탭 추가: [DSC HUB] [Personal] [Settings]
- 프로필 메뉴: 로그아웃 + 설정

```jsx
<header style={S.header}>
  <div style={S.left}>
    <img src="/logo-jeepney.svg" alt="JEEPNEY" />
    <span>JEEPNEY</span>
  </div>
  <nav style={S.tabs}>
    <Tab href="/dsc-hub" label="DSC HUB" active={isActive} />
    <Tab href="/jeepney-personal" label="Personal" active={isActive} />
    <Tab href="/settings" label="Settings" active={isActive} />
  </nav>
  <button style={S.profileBtn}>
    <Avatar initials="JP" />
    {/* 드롭다운: 프로필 | 설정 | 로그아웃 */}
  </button>
</header>
```

#### `BottomNav` (기존 → 재구성)

```jsx
const ITEMS = [
  { href: '/',                  label: 'Home',   icon: HomeIcon },
  { href: '/dsc-hub',           label: 'DSC Hub', icon: FactoryIcon },
  { href: '/jeepney-personal',  label: 'Personal', icon: UserIcon },
  { href: '/settings',          label: 'Settings', icon: CogIcon },
  { href: '/settings/profile',  label: 'Profile', icon: UserCircleIcon },
];
```

### 4.2 페이지별 레이아웃

#### 📑 `/` — JEEPNEY 메인 홈

**목적:** 포탈 진입점, 모든 앱 접근

**레이아웃:**
```
┌─────────────────────────────────────────┐
│ JEEPNEY Header (로고 + 탭)              │
├─────────────────────────────────────────┤
│                                          │
│  Welcome, [Name]!                       │
│  Last Updated: [datetime]               │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │ 📊 DSC HUB                       │   │
│  │ 설비, 보전, KPI 관리             │   │
│  │ [→ Go to DSC HUB]                │   │
│  └──────────────────────────────────┘   │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │ 📋 Personal History              │   │
│  │ 경력, 프로젝트, 성과             │   │
│  │ [→ Go to Personal]               │   │
│  └──────────────────────────────────┘   │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │ ✈️ Travel Records                │   │
│  │ 출장 기록, 비용 관리             │   │
│  │ [→ Go to Travel]                 │   │
│  └──────────────────────────────────┘   │
│                                          │
│  Recent Activity:                        │
│  • BM 이력 3건 입력됨 (2시간 전)       │
│  • PM 계획 1건 완료 (어제)              │
│  • 프로젝트 1건 추가됨 (3일 전)         │
│                                          │
├─────────────────────────────────────────┤
│ BottomNav (Home [활성] | DSC HUB | ...) │
└─────────────────────────────────────────┘
```

**컴포넌트:**
- `WelcomeCard` — 환영 메시지
- `AppCard` (3개) — DSC HUB, Personal, Travel 바로가기
- `RecentActivityList` — 최근 활동 피드
- `BottomNav`

**데이터 출처:**
- Supabase: `user_profiles` (이름, 프로필 사진)
- 각 앱의 `updated_at` 기반 최근 활동

---

#### 📱 `/jeepney-personal` — 개인이력 Hub

**목적:** 경력 + 프로젝트 + 성과 통합 보기

**레이아웃 (옵션 A: 타임라인):**
```
┌─────────────────────────────────────────┐
│ JEEPNEY Header                          │
├─────────────────────────────────────────┤
│ [Timeline] [Companies] [Projects] [Achievements] │  ← 탭
├─────────────────────────────────────────┤
│                                          │
│  2026年 May  ━━━━━━━━━━━━━━━━━━         │
│              │ Project A 진행 중        │
│              │ (Daechang Seat)          │
│              │                          │
│  2025年 Dec  ━━━━━━━━━━━━━━━━━━         │
│              │ Company: Daechang Seat   │
│              │ Position: GM             │
│              │                          │
│  ...                                     │
│                                          │
│  [Load More]                             │
│                                          │
├─────────────────────────────────────────┤
│ BottomNav (Home | DSC HUB | Personal [활성] |...) │
└─────────────────────────────────────────┘
```

**컴포넌트:**
- `PersonalTabNav` — 4개 탭 (Timeline | Companies | Projects | Achievements)
- `TimelineItem` — 연도별/항목별 카드
- `FAB` (Floating Action Button) — [+ Add] (모바일)

---

#### 🏢 `/jeepney-personal/career/companies` — 회사 목록

**목적:** 경력사 관리

**레이아웃:**
```
┌─────────────────────────────────────────┐
│ JEEPNEY Header                          │
├─────────────────────────────────────────┤
│ [Timeline] [Companies] [Projects] [Achievements] │
├─────────────────────────────────────────┤
│                                          │
│ [Search...] [+ New Company]              │
│                                          │
│ ┌──────────────────────────────────┐   │
│ │ Daechang Seat (Chennai)          │   │
│ │ GM | 2025-Present                │   │
│ │ Production, Tech, Maintenance    │   │
│ │ [View] [Edit]                    │   │
│ └──────────────────────────────────┘   │
│                                          │
│ ┌──────────────────────────────────┐   │
│ │ Previous Company                 │   │
│ │ Senior Engineer | 2020-2024      │   │
│ │ ...                              │   │
│ └──────────────────────────────────┘   │
│                                          │
└─────────────────────────────────────────┘
```

**데이터 필드:**
```
- company_name: string
- position: string
- industry: string
- department: string
- start_date: date
- end_date: date (nullable)
- description: text
- logo_url: string
- created_at, updated_at
```

---

#### 🎯 `/jeepney-personal/career/projects` — 프로젝트 목록

**목적:** 담당 프로젝트 관리

**구조:** 회사 목록과 유사

**데이터 필드:**
```
- project_name: string
- company_id: uuid (FK → companies)
- role: string
- tech_stack: json (예: ["Next.js", "React", "Supabase"])
- description: text
- start_date: date
- end_date: date (nullable)
- status: enum (in_progress | completed | archived)
- impact: text (결과/성과)
- url: string (프로젝트 링크)
```

---

#### ⭐ `/jeepney-personal/career/achievements` — 성과/스킬/인증서

**목적:** 성과 및 인증 관리

**레이아웃:**
```
┌──────────────────────────────────┐
│ Achievements                     │
├──────────────────────────────────┤
│ [All] [Skills] [Certifications] [Awards] │
├──────────────────────────────────┤
│                                  │
│ ▪ Lean Six Sigma (Certification) │
│   Issued by: Lean Global         │
│   Date: 2025-06                  │
│   [Edit] [Remove]                │
│                                  │
│ ▪ IoT Architecture Design (Skill)│
│   Endorsed: 5 colleagues         │
│                                  │
│ ▪ Best Performance Award (Award) │
│   2024 DSC Chennai               │
│                                  │
└──────────────────────────────────┘
```

**데이터 필드:**
```
- achievement_id: uuid (PK)
- user_id: uuid (FK)
- achievement_type: enum (skill | certification | award | publication)
- title: string
- description: text
- issuer_or_source: string
- date: date
- url: string (credential link)
- proof_file: string (URL)
- visible_to: enum (private | connections | public)
```

---

#### 🏭 `/dsc-hub` — DSC Hub 대시보드

**목적:** FMS + Travel 통합 대시보드

**레이아웃:**
```
┌─────────────────────────────────────────┐
│ JEEPNEY Header                          │
├─────────────────────────────────────────┤
│ [Personal] [DSC FMS] [Travel]           │  ← 메인 탭 (L2)
├─────────────────────────────────────────┤
│                                          │
│  DSC FMS Overview                       │
│                                          │
│  ┌──────────────┬──────────────┐        │
│  │ 설비 상태    │ BM 이력      │        │
│  │ Active: 120  │ Urgent: 3    │        │
│  │ Idle-NR: 5   │ Scheduled: 12│        │
│  └──────────────┴──────────────┘        │
│                                          │
│  ┌──────────────┬──────────────┐        │
│  │ PM 현황      │ KPI 실적     │        │
│  │ Due: 2건     │ On-Track: 8  │        │
│  │ Overdue: 1   │ At-Risk: 2   │        │
│  └──────────────┴──────────────┘        │
│                                          │
│  [View All Assets] [View All PM] [View KPI] │
│                                          │
│  Recent BM & PM Logs:                   │
│  • Asset-123: BM 완료 (1시간 전)        │
│  • Asset-456: PM 예정 (내일)            │
│                                          │
├─────────────────────────────────────────┤
│ BottomNav                               │
└─────────────────────────────────────────┘
```

**컴포넌트:**
- `DscHubTabNav` — 3개 탭 (Personal | FMS | Travel)
- `QuickStatCard` — 상태 요약 (4개)
- `RecentActivityFeed` — 최근 활동

---

#### ✈️ `/dsc-hub/travel` — 여행기록 목록

**목적:** 출장 기록 중앙 관리

**레이아웃:**
```
┌─────────────────────────────────────────┐
│ JEEPNEY Header                          │
├─────────────────────────────────────────┤
│ [Personal] [DSC FMS] [Travel]           │
├─────────────────────────────────────────┤
│                                          │
│ [Search...] [Filter ▼] [+ New Trip]    │
│                                          │
│ Upcoming:                                │
│ ┌──────────────────────────────────┐   │
│ │ 🇮🇳 Chennai → Delhi              │   │
│ │ May 15-18, 2026 | 4 days         │   │
│ │ Business | ₹85,000 budgeted      │   │
│ │ [View Details] [Edit] [Delete]   │   │
│ └──────────────────────────────────┘   │
│                                          │
│ Completed:                               │
│ ┌──────────────────────────────────┐   │
│ │ 🇰🇷 Seoul Visit                   │   │
│ │ Apr 1-5, 2026 | ₹92,340 spent   │   │
│ │ [View Report]                    │   │
│ └──────────────────────────────────┘   │
│                                          │
└─────────────────────────────────────────┘
```

**데이터 필드:**
```
- trip_id: uuid (PK)
- user_id: uuid (FK)
- trip_name: string
- origin_city: string
- destination_city: string
- country: string
- start_date: date
- end_date: date
- purpose: enum (business | leisure | personal)
- budget: decimal
- actual_spent: decimal
- status: enum (planned | in_progress | completed)
- notes: text
```

---

#### 🛂 `/dsc-hub/travel/[id]` — 여행 상세

**탭 구조:**
```
[Overview] [Schedule] [Costs] [Photos] [Map]
```

**Overview 탭:**
```
Trip: Chennai → Seoul (Apr 1-5, 2026)
Status: Completed | Budget: ₹92,340 | Spent: ₹92,340

Flights:
• Outbound: AI 402, Apr 1, 09:55 → 15:30 (6h 35m)
• Return: AI 401, Apr 5, 17:00 → 23:30 (6h 30m)

Hotels:
• Seoul Plaza Hotel (4 nights) — ₹72,000 booked

Transportation:
• Airport Transfer: ₹2,400
• Subway Card: ₹5,000
• Taxi: ₹13,000

Meals:
• Breakfast: ₹4,500
• Lunch: ₹5,200
• Dinner: ₹6,240
...
```

**Schedule 탭:**
```
Apr 1 (Day 1 - Arrival)
- 09:55: Flight AI 402 Departs (Chennai)
- 15:30: Flight arrives (Seoul Incheon)
- 17:00: Hotel check-in
- 19:00: Dinner at Myeongdong

Apr 2 (Day 2 - Meeting)
- 10:00: Daechang HQ Meeting
- 12:00: Lunch with Team
- 14:00: Factory Tour
- 18:00: Free time

...
```

**Costs 탭:**
```
┌────────────────┬────────┬────────┬─────────┐
│ Category       │ Budget │ Spent  │ Variance│
├────────────────┼────────┼────────┼─────────┤
│ Flights        │ 45,000 │ 45,000 │ 0%      │
│ Accommodation  │ 30,000 │ 28,800 │ -4%     │
│ Food           │ 8,000  │ 8,450  │ +5.6%   │
│ Transportation │ 7,000  │ 6,800  │ -2.9%   │
│ Misc           │ 2,340  │ 2,290  │ -2%     │
├────────────────┼────────┼────────┼─────────┤
│ TOTAL          │ 92,340 │ 91,340 │ -1%     │
└────────────────┴────────┴────────┴─────────┘
```

**Photos 탭:**
```
[Grid of travel photos with captions]
[Upload Photo] [Auto-organize by date]
```

**Map 탭:**
```
[Google Maps embed or Leaflet]
- 경로 표시: Chennai → Seoul
- 마커: 비행장, 호텔, 주요 위치
```

---

### 4.3 설정 & 프로필 페이지

#### ⚙️ `/settings` — 설정 메인

**탭:**
```
[Profile] [Language] [Theme] [Notifications] [Privacy]
```

**Profile 탭:**
```
Profile Picture: [Avatar] [Upload]
Full Name: [Input]
Email: [Display only]
Phone: [Input]
Bio: [Textarea]

[Save] [Cancel]
```

**Language 탭:**
```
Display Language:
○ 한국어 (Korean)
○ English
○ हिन्दी (Hindi)
○ தமிழ் (Tamil)

[Save]
```

**Theme 탭:**
```
Color Scheme:
○ Dark (Current)
○ Light (Coming soon)
○ Auto (System)

Accent Color:
○ Cyan (Current)
○ Violet
○ Blue
○ Green

[Save]
```

**Notifications 탭:**
```
☑ Email Notifications
  ☑ Weekly Summary
  ☑ Urgent Alerts

☑ In-App Notifications
  ☑ Messages
  ☑ Updates

☑ Push Notifications
  ☑ BM Urgent
  ☑ PM Due Today
```

**Privacy 탭:**
```
Visibility:
○ Private (Only me)
○ Connections (Team)
○ Public

Data Management:
[Download My Data]
[Delete Account] ⚠️
```

---

### 4.4 신규 컴포넌트 목록

| 컴포넌트 | 파일 | 역할 | 상태 |
|---------|------|------|------|
| `JeepneyLayout` | `components/jeepney/JeepneyLayout.js` | 루트 래퍼 | 🆕 신규 |
| `JeepneyHeader` | `components/jeepney/JeepneyHeader.js` | 헤더 (확장) | 🔧 수정 |
| `TabNav` | `components/jeepney/TabNav.js` | 일반 탭 네비게이션 | 🆕 신규 |
| `BottomNav` | `components/BottomNav.js` | 하단 고정 네비 | ✓ 기존 |
| `Card` | `components/ui/Card.js` | 카드 컨테이너 | 🆕 신규 |
| `Button` | `components/ui/Button.js` | 버튼 (다양한 타입) | 🆕 신규 |
| `Input` | `components/ui/Input.js` | 입력 필드 | 🆕 신규 |
| `Modal` | `components/ui/Modal.js` | 모달 | 🆕 신규 |
| `BottomSheet` | `components/ui/BottomSheet.js` | 바텀 시트 (모바일) | 🆕 신규 |
| `Avatar` | `components/ui/Avatar.js` | 사용자 아바타 | 🆕 신규 |
| `Spinner` | `components/ui/Spinner.js` | 로딩 스피너 | 🆕 신규 |
| `PersonalTabNav` | `components/career/PersonalTabNav.js` | 개인이력 탭 | 🆕 신규 |
| `TimelineItem` | `components/career/TimelineItem.js` | 타임라인 항목 | 🆕 신규 |
| `CompanyCard` | `components/career/CompanyCard.js` | 회사 카드 | 🆕 신규 |
| `ProjectCard` | `components/career/ProjectCard.js` | 프로젝트 카드 | 🆕 신규 |
| `AchievementCard` | `components/career/AchievementCard.js` | 성과 카드 | 🆕 신규 |
| `TravelCard` | `components/travel/TravelCard.js` | 여행 카드 | 🆕 신규 |
| `TravelTabNav` | `components/travel/TravelTabNav.js` | 여행 상세 탭 | 🆕 신규 |
| `StatCard` | `components/ui/StatCard.js` | 통계 카드 | 🆕 신규 |
| `ActivityFeed` | `components/ui/ActivityFeed.js` | 활동 피드 | 🆕 신규 |

---

## 5. 개인이력 배치 옵션 비교

### 5.1 Option A: DSC HUB 내 탭으로 통합

**구조:**
```
DSC HUB
├── [Personal] [DSC FMS] [Travel]  ← 메인 탭
│   └── Personal: /jeepney-personal 콘텐츠 렌더링
└── FMS: /dsc-hub/fms 콘텐츠 렌더링
```

**장점:**
✅ 통일된 UI/네비게이션  
✅ 이동 경로 단순 (DSC HUB 내에서 모두 처리)  
✅ 반응형 설계 용이  
✅ 모바일 최적화 (탭 스위핑)  

**단점:**
❌ Personal이 DSC (업무)와 섞임  
❌ 개인이력 독립성 감소  
❌ 향후 "Personal" 앱 확장 어려움  

**추천:** ⭐⭐⭐ (현재 구조에 적합)

---

### 5.2 Option B: 독립 앱으로 분리

**구조:**
```
JEEPNEY 메인
├── DSC HUB  → /dsc-hub
│   ├── [DSC FMS] [Travel]
├── Personal → /jeepney-personal
│   ├── [Companies] [Projects] [Achievements]
└── ...
```

**레이아웃:**
```
Header: [DSC HUB] [Personal] [Travel] [Settings]
```

**장점:**
✅ 명확한 구분 (업무 vs 개인)  
✅ Personal 앱 독립적 확장 가능  
✅ 권한 제어 간단 (User ≠ Team members)  
✅ URL 직관적 (/dsc-hub vs /personal)  

**단점:**
❌ 네비게이션 복잡도 증가  
❌ 앱 전환 시 컨텍스트 손실  
❌ 모바일에서 메뉴 비좁음  

**추천:** ⭐⭐ (향후 공유 기능 없을 경우)

---

### 5.3 최종 권장: **Option A (DSC HUB 내 탭)**

**이유:**
1. **사용성:** 사용자는 "포탈 → DSC HUB 선택 → 그 안에서 Personal/FMS 전환" 직관적
2. **확장성:** 향후 다른 앱 추가 시 같은 구조 적용 가능
3. **모바일 우선:** 탭 네비게이션이 스마트폰에 최적화
4. **기존 패턴 유지:** 현재 FMS Portal의 "Career" 탭과 일관성

**최종 구조:**
```
Home (/)
└── DSC HUB (/dsc-hub)
    ├── Tab 1: Personal History (/jeepney-personal)
    ├── Tab 2: DSC FMS (/dsc-hub/fms)
    └── Tab 3: Travel Records (/dsc-hub/travel)
```

---

## 6. DB 스키마 (신규/변경)

### 6.1 신규 테이블: `user_career`

```sql
CREATE TABLE user_career (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES user_companies(id) ON DELETE SET NULL,
  position VARCHAR(128) NOT NULL,
  department VARCHAR(128),
  start_date DATE NOT NULL,
  end_date DATE,
  description TEXT,
  is_current BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  CONSTRAINT check_end_after_start CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE INDEX idx_user_career_user_id ON user_career(user_id);
CREATE INDEX idx_user_career_company_id ON user_career(company_id);
```

### 6.2 신규 테이블: `user_companies`

```sql
CREATE TABLE user_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name VARCHAR(256) NOT NULL,
  industry VARCHAR(128),
  logo_url TEXT,
  website_url TEXT,
  location VARCHAR(256),
  notes TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_user_companies_user_id ON user_companies(user_id);
```

### 6.3 신규 테이블: `user_projects`

```sql
CREATE TABLE user_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES user_companies(id) ON DELETE SET NULL,
  project_name VARCHAR(256) NOT NULL,
  description TEXT,
  role VARCHAR(128),
  tech_stack JSON, -- ["Next.js", "React", "Supabase"]
  start_date DATE NOT NULL,
  end_date DATE,
  status VARCHAR(32) DEFAULT 'in_progress', -- 'completed', 'archived'
  impact TEXT,
  project_url TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_user_projects_user_id ON user_projects(user_id);
```

### 6.4 신규 테이블: `user_achievements`

```sql
CREATE TABLE user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_type VARCHAR(32) NOT NULL, -- 'skill', 'certification', 'award', 'publication'
  title VARCHAR(256) NOT NULL,
  description TEXT,
  issuer VARCHAR(256),
  achievement_date DATE,
  credential_url TEXT,
  proof_file_url TEXT,
  visible_to VARCHAR(32) DEFAULT 'private', -- 'private', 'connections', 'public'
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_user_achievements_user_id ON user_achievements(user_id);
```

### 6.5 신규 테이블: `travel_trips`

```sql
CREATE TABLE travel_trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trip_name VARCHAR(256) NOT NULL,
  origin_city VARCHAR(128) NOT NULL,
  destination_city VARCHAR(128) NOT NULL,
  country_code VARCHAR(2),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  purpose VARCHAR(32), -- 'business', 'leisure', 'personal'
  budget DECIMAL(10,2),
  actual_spent DECIMAL(10,2),
  status VARCHAR(32) DEFAULT 'planned', -- 'in_progress', 'completed'
  notes TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  CONSTRAINT check_end_after_start CHECK (end_date >= start_date)
);

CREATE INDEX idx_travel_trips_user_id ON travel_trips(user_id);
```

### 6.6 신규 테이블: `travel_itinerary`

```sql
CREATE TABLE travel_itinerary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES travel_trips(id) ON DELETE CASCADE,
  event_date DATE NOT NULL,
  event_time TIME,
  event_type VARCHAR(32), -- 'flight', 'hotel', 'meeting', 'activity', 'meal'
  title VARCHAR(256) NOT NULL,
  description TEXT,
  location VARCHAR(256),
  cost DECIMAL(10,2),
  booking_reference VARCHAR(128),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_travel_itinerary_trip_id ON travel_itinerary(trip_id);
CREATE INDEX idx_travel_itinerary_date ON travel_itinerary(event_date);
```

### 6.7 신규 테이블: `travel_expenses`

```sql
CREATE TABLE travel_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES travel_trips(id) ON DELETE CASCADE,
  category VARCHAR(64), -- 'flight', 'accommodation', 'food', 'transportation', 'misc'
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'INR',
  description VARCHAR(256),
  expense_date DATE,
  receipt_url TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_travel_expenses_trip_id ON travel_expenses(trip_id);
```

### 6.8 신규 테이블: `travel_photos`

```sql
CREATE TABLE travel_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES travel_trips(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  caption TEXT,
  taken_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_travel_photos_trip_id ON travel_photos(trip_id);
```

### 6.9 기존 테이블 확장: `user_profiles`

```sql
-- 신규 컬럼 추가
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS 
  bio TEXT,
  profile_image_url TEXT,
  phone VARCHAR(20),
  theme VARCHAR(32) DEFAULT 'dark', -- 'dark', 'light', 'auto'
  accent_color VARCHAR(32) DEFAULT 'cyan', -- 'cyan', 'violet', 'blue', 'green'
  language VARCHAR(5) DEFAULT 'en'; -- 'en', 'ko', 'hi', 'ta'
```

### 6.10 Row Level Security (RLS)

```sql
-- user_career: 자신의 데이터만 접근
CREATE POLICY "Users can access their own career" ON user_career
  FOR ALL USING (auth.uid() = user_id);

-- user_companies: 자신의 데이터만 접근
CREATE POLICY "Users can access their own companies" ON user_companies
  FOR ALL USING (auth.uid() = user_id);

-- user_projects: 자신의 데이터만 접근
CREATE POLICY "Users can access their own projects" ON user_projects
  FOR ALL USING (auth.uid() = user_id);

-- user_achievements: visible_to에 따라 접근 제어
CREATE POLICY "Users can access achievements" ON user_achievements
  FOR SELECT USING (
    auth.uid() = user_id -- 자신
    OR visible_to = 'public' -- 공개
    OR (visible_to = 'connections' AND EXISTS (
      SELECT 1 FROM connections 
      WHERE (user_id_1 = auth.uid() AND user_id_2 = user_achievements.user_id)
         OR (user_id_2 = auth.uid() AND user_id_1 = user_achievements.user_id)
    ))
  );

-- travel_trips: 자신의 데이터만 접근
CREATE POLICY "Users can access their own trips" ON travel_trips
  FOR ALL USING (auth.uid() = user_id);
```

---

## 7. 구현 로드맵

### Phase 1: 기초 UI 프레임워크 (1주)

**목표:** 모던 디자인 시스템 구축 + 메인 레이아웃 완성

| 작업 | 파일 | 상태 |
|------|------|------|
| UI 색상/타이포그래피 정의 | `lib/design-tokens.js` | 🆕 |
| 기본 Button 컴포넌트 | `components/ui/Button.js` | 🆕 |
| 기본 Card 컴포넌트 | `components/ui/Card.js` | 🆕 |
| 기본 Input 컴포넌트 | `components/ui/Input.js` | 🆕 |
| Avatar 컴포넌트 | `components/ui/Avatar.js` | 🆕 |
| TabNav 컴포넌트 | `components/jeepney/TabNav.js` | 🆕 |
| JeepneyHeader 확장 | `components/jeepney/JeepneyHeader.js` | 🔧 |
| JeepneyLayout 래퍼 | `components/jeepney/JeepneyLayout.js` | 🆕 |
| 모바일 반응형 테스트 | — | 🔧 |

**산출물:**
- Figma/스크린샷: 전체 색상팔레트, 컴포넌트 라이브러리
- 문서: `DESIGN_TOKENS.md` (색상, 폰트, 여백 정리)

---

### Phase 2: 메인 페이지 & 네비게이션 (1주)

**목표:** JEEPNEY 홈 + DSC HUB 대시보드 완성

| 작업 | 파일 | 상태 |
|------|------|------|
| JEEPNEY 홈 (/page) | `pages/index.js` | 🔧 |
| DSC HUB 메인 (/dsc-hub) | `pages/dsc-hub/index.js` | 🆕 |
| 메인 탭 네비게이션 로직 | `components/jeepney/JeepneyHeader.js` | 🔧 |
| 설정 페이지 스켈레톤 | `pages/settings/index.js` | 🆕 |
| API: user 프로필 조회 | `pages/api/user/profile.js` | 🆕 |

**산출물:**
- 데모 페이지: / (홈), /dsc-hub (DSC Hub)
- 문서: 네비게이션 흐름 다이어그램

---

### Phase 3: 개인이력 (Personal History) (2주)

**목표:** Companies → Projects → Achievements 완전 구현

| 작업 | 파일 | 상태 |
|------|------|------|
| DB 테이블 생성 | SQL migration | 🆕 |
| 회사 목록 페이지 | `pages/jeepney-personal/career/companies.js` | 🆕 |
| 회사 상세 + 편집 | `pages/jeepney-personal/career/companies/[id].js` | 🆕 |
| 회사 신규 추가 | `pages/jeepney-personal/career/companies/new.js` | 🆕 |
| 프로젝트 목록 | `pages/jeepney-personal/career/projects.js` | 🆕 |
| 프로젝트 상세 + 편집 | `pages/jeepney-personal/career/projects/[id].js` | 🆕 |
| 성과 목록 | `pages/jeepney-personal/career/achievements.js` | 🆕 |
| 타임라인 페이지 | `pages/jeepney-personal/timeline.js` | 🆕 |
| API 엔드포인트 (CRUD) | `pages/api/career/*` | 🆕 |
| PersonalTabNav 컴포넌트 | `components/career/PersonalTabNav.js` | 🆕 |
| 카드 컴포넌트들 | `components/career/*.js` | 🆕 |

**DB 작업:**
```sql
-- 1. 테이블 생성
CREATE TABLE user_companies (...)
CREATE TABLE user_career (...)
CREATE TABLE user_projects (...)
CREATE TABLE user_achievements (...)

-- 2. RLS 정책 설정
CREATE POLICY "..." ON user_companies ...
CREATE POLICY "..." ON user_projects ...
...

-- 3. 테스트 데이터 삽입
INSERT INTO user_companies VALUES (...)
```

---

### Phase 4: 여행기록 (Travel Records) (2주)

**목표:** 여행 관리 + 스케줄 + 비용 + 지도

| 작업 | 파일 | 상태 |
|------|------|------|
| DB 테이블 생성 | SQL migration | 🆕 |
| 여행 목록 페이지 | `pages/dsc-hub/travel/index.js` | 🆕 |
| 여행 상세 (5개 탭) | `pages/dsc-hub/travel/[id]/index.js` | 🆕 |
| 여행 신규/편집 | `pages/dsc-hub/travel/[id]/edit.js` | 🆕 |
| 일정 탭 | `pages/dsc-hub/travel/[id]/schedule.js` | 🆕 |
| 비용 탭 + 차트 | `pages/dsc-hub/travel/[id]/costs.js` | 🆕 |
| 사진 탭 + 갤러리 | `pages/dsc-hub/travel/[id]/photos.js` | 🆕 |
| 지도 탭 | `pages/dsc-hub/travel/[id]/map.js` | 🆕 |
| API 엔드포인트 (CRUD) | `pages/api/travel/*` | 🆕 |
| TravelCard 컴포넌트 | `components/travel/TravelCard.js` | 🆕 |
| TravelTabNav 컴포넌트 | `components/travel/TravelTabNav.js` | 🆕 |

**외부 라이브러리:**
- 지도: Leaflet + react-leaflet (또는 Google Maps API)
- 갤러리: 커스텀 그리드 또는 Lightbox 라이브러리

---

### Phase 5: 설정 & 사용자 관리 (1주)

**목표:** 프로필 + 언어 + 테마 + 알림 설정

| 작업 | 파일 | 상태 |
|------|------|------|
| 프로필 편집 | `pages/settings/profile.js` | 🆕 |
| 언어 설정 | `pages/settings/language.js` | 🆕 |
| 테마 설정 | `pages/settings/theme.js` | 🆕 |
| 알림 설정 | `pages/settings/notifications.js` | 🆕 |
| 프라이버시 설정 | `pages/settings/privacy.js` | 🆕 |
| API: 프로필 업데이트 | `pages/api/user/profile.js` | 🔧 |

---

### Phase 6: 통합 & 최적화 (1주)

**목표:** 전체 통합, 성능 최적화, 검수

| 작업 | 상태 |
|------|------|
| 모든 페이지 연결 테스트 | 🔧 |
| 모바일 반응형 검수 | 🔧 |
| 다국어 (en, ko, hi, ta) 적용 | 🆕 |
| 다크모드 완성도 검증 | 🔧 |
| 성능 측정 (Lighthouse) | 🔧 |
| SEO 메타 태그 | 🆕 |
| 에러 바운더리 추가 | 🔧 |
| 로딩 상태 완성도 | 🔧 |

---

### 타임라인

```
Week 1: Phase 1 (UI 프레임워크)
Week 2: Phase 2 (메인 페이지 + 네비)
Week 3-4: Phase 3 (개인이력)
Week 5-6: Phase 4 (여행기록)
Week 7: Phase 5 (설정)
Week 8: Phase 6 (통합 & 최적화)

예상 기간: 8주 (전체)
```

---

## 📋 체크리스트

### 설계 검수 항목

- [ ] 아키텍처 구조 승인
- [ ] 색상팔레트 & 타이포그래피 확인
- [ ] 페이지별 와이어프레임 검토
- [ ] DB 스키마 검증
- [ ] API 엔드포인트 정리
- [ ] 개인이력 배치 방식 최종 확정
- [ ] 모바일 반응형 기준 확인
- [ ] 다국어 언어 코드 정의

### 개발 검수 항목 (Phase별)

**Phase 1:**
- [ ] 모든 UI 컴포넌트 구현 완료
- [ ] Storybook 또는 컴포넌트 갤러리 작성
- [ ] 디자인 토큰 적용 검증

**Phase 2:**
- [ ] 홈 페이지 데이터 연동 완료
- [ ] 네비게이션 라우팅 정상 작동
- [ ] 모바일 에뮬레이터 테스트 통과

**Phase 3:**
- [ ] DB CRUD 작동 확인
- [ ] RLS 보안 정책 검증
- [ ] 데이터 검증 (필수값, 날짜 범위 등)

**Phase 4:**
- [ ] 지도 렌더링 확인
- [ ] 비용 계산 정확성 검증
- [ ] 여행 중복 방지 로직

**Phase 5:**
- [ ] 설정 저장/로드 확인
- [ ] 다국어 전환 정상 작동
- [ ] 테마 토글 동작 확인

**Phase 6:**
- [ ] 전체 E2E 테스트
- [ ] Lighthouse 성능 점수 80+ 달성
- [ ] 크로스 브라우저 테스트 (Chrome, Safari, Firefox)
- [ ] iOS/Android 모바일 테스트

---

## 📚 참고 자료

- **Vercel 대시보드:** https://vercel.com/dashboard
- **Notion 인터페이스:** https://notion.so
- **Linear 앱:** https://linear.app
- **Figma 커뮤니티:** https://figma.com/community
- **Supabase UI:** https://ui.supabase.com
- **Heroicons:** https://heroicons.com
- **Tailwind CSS:** https://tailwindcss.com
- **Next.js 14 Docs:** https://nextjs.org/docs
- **React 18 Docs:** https://react.dev

---

## 문서 생성 이력

| 날짜 | 버전 | 작업 | 담당 |
|------|------|------|------|
| 2026-05-13 | 1.0 | 초판 작성 | 플레너 |

---

**다음 단계:** 웹개발자가 Phase 1부터 시작 (UI 컴포넌트 구현)
