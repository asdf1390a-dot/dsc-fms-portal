# JEEPNEY Personal Backup App — Phase 2 UI/UX 정교화 가이드

**작성일:** 2026-05-14  
**버전:** 1.0 — UI/UX 상세 설계  
**대상:** Web-Builder (개발 실무 가이드)

---

## 1. 디자인 시스템

### 1.1 색상 팔레트

#### Primary Colors
```
Primary Blue: #2563EB
  용도: 주요 버튼, 링크, Active 상태
  명암비: WCAG AA (최소 4.5:1)
  
Primary Dark: #1E40AF
  용도: Hover/Active 상태, 텍스트 강조
  
Primary Light: #DBEAFE
  용도: 배경, 선택 상태
```

#### Status Colors
```
Success Green: #10B981
  용도: 완료, 성공, 활성화
  Hex: #10B981 / RGB(16, 185, 129)
  
Warning Amber: #F59E0B
  용도: 경고, 주의, 만료 예정
  Hex: #F59E0B / RGB(245, 158, 11)
  
Error Red: #EF4444
  용도: 실패, 에러, 초과
  Hex: #EF4444 / RGB(239, 68, 68)
  
Info Cyan: #06B6D4
  용도: 정보, 진행중, 임시
  Hex: #06B6D4 / RGB(6, 182, 212)
```

#### Neutral Grays
```
Gray-50: #F9FAFB    (배경, 분리선)
Gray-100: #F3F4F6   (호버 배경)
Gray-300: #D1D5DB   (테두리)
Gray-500: #6B7280   (보조 텍스트)
Gray-700: #374151   (본문)
Gray-900: #111827   (제목, 강조)
```

#### Usage Rules
```
텍스트: Gray-900 (제목) / Gray-700 (본문) / Gray-500 (보조)
배경: White (#FFFFFF) 또는 Gray-50 (#F9FAFB)
테두리: Gray-300 (#D1D5DB) - 1px
그림자: 
  - Light: 0 1px 2px rgba(0,0,0,0.05)
  - Medium: 0 4px 6px rgba(0,0,0,0.1)
  - Heavy: 0 10px 15px rgba(0,0,0,0.1)
```

### 1.2 타이포그래피

#### Font Stack
```css
Font Family: 
  -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, 
  "Noto Sans", "Noto Sans CJK KR", sans-serif

한글: Pretendard, "Noto Sans KR", -apple-system
```

#### Font Sizes & Weights
```
Display (H1): 32px / 700 Bold
  용도: 페이지 제목
  Line Height: 1.2 (38px)
  Letter Spacing: -0.5px

Heading (H2): 24px / 700 Bold
  용도: 섹션 제목
  Line Height: 1.3 (31px)

Subheading (H3): 18px / 600 Semibold
  용도: 서브섹션, 모달 제목
  Line Height: 1.4 (25px)

Body Large (14px): 400 Regular / 600 Semibold
  용도: 본문, 버튼, 입력 필드
  Line Height: 1.5 (21px)

Body (13px): 400 Regular
  용도: 설명, 보조 텍스트
  Line Height: 1.5 (20px)

Caption (12px): 400 Regular / 500 Medium
  용도: 라벨, 메타 정보
  Line Height: 1.4 (17px)
```

#### Hierarchy Example
```
H1 "백업 관리"                           32px / 700
  └─ H2 "자동 백업 설정"                 24px / 700
    └─ H3 "스케줄"                       18px / 600
      └─ Label "시간"                    13px / 500
        └─ Input value "02:00"           13px / 400
      └─ Help text "한국 표준시"          12px / 400
```

### 1.3 간격 (Spacing)

#### Spacing Scale
```
xs: 4px      (매우 작은 간격)
sm: 8px      (작은 간격)
md: 12px     (기본 간격)
lg: 16px     (중간 간격)
xl: 24px     (큰 간격)
2xl: 32px    (매우 큰 간격)
3xl: 48px    (섹션 간격)
```

#### Padding Rules
```
컨테이너: 20px (모바일) / 24px (데스크톱)
카드: 16px
섹션: 32px (위/아래)
인라인 요소: 8px (좌우)
```

#### Margin Rules
```
섹션 간 여백: 32px
컴포넌트 간 여백: 16px
라인 아이템 간: 12px
```

### 1.4 Border Radius

```
Controls (버튼, 입력): 6px
Cards (컨테이너): 8px
Modals (대화상자): 12px
Badges (라벨): 4px
Pill buttons: 999px (원형)
```

### 1.5 그림자 (Shadows)

```
Subtle: 0 1px 2px 0 rgba(0, 0, 0, 0.05)
  용도: 미세한 깊이

Soft: 0 4px 6px -1px rgba(0, 0, 0, 0.1)
  용도: 카드, 호버 상태

Medium: 0 10px 15px -3px rgba(0, 0, 0, 0.1)
  용도: 모달, 드롭다운

Strong: 0 20px 25px -5px rgba(0, 0, 0, 0.1)
  용도: 오버레이, 최상위
```

---

## 2. 화면별 상세 설계 (4 Screens)

### 2.1 AutoBackupSettings — 자동 백업 설정

#### Layout Structure
```
┌──────────────────────────────────────────────────────────────┐
│  📌 Breadcrumb: 백업 관리 > 자동 백업 설정                     │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  🔄 자동 백업 설정          [Save] [Reset]    (우측)          │
│  ──────────────────────────────────────────────────────────  │
│                                                               │
│  [ Padding: 24px ]                                           │
│                                                               │
│  ├─ 📋 백업 스케줄                                           │
│  │  ────────────────────────────────────────────────────    │
│  │  Active Toggle: [●═ ON] ← 이 상태를 명확하게              │
│  │                                                           │
│  │  시간 설정:                                               │
│  │  ┌─────────────────────────────────────────────────────┐ │
│  │  │ 시간 (HH:MM)  │  [02:00 ▼] ← Dropdown or Time Picker│ │
│  │  │ 타임존        │  [한국 표준시 ▼]                     │ │
│  │  └─────────────────────────────────────────────────────┘ │
│  │                                                           │
│  │  반복 간격:                                               │
│  │  [● 매일] [○ 주 1회] [○ 월 1회] ← Radio Buttons          │
│  │                                                           │
│  │  다음 백업: 2026-05-15 02:00 KST  ← 예측값 표시         │
│  │                                                           │
│  ├─ 📦 보관 정책                                            │
│  │  ────────────────────────────────────────────────────    │
│  │  보관기간:                                                │
│  │  ┌─────────────────────────────────────────────────────┐ │
│  │  │ [30일] [90일 ✓] [180일] [수동]                      │ │
│  │  └─────────────────────────────────────────────────────┘ │
│  │                                                           │
│  │  할당량:                                                  │
│  │  ┌─────────────────────────────────────────────────────┐ │
│  │  │ 최대 저장소: [10 GB ▼]                               │ │
│  │  │ 경고 임계값: [80% ▼]                                 │ │
│  │  └─────────────────────────────────────────────────────┘ │
│  │                                                           │
│  │  [ ☑ 자동 삭제 활성화 ] ← Checkbox                      │
│  │  └─ 시간 초과 백업 자동 정리                              │
│  │                                                           │
│  ├─ 📋 최근 자동 백업 히스토리                               │
│  │  ────────────────────────────────────────────────────    │
│  │                                                           │
│  │  ┌─ 2026-05-13 02:05 ─────────────────────────────────┐ │
│  │  │ ✅ 완료                                             │ │
│  │  │ 크기: 1.24 GB  │ 파일: 47개 │ 소요: 4분 23초       │ │
│  │  │ [다운로드] [삭제]                                    │ │
│  │  └─────────────────────────────────────────────────────┘ │
│  │                                                           │
│  │  ┌─ 2026-05-12 02:10 ─────────────────────────────────┐ │
│  │  │ ✅ 완료                                             │ │
│  │  │ 크기: 1.19 GB  │ 파일: 45개 │ 소요: 3분 58초       │ │
│  │  │ [다운로드] [삭제]                                    │ │
│  │  └─────────────────────────────────────────────────────┘ │
│  │                                                           │
│  │  ┌─ 2026-05-11 02:08 ─────────────────────────────────┐ │
│  │  │ ⏳ 진행 중... (3분 경과)                              │ │
│  │  │ [████░░░░░░░░░░░░░░] 35%                           │ │
│  │  └─────────────────────────────────────────────────────┘ │
│  │                                                           │
│  ├─ [수동 백업 지금 실행] ← CTA Button (Primary)             │
│  │                                                           │
│  └─ [저장 변경사항] [초기화]  ← 우측 상단에 스티키 배치      │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

#### Component Composition
```jsx
<AutoBackupSettings>
  ├─ Header (title, breadcrumb)
  ├─ Section "BackupSchedule"
  │   ├─ Toggle (enabled/disabled)
  │   ├─ TimeInput + TimezoneSelect
  │   ├─ RadioGroup (interval: daily/weekly/monthly)
  │   ├─ Text "Next backup at: ..."
  │   └─ Icon (info)
  │
  ├─ Section "RetentionPolicy"
  │   ├─ ButtonGroup (retention: 30/90/180/manual)
  │   ├─ NumberInput (max storage GB)
  │   ├─ Select (warning threshold)
  │   ├─ Checkbox (auto delete)
  │   └─ HelpText
  │
  ├─ Section "BackupHistory"
  │   ├─ BackupHistoryItem[] (Map)
  │   │   ├─ Status (icon + text)
  │   │   ├─ Metadata (size, files, duration)
  │   │   ├─ ProgressBar (if in_progress)
  │   │   └─ Actions (download, delete)
  │   └─ Empty state (if no backups)
  │
  ├─ ManualBackupButton (Primary, centered)
  │
  └─ Footer Actions
      ├─ SaveButton (Primary)
      └─ ResetButton (Secondary)
```

#### States & Interactions
```
Toggle States:
  OFF → OFF (Gray bg, gray knob)
  OFF → ON (Animate to Blue, knob moves right)
  ON → ON (Blue bg, white knob)
  ON → OFF (Animate to Gray)
  
  Animation: cubic-bezier(0.4, 0, 0.2, 1) @ 200ms

Dropdown (TimezoneSelect):
  Default: "한국 표준시" (Gray-700)
  Hover: Background #F3F4F6
  Focus: Blue border #2563EB, box-shadow
  Open: Dropdown slides down, arrow rotates
  
  Options:
    ├─ 한국 표준시 (GMT+9)
    ├─ 인도 표준시 (GMT+5:30)
    ├─ UTC (GMT+0)
    └─ ...

Input (Time):
  Default: "02:00" (Gray-700 text)
  Focus: Blue border, cursor
  Invalid: Red border + error text
  Filled: Blue outline on blur if changed
  
  Format: HH:MM (24-hour)
  Validation: 00:00 ~ 23:59

Progress Bar (in_progress backup):
  Container: Gray-200 background
  Fill: Linear gradient (Green #10B981)
  Animation: Smooth fill from left
  Label: "35% • 3분 경과"
  
Backup Item States:
  ✅ Completed:
    - Green checkmark
    - Gray metadata
    - Clickable actions
  
  ⏳ In Progress:
    - Cyan spinner (animated)
    - Progress bar
    - Gray metadata + ETA
    - Disable delete button
  
  ❌ Failed:
    - Red X
    - Red text "Failed"
    - Show error message
    - Enable retry button
```

#### Microinteractions
```
1. Toggle Switch
   - Click: Slide animation (200ms)
   - Sound: Soft click (optional)
   - Visual: Color change + knob move
   
2. Time Input
   - Focus: Soft shadow + blue border
   - Type: Validate on blur
   - Clear: "X" button appears on focus
   
3. Retention Button Group
   - Hover: Subtle background color
   - Click: Filled state (Blue background)
   - Animation: None (instant)
   
4. Backup History Item
   - Hover: Subtle shadow, light gray background
   - Expand: Show more details (smooth)
   - Delete: Confirm dialog appears
   
5. Save Button
   - Hover: Darker blue #1E40AF
   - Click: Brief loading state (spinner)
   - Success: Toast notification "설정 저장됨"
   - Error: Toast "저장 실패" (red)
```

---

### 2.2 StorageManagement — 저장소 관리

#### Layout Structure
```
┌──────────────────────────────────────────────────────────────┐
│  📌 Breadcrumb: 백업 관리 > 저장소 관리                       │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  💾 저장소 관리                                  [Help] [⚙]    │
│  ──────────────────────────────────────────────────────────  │
│                                                               │
│  ├─ 📊 저장소 사용량 개요                                     │
│  │  ────────────────────────────────────────────────────    │
│  │                                                           │
│  │  ┌──────────────────────────────────────────────────┐   │
│  │  │                                                   │   │
│  │  │ 사용 중: 8.4 GB / 10 GB                          │   │
│  │  │ [████████░░░░░░░░░░░░░░░░░] 84%                 │   │
│  │  │                                                   │   │
│  │  │ ⚠️ 경고 임계값(80%) 초과!                         │   │
│  │  │ 다음 백업은 만료된 항목을 삭제합니다.             │   │
│  │  │                                                   │   │
│  │  └──────────────────────────────────────────────────┘   │
│  │                                                           │
│  ├─ 📈 저장소 상세 분석                                      │
│  │  ────────────────────────────────────────────────────    │
│  │                                                           │
│  │  활성 백업    [████████░░░] 7.2 GB  (71 items)          │
│  │  만료 예정    [██░░░░░░░░░░] 0.8 GB  (12 items)         │
│  │             └─ 5일 후 자동 삭제                          │
│  │  스킵됨       [░░░░░░░░░░░░] 0.4 GB  (2 items)          │
│  │             └─ 중복으로 감지됨                          │
│  │                                                           │
│  ├─ ⚙️ 저장소 정책                                          │
│  │  ────────────────────────────────────────────────────    │
│  │                                                           │
│  │  할당량 계획:                                             │
│  │  ┌─────────────────────────────────────────────────┐    │
│  │  │ [Basic    (2GB)]                                │    │
│  │  │ [Standard (10GB) ✓]  현재 계획                  │    │
│  │  │ [Premium  (50GB)]    [업그레이드]                │    │
│  │  │ [Unlimited]           [문의]                     │    │
│  │  └─────────────────────────────────────────────────┘    │
│  │                                                           │
│  │  기본 설정:                                               │
│  │  ┌─────────────────────────────────────────────────┐    │
│  │  │ 보관기간: [90일 ▼]                              │    │
│  │  │ 경고 임계값: [80% ▼]                            │    │
│  │  │ [ ☑ 자동 삭제 활성화 ]                         │    │
│  │  └─────────────────────────────────────────────────┘    │
│  │                                                           │
│  ├─ 🗑️ 저장소 정리                                          │
│  │  ────────────────────────────────────────────────────    │
│  │                                                           │
│  │  ┌─ [수동으로 선택해서 삭제] ──────────────────────┐    │
│  │  │                                                  │    │
│  │  │ ☐ 2026-05-13 02:00   1.24 GB ├─ 삭제          │    │
│  │  │ ☐ 2026-05-12 02:00   1.19 GB ├─ 삭제          │    │
│  │  │ ☐ 2026-05-11 02:00   1.33 GB ├─ 삭제          │    │
│  │  │ ☐ 2026-05-10 02:00   1.41 GB ├─ 삭제 (만료)   │    │
│  │  │                                                  │    │
│  │  │ [전체 선택] [선택 해제] [선택한 항목 삭제]      │    │
│  │  │                                                  │    │
│  │  └─────────────────────────────────────────────────┘    │
│  │                                                           │
│  └─ [저장 변경사항]  [초기화]  (우측)                       │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

#### Component Composition
```jsx
<StorageManagement>
  ├─ Header (title, breadcrumb)
  │
  ├─ Section "UsageOverview"
  │   ├─ StorageUsageBar (8.4 / 10 GB)
  │   │   ├─ Filled: Green #10B981
  │   │   ├─ Background: Gray-200
  │   │   └─ Label: "84%"
  │   ├─ StatusText ("Warning threshold exceeded")
  │   └─ HelpIcon (tooltip)
  │
  ├─ Section "DetailedBreakdown"
  │   ├─ BreakdownItem[] (active, expiring, skipped)
  │   │   ├─ Label + Percentage
  │   │   ├─ ProgressBar (colored by status)
  │   │   ├─ Metadata (count, details)
  │   │   └─ Icon (info, warning)
  │
  ├─ Section "StoragePolicy"
  │   ├─ PlanSelector (ButtonGroup)
  │   │   ├─ BasicPlan (2GB)
  │   │   ├─ StandardPlan (10GB) [Selected]
  │   │   ├─ PremiumPlan (50GB)
  │   │   └─ UnlimitedPlan
  │   ├─ RetentionPolicyForm
  │   │   ├─ Select (retention days)
  │   │   ├─ Select (warning threshold)
  │   │   └─ Checkbox (auto delete)
  │
  ├─ Section "ManualCleanup"
  │   ├─ BackupChecklistTable
  │   │   ├─ Checkbox[] (selectAll, individual)
  │   │   ├─ BackupRow[] (date, size, status)
  │   │   └─ Actions (delete, info)
  │   ├─ BulkActions
  │   │   ├─ SelectAllCheckbox
  │   │   ├─ ClearSelectionButton
  │   │   └─ DeleteSelectedButton (Danger)
  │
  └─ Footer Actions (Save, Reset)
```

#### States & Interactions
```
StorageBar States:
  Normal (< 70%):
    - Fill color: Green #10B981
    - No warning text
    
  Warning (70% ~ 90%):
    - Fill color: Amber #F59E0B
    - Warning text appears (yellow bg)
    - Subtle pulse animation
    
  Critical (> 90%):
    - Fill color: Red #EF4444
    - Error text appears (red bg)
    - Frequent pulse animation
    
  Animation: Smooth fill (300ms)

Plan Selector States:
  Default:
    - Light border Gray-300
    - Text Gray-700
    - Hover: Light gray background
  
  Selected:
    - Blue border #2563EB
    - Blue background (light)
    - Text Blue #2563EB
    - Checkmark icon
  
  Disabled (Premium, Unlimited):
    - Gray text
    - No interaction
    - Upgrade link visible

Checkbox States:
  Unchecked:
    - Empty white box
    - Border Gray-300
  
  Hover:
    - Light blue background
    - Border stays gray
  
  Checked:
    - Blue background #2563EB
    - White checkmark
    - Smooth animation (150ms)
  
  Indeterminate (some selected):
    - Blue background
    - Horizontal line (-)

Backup Row States:
  Default:
    - White background
    - Hover: Gray-50 background + subtle shadow
  
  Selected:
    - Blue background (light, 0.1 opacity)
    - Checkbox checked
  
  Expired (만료 예정):
    - Left border Red #EF4444 (3px)
    - Amber tag "만료 예정"
  
  Deletable:
    - Hover: Show delete button
    - Delete: Smooth fade animation
```

#### Microinteractions
```
1. StorageBar
   - Load: Bar fills from 0% to actual% (1s ease-out)
   - Update: Smooth transition to new value (300ms)
   - Pulse: If critical, subtle pulse every 2s
   
2. Plan Card
   - Click: Smooth border color change (200ms)
   - Select: Checkmark appears with spring animation
   - Upgrade: Button pulse animation
   
3. Checkbox
   - Click: Slight scale (0.95 → 1.0) + color fill
   - Indeterminate: Quick animation to checked/unchecked
   
4. Backup Row
   - Hover: Shadow and background change
   - Delete: Icon appears on hover
   - Clicked: Brief highlight + selection
   
5. Delete Button
   - Hover: Background becomes darker red
   - Click: Loading spinner + success toast
   - Error: Red border + error message
```

---

### 2.3 BackupMetrics — 백업 통계 대시보드

#### Layout Structure
```
┌──────────────────────────────────────────────────────────────┐
│  📌 Breadcrumb: 백업 관리 > 통계                             │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  📈 백업 통계                                   [Export] [⚙]  │
│  ──────────────────────────────────────────────────────────  │
│                                                               │
│  ├─ 📊 기간 선택                                             │
│  │  [Last 7 days] [Last 30 days ✓] [Last 90 days]           │
│  │   Custom: [From] [To] [적용]                              │
│  │                                                           │
│  ├─ 📌 KPI 카드 (4 Cards, Grid 2x2 or 1x4 responsive)      │
│  │  ────────────────────────────────────────────────────    │
│  │                                                           │
│  │  ┌───────────────────┐  ┌───────────────────┐           │
│  │  │ ✅ 성공률          │  │ 📦 전체 백업      │           │
│  │  │ 98%               │  │ 28개             │           │
│  │  │ +2% 지난주 대비    │  │ -1개 지난주 대비  │           │
│  │  └───────────────────┘  └───────────────────┘           │
│  │                                                           │
│  │  ┌───────────────────┐  ┌───────────────────┐           │
│  │  │ ❌ 실패            │  │ 💾 저장 용량      │           │
│  │  │ 0개               │  │ 8.4 GB           │           │
│  │  │ -1개 지난주 대비   │  │ +0.3GB 지난주 대비│           │
│  │  └───────────────────┘  └───────────────────┘           │
│  │                                                           │
│  ├─ 📈 성공률 추이 (Line Chart, 30일)                       │
│  │  ────────────────────────────────────────────────────    │
│  │                                                           │
│  │  100% ┤        ╱╲      ╱╲                                │
│  │   95% ┤       ╱  ╲    ╱  ╲    ╱╲                         │
│  │   90% ┤      ╱    ╲  ╱    ╲  ╱  ╲                       │
│  │        ├─────────────────────────────────────────────   │
│  │        └──┴────┴────┴────┴────┴────┴──── (Days)        │
│  │          5   10   15   20   25   30                     │
│  │                                                           │
│  │  Tooltips on hover: "2026-05-10: 100% (28/28 successful)"
│  │                                                           │
│  ├─ 📊 일일 통계 (Bar Chart, 7일)                           │
│  │  ────────────────────────────────────────────────────    │
│  │                                                           │
│  │  5│                                                     │
│  │  4│   ┌──┐                                             │
│  │  3│   │  │  ┌──┐      ┌──┐                            │
│  │  2│   │  │  │  │  ┌──┐│  │  ┌──┐                     │
│  │  1│ ┌─┴──┴──┴──┴──┴──┴──┴──┴──┴──┐                    │
│  │    ├────────────────────────────────                   │
│  │    └─ Mon Tue Wed Thu Fri Sat Sun                     │
│  │                                                           │
│  │  Legend:                                                 │
│  │  ■ Successful  ■ Failed  ■ Skipped                     │
│  │                                                           │
│  ├─ 📋 백업 목록 (Sortable Table)                           │
│  │  ────────────────────────────────────────────────────    │
│  │                                                           │
│  │  날짜         │ 상태  │ 크기   │ 파일  │ 소요   │ 평균  │
│  │  ────────────┼───────┼────────┼───────┼────────┼──────│
│  │ 2026-05-13  │ ✅   │ 1.24GB │ 47   │ 4m23s │ 28MB │
│  │ 2026-05-12  │ ✅   │ 1.19GB │ 45   │ 3m58s │ 26MB │
│  │ 2026-05-11  │ ✅   │ 1.33GB │ 51   │ 5m12s │ 26MB │
│  │ 2026-05-10  │ ❌   │  —     │  —   │  —   │  —  │
│  │ 2026-05-09  │ ✅   │ 1.41GB │ 52   │ 5m34s │ 27MB │
│  │                                                           │
│  │  [이전] [다음]  (Pagination)                             │
│  │                                                           │
│  └─ [CSV 다운로드] [PDF 리포트] [프린트]                     │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

#### Component Composition
```jsx
<BackupMetrics>
  ├─ Header (title, breadcrumb)
  │
  ├─ Section "PeriodSelector"
  │   ├─ QuickSelectButtons (7, 30, 90 days)
  │   ├─ CustomDateRange (From, To)
  │   └─ ApplyButton
  │
  ├─ Section "KPICards" (Grid: 2x2 desktop, 1x4 mobile)
  │   ├─ MetricCard "SuccessRate"
  │   │   ├─ Icon (checkmark)
  │   │   ├─ Value "98%"
  │   │   ├─ Trend "+2% vs last week"
  │   │   └─ Color: Green
  │   │
  │   ├─ MetricCard "TotalBackups"
  │   │   ├─ Icon (package)
  │   │   ├─ Value "28"
  │   │   ├─ Trend "-1 vs last week"
  │   │   └─ Color: Blue
  │   │
  │   ├─ MetricCard "FailedBackups"
  │   │   ├─ Icon (error)
  │   │   ├─ Value "0"
  │   │   ├─ Trend "No failures"
  │   │   └─ Color: Red
  │   │
  │   └─ MetricCard "TotalStorage"
  │       ├─ Icon (database)
  │       ├─ Value "8.4 GB"
  │       ├─ Trend "+0.3GB vs last week"
  │       └─ Color: Cyan
  │
  ├─ Section "SuccessRateTrend" (Line Chart)
  │   ├─ ChartContainer
  │   │   ├─ XAxis (Days)
  │   │   ├─ YAxis (Percentage 0-100%)
  │   │   ├─ LineChart (animated on load)
  │   │   ├─ Tooltip (on hover)
  │   │   └─ Legend
  │   └─ ChartDescription
  │
  ├─ Section "DailyStatistics" (Bar Chart)
  │   ├─ ChartContainer
  │   │   ├─ BarChart (stacked: successful, failed, skipped)
  │   │   ├─ XAxis (Days of week)
  │   │   ├─ YAxis (Count)
  │   │   ├─ Legend
  │   │   └─ Tooltip (on hover)
  │   └─ ChartDescription
  │
  ├─ Section "DetailedTable"
  │   ├─ SortableTable
  │   │   ├─ Column headers (sortable)
  │   │   ├─ Rows (backup details)
  │   │   ├─ Status icon (✅, ❌)
  │   │   ├─ Expandable rows (show full details)
  │   │   └─ Pagination (10 items per page)
  │   └─ RowActions (download, delete)
  │
  └─ Footer Actions (Export, Print)
```

#### States & Interactions
```
MetricCard States:
  Default:
    - White background
    - Gray-300 border
    - Icon: Colored (matching status)
    - Value: Gray-900, large font
    - Trend: Green (positive), Gray (neutral)
  
  Hover:
    - Light shadow
    - Subtle background change
    - Cursor pointer
  
  Loading:
    - Skeleton loader
    - Gray shimmer animation
  
Line Chart States:
  Load Animation:
    - Chart area appears (fade-in 400ms)
    - Line animates from left to right (500ms)
    - Dots appear with pop animation
  
  Hover:
    - Tooltip appears (smooth)
    - Point highlight (larger dot)
    - Vertical reference line
  
Bar Chart States:
  Load Animation:
    - Bars grow from bottom (stagger: 50ms per bar)
    - Fill colors smoothly
  
  Hover:
    - Bar highlight (darker color)
    - Tooltip with exact values
    - Reference line at hovered bar

Table Row States:
  Default:
    - White background
    - Gray-300 bottom border
  
  Hover:
    - Gray-50 background
    - Subtle shadow
    - Show action buttons
  
  Expandable:
    - Click to expand (smooth height animation)
    - Show child details
    - Chevron rotates 90°
  
  Sortable:
    - Click header: Arrow indicates direction
    - Sorted column: Blue text #2563EB
    - Animation: Rows fade and reposition (200ms)
```

#### Microinteractions
```
1. Period Selector
   - Click: Smooth button highlight + chart update (300ms)
   - Custom: Date picker slides in/out
   
2. KPI Cards
   - Load: Stagger animation (delay 50ms per card)
   - Hover: Card lifts with shadow increase
   - Trend: Color animation (Green → Amber → Red)
   
3. Chart
   - Init: Line/bars animate in sequence
   - Hover: Point enlarges, tooltip fades in
   - Legend click: Toggle series visibility (smooth opacity)
   
4. Table
   - Row hover: Background fade-in
   - Sort: Smooth row repositioning
   - Expand: Chevron rotates, child rows slide in
   - Delete: Fade out + remove (200ms)
   
5. Export Button
   - Click: Loading spinner (circular rotation)
   - Success: Toast + file download
   - Error: Red toast message
```

---

### 2.4 NotificationSettings — 알림 설정

#### Layout Structure
```
┌──────────────────────────────────────────────────────────────┐
│  📌 Breadcrumb: 백업 관리 > 알림 설정                        │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  🔔 알림 설정                                     [Help] [⚙]   │
│  ──────────────────────────────────────────────────────────  │
│                                                               │
│  ├─ ✉️ 이메일 알림                                           │
│  │  ────────────────────────────────────────────────────    │
│  │                                                           │
│  │  계정: asdf1390a@gmail.com  [변경]                       │
│  │                                                           │
│  │  알림 유형:                                               │
│  │  ┌─────────────────────────────────────────────────┐    │
│  │  │ ☑ 백업 완료           ← 매일 자동 백업 성공    │    │
│  │  │ ☑ 백업 실패           ← 자동 백업 실패 시      │    │
│  │  │ ☑ 저장소 경고         ← 80% 도달 시           │    │
│  │  │ ☑ 저장소 초과         ← 할당량 초과 시        │    │
│  │  │ ☐ 정기 보고서         ← 주 1회 (금요일 09:00) │    │
│  │  │                                                  │    │
│  │  │ 빈도: [매일] [주 1회] [월 1회]                 │    │
│  │  └─────────────────────────────────────────────────┘    │
│  │                                                           │
│  │  [테스트 이메일 전송]  [저장]                             │
│  │                                                           │
│  ├─ 📱 Telegram 알림                                        │
│  │  ────────────────────────────────────────────────────    │
│  │                                                           │
│  │  상태: [ ☑ 활성화 ]                                     │
│  │                                                           │
│  │  연결된 계정:                                             │
│  │  ┌─────────────────────────────────────────────────┐    │
│  │  │ @telegram_username (Kyeongtae Na)              │    │
│  │  │ 마지막 메시지: 2026-05-13 14:22                 │    │
│  │  │ [계정 변경] [연결 해제]                          │    │
│  │  └─────────────────────────────────────────────────┘    │
│  │                                                           │
│  │  알림 유형:                                               │
│  │  ┌─────────────────────────────────────────────────┐    │
│  │  │ ☑ 백업 완료                                      │    │
│  │  │ ☑ 백업 실패                                      │    │
│  │  │ ☑ 저장소 경고                                    │    │
│  │  │ ☑ 저장소 초과                                    │    │
│  │  │ ☐ 정기 보고서                                    │    │
│  │  └─────────────────────────────────────────────────┘    │
│  │                                                           │
│  │  [테스트 메시지 전송]  [저장]                             │
│  │                                                           │
│  ├─ 🔔 인앱 알림                                            │
│  │  ────────────────────────────────────────────────────    │
│  │                                                           │
│  │  [ ☑ 인앱 알림 활성화 ]                                 │
│  │                                                           │
│  │  알림 유형:                                               │
│  │  ┌─────────────────────────────────────────────────┐    │
│  │  │ ☑ 백업 완료                                      │    │
│  │  │ ☑ 백업 실패                                      │    │
│  │  │ ☑ 저장소 경고                                    │    │
│  │  │ ☑ 저장소 초과                                    │    │
│  │  │ ☑ 정기 보고서                                    │    │
│  │  └─────────────────────────────────────────────────┘    │
│  │                                                           │
│  │  표시 위치: [브라우저 우측 하단] [상단 배너]              │
│  │  자동 닫기: [3초 후 자동 닫기] [수동 닫기]               │
│  │                                                           │
│  │  [저장]                                                  │
│  │                                                           │
│  ├─ 📝 알림 히스토리                                        │
│  │  ────────────────────────────────────────────────────    │
│  │                                                           │
│  │  필터: [모두] [완료] [실패] [경고] [초과]                │
│  │                                                           │
│  │  ┌─────────────────────────────────────────────────┐    │
│  │  │                                                  │    │
│  │  │ ✅ 2026-05-13 02:15   Backup Completed          │    │
│  │  │    asdf1390a@gmail.com 으로 발송됨              │    │
│  │  │    [읽음]                                        │    │
│  │  │                                                  │    │
│  │  │ ✅ 2026-05-12 02:10   Backup Completed          │    │
│  │  │    asdf1390a@gmail.com, Telegram 으로 발송됨    │    │
│  │  │    [읽음]                                        │    │
│  │  │                                                  │    │
│  │  │ ⚠️ 2026-05-11 18:00   Storage Warning           │    │
│  │  │    asdf1390a@gmail.com 으로 발송됨              │    │
│  │  │    사용량: 7.8GB / 10GB (78%)                   │    │
│  │  │    [읽음]                                        │    │
│  │  │                                                  │    │
│  │  │ ❌ 2026-05-10 02:05   Backup Failed            │    │
│  │  │    asdf1390a@gmail.com, @telegram_username    │    │
│  │  │    [아직 안 읽음]                                │    │
│  │  │                                                  │    │
│  │  └─────────────────────────────────────────────────┘    │
│  │                                                           │
│  │  [이전] [다음]  (페이지네이션)                            │
│  │                                                           │
│  └─ [전체 저장] [초기화]  (우측 스티키)                     │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

#### Component Composition
```jsx
<NotificationSettings>
  ├─ Header (title, breadcrumb)
  │
  ├─ Section "EmailNotifications"
  │   ├─ EmailDisplay (asdf1390a@gmail.com)
  │   ├─ ChangeEmailButton
  │   ├─ CheckboxGroup (notification types)
  │   │   ├─ Label "Backup completed"
  │   │   ├─ Checkbox
  │   │   ├─ Description "When daily backup succeeds"
  │   │   └─ Icon (info)
  │   ├─ FrequencySelector (daily, weekly, monthly)
  │   ├─ TestEmailButton
  │   └─ SaveButton
  │
  ├─ Section "TelegramNotifications"
  │   ├─ Toggle (enable/disable)
  │   ├─ TelegramAccountDisplay
  │   │   ├─ Username "@telegram_username"
  │   │   ├─ Last message time
  │   │   └─ Actions (change, disconnect)
  │   ├─ CheckboxGroup (notification types)
  │   ├─ TestMessageButton
  │   └─ SaveButton
  │
  ├─ Section "InAppNotifications"
  │   ├─ Toggle (enable/disable)
  │   ├─ CheckboxGroup (notification types)
  │   ├─ SelectGroup (position: bottom-right, top, banner)
  │   ├─ AutoCloseSelector
  │   └─ SaveButton
  │
  ├─ Section "NotificationHistory"
  │   ├─ FilterTabs (all, completed, failed, warning)
  │   ├─ NotificationList
  │   │   ├─ NotificationItem[] (map)
  │   │   │   ├─ Status icon (✅, ❌, ⚠️)
  │   │   │   ├─ Timestamp
  │   │   │   ├─ Title + Message
  │   │   │   ├─ Channels (email, telegram, in-app)
  │   │   │   ├─ Details (expandable)
  │   │   │   └─ MarkAsReadButton
  │   │   └─ EmptyState (if no items)
  │   └─ Pagination
  │
  └─ Footer (SaveAll, Reset)
```

#### States & Interactions
```
Checkbox States (same as StorageManagement)

Toggle States (same as AutoBackupSettings)

Email Account Display:
  Connected:
    - Green checkmark
    - Email displayed
    - "Change" and "Verify" buttons
    - Last verification date shown
  
  Unverified:
    - Amber warning icon
    - "Verify email" button
    - Message: "Please verify your email"
  
  Disconnected:
    - Gray text
    - "Connect" button
    - Message: "Not connected"

Telegram Account Display:
  Connected:
    - Green checkmark
    - Username displayed
    - Last message time
    - "Disconnect" link
  
  Disconnected:
    - Gray text
    - "Connect with Telegram" button
    - QR code option
  
  Error:
    - Red border
    - Error message
    - "Reconnect" button

Notification Item States:
  Unread:
    - Blue left border #2563EB
    - Slightly bold text
    - Hover: Light blue background
  
  Read:
    - Gray left border Gray-300
    - Normal text weight
    - Hover: Gray-50 background
  
  Expandable:
    - Chevron icon (rotates on click)
    - Child details slide down
    - Full message visible
  
  Error State:
    - Red icon ❌
    - Red text
    - "Retry" button visible
```

#### Microinteractions
```
1. Checkbox Toggle
   - Click: Smooth fill animation (150ms)
   - Related: Disable related inputs if parent unchecked
   
2. Email Account
   - Change: Modal appears with fade-in
   - Verify: Toast appears "Verification email sent"
   - Success: Blue checkmark animation
   
3. Telegram Connect
   - Click: QR code modal slides in
   - Success: Toast + account info appears
   - Disconnect: Confirm dialog
   
4. Test Button
   - Click: Loading spinner (2s)
   - Success: Toast "Test notification sent"
   - Error: Red toast "Failed to send"
   
5. Notification Item
   - Hover: Smooth background transition
   - Expand: Child details slide down (smooth height)
   - Mark as read: Smooth color transition (blue → gray)
   - Delete: Fade out + slide left (200ms)
   
6. Filter Tabs
   - Click: Underline slides to new tab (200ms)
   - Load: Notification list fades in
```

---

## 3. 컴포넌트별 상세 설계 (10 Components)

### 3.1 StorageUsageBar (저장소 사용량 게이지)

```jsx
// components/BackupApp/StorageUsageBar.js

interface Props {
  used: number;           // bytes
  max: number;            // bytes
  showPercent?: boolean;  // default: true
  showLabel?: boolean;    // default: true
  size?: 'sm' | 'md' | 'lg'; // height
  animated?: boolean;     // load animation
  onClick?: () => void;   // clickable
}

Design Specs:
  - Height: sm=6px, md=8px, lg=12px
  - Radius: 999px (pill shape)
  - Container: Gray-200 background
  - Fill: Colored based on percentage
    * 0-70%: Green #10B981
    * 70-90%: Amber #F59E0B (pulse animation)
    * 90-100%: Red #EF4444 (pulse animation)
  - Animation: Smooth fill (cubic-bezier(0.4, 0, 0.2, 1) @ 400ms)
  - Shadow: None (default), Soft on hover
  - Text: Right-aligned, Gray-700 (13px)
    * Format: "8.4 / 10 GB (84%)"
  
State Examples:
  <StorageUsageBar used={8.4e9} max={10e9} animated={true} />
  → Shows: [████████░░░] 8.4 / 10 GB (84%)
  
  <StorageUsageBar used={9.5e9} max={10e9} size="lg" />
  → Shows: Thick red bar with pulse animation
```

### 3.2 RetentionPolicyForm (보관 정책 폼)

```jsx
// components/BackupApp/RetentionPolicyForm.js

interface Props {
  value: {
    retentionDays: number;
    maxStorageGB: number;
    warningThreshold: number;
    autoDeleteEnabled: boolean;
  };
  onChange: (value) => void;
  onSave?: () => void;
}

Design Specs:
  - Grid layout: 2 columns (desktop), 1 column (mobile)
  - Section padding: 16px
  - Input styling:
    * Border: 1px Gray-300
    * Border-radius: 6px
    * Padding: 8px 12px
    * Font: 13px Regular
    * Focus: Blue border #2563EB + subtle shadow
  
  - Retention Selector:
    * ButtonGroup: [30일] [90일 ✓] [180일] [수동]
    * Button width: auto, min-width: 70px
    * Hover: Gray-100 background
    * Active: Blue #2563EB with white text
    * Spacing: 8px between buttons
  
  - Max Storage Input:
    * Type: number with suffix "GB"
    * Min: 1, Max: 5000
    * Step: 1
    * Validation: Show error if < current usage
  
  - Warning Threshold Selector:
    * Dropdown: [50%] [70%] [80% ✓] [90%]
    * Help text: "경고는 XX%에 도달할 때 나타납니다"
  
  - Auto Delete Checkbox:
    * Label: "자동 삭제 활성화"
    * Description: "만료된 백업 자동 정리"
    * Sub-options disabled if unchecked
    
State Examples:
  <RetentionPolicyForm 
    value={{ retentionDays: 90, maxStorageGB: 10, ... }}
    onChange={handleChange}
  />
```

### 3.3 BackupMetricsCards (KPI 카드)

```jsx
// components/BackupApp/BackupMetricsCards.js

interface MetricCardProps {
  title: string;          // "성공률", "전체 백업"
  value: string | number; // "98%", "28"
  trend?: {
    value: number;        // +2, -1
    direction: 'up' | 'down' | 'neutral';
  };
  icon?: 'checkmark' | 'package' | 'error' | 'database';
  color?: 'green' | 'blue' | 'red' | 'cyan';
  loading?: boolean;
  onClick?: () => void;
}

Design Specs:
  - Size: responsive (2x2 desktop, 1x4 mobile)
  - Card layout:
    * Background: White
    * Border: 1px Gray-300
    * Radius: 8px
    * Padding: 20px
    * Shadow: Soft (hover: Medium)
  
  - Icon:
    * Size: 32px
    * Color: Varies by metric
    * Positioned: Top-right
    * Opacity: 0.1 background circle
  
  - Value:
    * Font: 32px / 700 Bold
    * Color: Gray-900
    * Margin-top: 8px
  
  - Trend:
    * Font: 13px / 400 Regular
    * Color: Green #10B981 (up) / Red #EF4444 (down)
    * Icon: ↑ ↓
    * Format: "+2% vs last week"
  
  - Hover: Subtle shadow increase, cursor pointer
  
  - Loading: Skeleton shimmer animation
  
State Examples:
  <MetricCard 
    title="성공률"
    value="98%"
    trend={{ value: 2, direction: 'up' }}
    color="green"
  />
  
  <MetricCard 
    title="실패"
    value="0"
    loading={true}
  />
```

### 3.4 SuccessRateChart (성공률 추이 그래프)

```jsx
// components/BackupApp/SuccessRateChart.js

interface Props {
  data: Array<{
    date: string;          // "2026-05-10"
    successRate: number;   // 0-100
    successCount: number;  // 28
    totalCount: number;    // 28
  }>;
  period?: 'week' | 'month' | 'quarter';
  animated?: boolean;
}

Design Specs:
  - Chart library: Recharts (or Chart.js)
  - Size: Full-width container, height: 300px
  - Color scheme:
    * Line: Blue #2563EB
    * Fill: Blue #2563EB (0.1 opacity)
    * Grid: Gray-200 (light)
    * Text: Gray-700
  
  - Axes:
    * XAxis: Date (format: "5", "10", "15", "20", ...)
    * YAxis: Percentage (0-100%, step: 10%)
    * Grid: Show minor grid only
  
  - Line:
    * Stroke width: 2px
    * Dot size: 4px (default), 6px (hover)
    * Animation: Line draws from left (500ms ease-out)
  
  - Tooltip:
    * Background: Dark gray + white text
    * Border: Blue #2563EB
    * Format: "2026-05-10: 100% (28/28 successful)"
    * Fade-in: 150ms
  
  - Legend: Bottom center, horizontal layout
  - Responsive: Full width, mobile: height 250px
  
State Examples:
  <SuccessRateChart 
    data={metricData}
    period="month"
    animated={true}
  />
```

### 3.5 NotificationHistory (알림 히스토리)

```jsx
// components/BackupApp/NotificationHistory.js

interface Props {
  notifications: Array<{
    id: string;
    type: 'success' | 'failure' | 'warning' | 'exceeded';
    title: string;
    message: string;
    channels: ('email' | 'telegram' | 'in-app')[];
    timestamp: string;
    readAt?: string;
  }>;
  onMarkAsRead?: (id: string) => void;
  onDelete?: (id: string) => void;
  onFilter?: (type: string) => void;
}

Design Specs:
  - List container:
    * Background: White
    * Border: 1px Gray-300
    * Radius: 8px
  
  - Item layout:
    * Padding: 16px
    * Border-bottom: 1px Gray-100
    * Last-child: No border
    * Hover: Gray-50 background
  
  - Left border indicator:
    * Width: 3px
    * Height: 100%
    * Color: Green (success) / Red (failure) / Amber (warning)
  
  - Status icon:
    * ✅ Success
    * ❌ Failed
    * ⚠️ Warning
    * Font size: 18px
  
  - Timestamp:
    * Format: "2026-05-13 02:15"
    * Color: Gray-500
    * Font: 12px / 400
  
  - Channels:
    * Display as small badges
    * Icons: ✉️ (email), 💬 (telegram), 🔔 (in-app)
    * Space: 4px between badges
  
  - Read state:
    * Unread: Blue border + bold text
    * Read: Gray border + normal text
    * Transition: 200ms smooth
  
  - Actions (on hover):
    * Mark as read: Button appears
    * Delete: Icon button (trash)
    * Expandable: Chevron (click to expand details)
    
State Examples:
  <NotificationHistory 
    notifications={items}
    onMarkAsRead={handleRead}
  />
```

### 3.6 QuotaWarning (할당량 경고)

```jsx
// components/BackupApp/QuotaWarning.js

interface Props {
  status: 'warning' | 'exceeded' | 'critical';
  usageGB: number;
  maxGB: number;
  daysUntilAutoDelete?: number;  // null if already exceeded
  onUpgrade?: () => void;
  onCleanup?: () => void;
}

Design Specs:
  - Container:
    * Full-width alert box
    * Padding: 16px
    * Radius: 8px
    * Margin-bottom: 16px
  
  - Warning state (70-90%):
    * Background: Amber #FEF3C7
    * Border: 1px Amber #F59E0B
    * Icon color: Amber #F59E0B
    * Pulse animation: subtle
  
  - Exceeded state (> 100%):
    * Background: Red #FEE2E2
    * Border: 1px Red #EF4444
    * Icon color: Red #EF4444
    * Pulse animation: frequent
  
  - Layout:
    * Icon (left): 24px
    * Content (center): flex-grow
    * Actions (right): buttons
    * Spacing: 12px
  
  - Icon:
    * ⚠️ Warning
    * 🚨 Exceeded
    * Animated pulse (1.5s)
  
  - Message:
    * Title: "저장소 부족합니다"
    * Description: "XX.X / XX GB 사용 중 (XX%)"
    * Color: Matches alert type
    * Font: 14px / 600
  
  - Actions:
    * Primary: [업그레이드] (Blue)
    * Secondary: [오래된 백업 삭제] (Gray)
    * Position: Right-aligned
    * Spacing: 8px between buttons
  
  - Dismiss: X button (top-right)
    * Hidden by default, visible on hover
    * Click: Alert fades out
    
State Examples:
  <QuotaWarning 
    status="warning"
    usageGB={8.4}
    maxGB={10}
    daysUntilAutoDelete={5}
  />
  → Shows: "⚠️ 저장소 부족 • 8.4 / 10 GB (84%)"
  
  <QuotaWarning 
    status="exceeded"
    usageGB={10.5}
    maxGB={10}
    daysUntilAutoDelete={null}
  />
  → Shows: "🚨 저장소 초과 • 10.5 / 10 GB (105%)"
```

### 3.7 MetricCard (재사용 가능한 지표 카드)

```jsx
// components/Common/MetricCard.js

interface Props {
  label: string;        // "성공률"
  value: string;        // "98%"
  subtext?: string;     // "+2% 지난주 대비"
  icon?: React.ReactNode;
  color?: 'green' | 'blue' | 'red' | 'cyan' | 'gray';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  clickable?: boolean;
  onClick?: () => void;
}

Design Specs:
  - Size variants:
    * sm: 160px width, 140px height, 16px padding
    * md: 200px width, 160px height, 20px padding
    * lg: 240px width, 200px height, 24px padding
  
  - Colors:
    * green: #10B981 (icon background)
    * blue: #2563EB
    * red: #EF4444
    * cyan: #06B6D4
    * gray: #6B7280
  
  - Layout:
    * Header: Icon (left) + Label (right)
    * Body: Large value
    * Footer: Subtext (optional)
  
  - Typography:
    * Label: 13px / 500 Gray-600
    * Value: 28px / 700 Gray-900
    * Subtext: 12px / 400 Green #10B981 (or red)
  
  - Icon:
    * Size: 24px (or varies by size)
    * Background: Color with 0.1 opacity
    * Radius: 6px
    * Padding: 6px
  
  - States:
    * Default: White bg, Gray-300 border
    * Hover: Subtle shadow, cursor pointer (if clickable)
    * Loading: Skeleton shimmer
    
State Examples:
  <MetricCard 
    label="성공률"
    value="98%"
    subtext="+2% 지난주 대비"
    color="green"
    size="md"
  />
```

### 3.8 ProgressBar (진행률 바)

```jsx
// components/Common/ProgressBar.js

interface Props {
  value: number;        // 0-100
  max?: number;         // default: 100
  color?: 'blue' | 'green' | 'amber' | 'red';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;  // default: true
  animated?: boolean;
  indeterminate?: boolean;
}

Design Specs:
  - Size variants:
    * sm: height 4px
    * md: height 8px (default)
    * lg: height 12px
  
  - Colors:
    * blue: #2563EB
    * green: #10B981
    * amber: #F59E0B
    * red: #EF4444
  
  - Container:
    * Background: Gray-200
    * Border-radius: 999px
    * Overflow: hidden
  
  - Fill:
    * Background: Color (solid or gradient)
    * Border-radius: 999px
    * Animation: Smooth (300ms cubic-bezier)
    * Shadow: None (or soft on hover)
  
  - Label:
    * Position: Right-aligned, below bar
    * Font: 12px / 500 Gray-700
    * Format: "35%"
  
  - Indeterminate state:
    * Fill: Striped animation
    * Animation: Infinite loop (1.5s)
  
State Examples:
  <ProgressBar value={35} color="green" showLabel={true} />
  → Shows: [███████░░░░░░░░░░░] 35%
  
  <ProgressBar value={85} color="amber" animated={true} />
  → Shows: Amber bar with smooth fill animation
```

### 3.9 TelegramConnection (Telegram 연동)

```jsx
// components/BackupApp/TelegramConnection.js

interface Props {
  connected: boolean;
  username?: string;      // "@telegram_username"
  lastMessageTime?: string; // "2026-05-13 14:22"
  loading?: boolean;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onShowQR?: () => void;
}

Design Specs:
  - Container:
    * Background: White or Gray-50
    * Border: 1px Gray-300
    * Radius: 8px
    * Padding: 16px
  
  - Connected state:
    * Icon: 💬 (Telegram logo)
    * Color: Cyan #06B6D4
    * Status: "연결됨"
    * Username: displayed as @username
    * Last message time: Gray-500 (12px)
    * Actions:
      - [계정 변경] (secondary button)
      - [연결 해제] (danger link)
  
  - Disconnected state:
    * Icon: 💬 (gray)
    * Status: "연결되지 않음"
    * Message: "Telegram으로 백업 알림을 받으세요"
    * Actions:
      - [Telegram 연결] (primary button)
      - [QR 코드로 연결] (secondary)
  
  - Loading state:
    * Spinner animation
    * Message: "Telegram 연결 중..."
    * Buttons disabled
  
  - Error state:
    * Icon: ❌ (red)
    * Message: Error description
    * Actions:
      - [다시 연결] (primary)
      - [도움말] (link)
  
  - Modal (QR code):
    * Size: 320x320px
    * Border: 2px Gray-300
    * Instructions below QR
    * Close button
    
State Examples:
  <TelegramConnection 
    connected={true}
    username="@kyeongtae_na"
    lastMessageTime="2026-05-13 14:22"
  />
  
  <TelegramConnection 
    connected={false}
    onConnect={handleConnect}
  />
```

### 3.10 BackupScheduleCard (백업 스케줄 카드)

```jsx
// components/BackupApp/BackupScheduleCard.js

interface Props {
  schedule: {
    enabled: boolean;
    time: string;           // "02:00"
    timezone: string;       // "Asia/Seoul"
    interval: 'daily' | 'weekly' | 'monthly';
    nextRunAt: string;      // ISO datetime
    lastRunAt?: string;     // ISO datetime
  };
  onChange?: (schedule) => void;
  onSave?: () => void;
}

Design Specs:
  - Container:
    * Background: White or Gray-50
    * Border: 1px Gray-300
    * Radius: 8px
    * Padding: 20px
    * Shadow: Soft
  
  - Header:
    * Title: "🔄 자동 백업 스케줄" (18px / 600)
    * Toggle switch (right-aligned)
    * Position: Space-between layout
  
  - Content (visible if enabled):
    * Grid: 2 columns (desktop), 1 (mobile)
    * Gap: 16px
  
  - Time Input:
    * Type: time (HH:MM)
    * Icon: 🕐
    * Format: 24-hour
    * Timezone selector below
  
  - Interval Selector:
    * Radio buttons: [Daily] [Weekly] [Monthly]
    * Horizontal layout
    * Spacing: 12px
  
  - Info Box:
    * Background: Blue #DBEAFE
    * Border: 1px Blue #2563EB
    * Icon: ℹ️
    * Text: "다음 백업: 2026-05-15 02:00 KST"
    * Font: 13px / 500
  
  - Schedule history (mini):
    * Last run info (if available)
    * Format: "마지막 실행: 2026-05-14 02:10 (완료)"
    * Color: Gray-600
  
  - Actions:
    * Save button (primary)
    * Cancel link (secondary)
    * Position: Bottom-right
  
State Examples:
  <BackupScheduleCard 
    schedule={{
      enabled: true,
      time: "02:00",
      timezone: "Asia/Seoul",
      interval: "daily",
      nextRunAt: "2026-05-15T02:00:00Z"
    }}
    onSave={handleSave}
  />
```

---

## 4. 마이크로인터랙션 가이드 (Microinteractions Master List)

### 4.1 Timing Functions

```css
/* 기본 애니메이션 속도 */
Fast:       150ms (toggle, checkbox)
Normal:     200ms (button, fade)
Slow:       300ms (modal, expand)
Slideshow:  500ms (chart draw, list load)
Lazy:       1000ms (long duration effects)

Easing:
  - ease-in-out: 0.4, 0, 0.2, 1 (standard)
  - ease-out: 0.25, 0.46, 0.45, 0.94 (enter)
  - ease-in: 0.95, 0.05, 0.795, 0.035 (exit)
  - cubic-bezier(0.165, 0.84, 0.44, 1) (bounce)
```

### 4.2 Common Patterns

#### Loading State
```
Spinner: Rotate 360° @ 2s infinite linear
Shimmer: Gradient slides (L→R) @ 1.5s infinite
Skeleton: Gray bars with shimmer
Toast: Slide up 24px, fade in (200ms), auto-close (3s)
```

#### Success/Error
```
Success:
  - Green checkmark with scale-in (150ms)
  - Optional sound effect (subtle)
  - Toast auto-closes (3s)

Error:
  - Red X with shake animation (200ms, 2-3 shakes)
  - Error message in red toast
  - Retry button visible
  - Manual close required
```

#### Hover/Focus
```
Button:
  - Hover: Background darken, shadow increase
  - Focus: Blue outline (2px) + shadow
  - Active: Background even darker

Input:
  - Focus: Blue border, subtle shadow
  - Invalid: Red border, red text
  - Disabled: Gray background, no interaction

Link:
  - Hover: Color change + underline
  - Focus: Outline ring
  - Visited: Purple (optional)
```

---

## 5. 개발 체크리스트 (Development Checklist)

### UI Components

- [ ] StorageUsageBar (with gradient, responsive)
- [ ] RetentionPolicyForm (validation, save)
- [ ] BackupMetricsCards (skeleton loading)
- [ ] SuccessRateChart (Recharts integration)
- [ ] NotificationHistory (pagination, filters)
- [ ] QuotaWarning (alert states, animations)
- [ ] MetricCard (size variants)
- [ ] ProgressBar (color variants)
- [ ] TelegramConnection (QR code modal)
- [ ] BackupScheduleCard (time input validation)

### Screens

- [ ] AutoBackupSettings (form submission, toast)
- [ ] StorageManagement (table sorting, bulk actions)
- [ ] BackupMetrics (chart responsiveness, export)
- [ ] NotificationSettings (email/telegram validation)

### Interactions

- [ ] Toggle animations (cubic-bezier)
- [ ] Input focus states (shadow, border)
- [ ] Button hover/active states
- [ ] Modal fade-in/out (200ms)
- [ ] Table row animations (hover, expand)
- [ ] Chart draw animations (500ms)
- [ ] Toast notifications (slide + fade)
- [ ] Progress bar fill animations

### Accessibility (A11y)

- [ ] Keyboard navigation (Tab, Enter, Esc)
- [ ] ARIA labels on all interactive elements
- [ ] Color contrast ratio ≥ 4.5:1
- [ ] Focus visible on all buttons/inputs
- [ ] Screen reader friendly (semantic HTML)
- [ ] Form validation accessible
- [ ] Error messages linked to inputs

### Responsive Design

- [ ] Mobile: < 640px (single column, stacked cards)
- [ ] Tablet: 640px ~ 1024px (two columns)
- [ ] Desktop: > 1024px (full layout)
- [ ] Touch targets: ≥ 44x44px (mobile)
- [ ] Font sizes: Scale appropriately
- [ ] Images: Lazy loading

### Performance

- [ ] Chart renders < 1s
- [ ] Page loads < 3s (Lighthouse score > 80)
- [ ] No layout shift (CLS < 0.1)
- [ ] Smooth 60fps animations
- [ ] Debounce input changes (300ms)
- [ ] Lazy load heavy components

---

## 6. Figma Design System Export

### Colors (Copy to Figma)

```
Primary Blue: #2563EB
Primary Dark: #1E40AF
Primary Light: #DBEAFE

Success Green: #10B981
Warning Amber: #F59E0B
Error Red: #EF4444
Info Cyan: #06B6D4

Gray-50: #F9FAFB
Gray-100: #F3F4F6
Gray-300: #D1D5DB
Gray-500: #6B7280
Gray-700: #374151
Gray-900: #111827
```

### Typography (Figma Styles)

```
H1 Display: 32px, 700 Bold, 1.2 line-height
H2 Heading: 24px, 700 Bold, 1.3 line-height
H3 Subheading: 18px, 600 Semibold, 1.4 line-height
Body Large: 14px, 400/600 Regular/Semibold
Body: 13px, 400 Regular, 1.5 line-height
Caption: 12px, 400/500 Regular/Medium
```

### Component Library

```
Buttons/
  ├─ Primary (blue, hover, active, disabled)
  ├─ Secondary (gray, hover, active)
  ├─ Danger (red, hover, active)
  ├─ Small (14px)
  ├─ Medium (16px)
  └─ Large (18px)

Inputs/
  ├─ Text (default, focus, error)
  ├─ Checkbox (unchecked, checked, indeterminate)
  ├─ Radio (unchecked, checked)
  ├─ Toggle (off, on)
  ├─ Select (closed, open, disabled)
  └─ DatePicker (calendar view)

Cards/
  ├─ Metric (sm, md, lg)
  ├─ Notification (unread, read)
  └─ Backup (in_progress, completed, failed)

Progress/
  ├─ StorageBar (sm, md, lg)
  ├─ ProgressBar (green, amber, red)
  └─ Spinner (16px, 24px, 32px)

Alerts/
  ├─ Success (green)
  ├─ Warning (amber)
  ├─ Error (red)
  └─ Info (cyan)
```

---

**문서 작성:** C-3PO (Subagent UI/UX Refinement)  
**다음 단계:** Web-Builder 개발 착수, Figma 디자인 시스템 구축
