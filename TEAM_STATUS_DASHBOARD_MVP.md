# Team Status Dashboard — MVP 설계

**범위**: 팀 현황판의 최소 기능 (상태 조회만)
**개발 기간**: 2-3일 (웹개발자, 2026-05-25 시작)
**기술**: Next.js 14 + Supabase RLS

---

## 📌 MVP 요구사항

### 1. Status Board (메인 화면)
| 요소 | 내용 |
|------|------|
| **상태 카드** | 담당자 / 상태(🟢🟡⏸️🔴) / 현재 작업 / ETA |
| **실시간 동기** | Telegram 현황판과 동일 (msg#2008) |
| **블로킹 이유** | 🟡 상태일 때 필요 정보 표시 |
| **마지막 갱신** | "30분 전 갱신" (Telegram 크론과 동기) |

### 2. 필터링
- **상태별**: 진행중 / 대기 / 완료 / 유휴
- **담당자별**: 웹개발자 / 플레너 / 백업앱 / 투자분석 / 번역가 / 데이터분석가 / 평가자

### 3. 활동 로그
| 컬럼 | 타입 |
|------|------|
| 담당자 | text |
| 상태 변화 | enum (🟢→🟡, 🟡→🟢, etc) |
| 변화 시각 | timestamp |
| 이유/작업 | text (블로킹 사유 또는 완료 내용) |
| 지속 시간 | calculated (블로킹 시간) |

### 4. 블로킹 자가보고 (간단 폼)
```
[담당자 선택]
[블로킹 이유 입력 (필수)]
[필요한 정보/권한 (선택)]
[예상 해결 시간 (선택)]
[제출] 
```
→ DB에 저장 → Telegram 자동 반영

---

## 🗄️ DB 스키마 (신규)

### `team_status_logs`
```sql
CREATE TABLE team_status_logs (
  id BIGSERIAL PRIMARY KEY,
  team_member TEXT NOT NULL, -- 비서, 웹개발자, 플레너, etc
  status ENUM ('working', 'blocked', 'idle', 'completed'),
  current_task TEXT,
  blocking_reason TEXT,
  required_info TEXT,
  eta_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `team_blockers` (블로킹 이력)
```sql
CREATE TABLE team_blockers (
  id BIGSERIAL PRIMARY KEY,
  team_member TEXT NOT NULL,
  reason TEXT NOT NULL,
  required_info TEXT,
  reported_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolution TEXT
);
```

---

## 🎨 UI 레이아웃

```
┌─────────────────────────────────────────┐
│  Team Status Dashboard                  │
│  Last update: 30 min ago                │
├─────────────────────────────────────────┤
│ 필터: [All] [진행중] [대기] [완료]       │
│ 담당자: [All] [웹개발자] [플레너] ...  │
├─────────────────────────────────────────┤
│                                         │
│ ┌─ 비서 🟢 ─────────────────────────┐  │
│ │ 작업: Portal MVP 개발 중          │  │
│ │ ETA: 2026-05-16 17:00             │  │
│ │ 시간: 1시간 14분 경과             │  │
│ └─────────────────────────────────┘  │
│                                         │
│ ┌─ 웹개발자 🟢 ──────────────────────┐  │
│ │ 작업: 여행관리앱 MVP 개발          │  │
│ │ ETA: 2026-05-24 23:59             │  │
│ │ 시간: 10일 10시간                 │  │
│ └─────────────────────────────────┘  │
│                                         │
│ ┌─ 백업앱 Phase 2 🟡 ────────────────┐  │
│ │ 상태: 정보 대기 중                 │  │
│ │ 필요: SendGrid API 키              │  │
│ │       Telegram 봇 토큰             │  │
│ │       Staging Vercel ID            │  │
│ │ 보고 시각: 13:43                  │  │
│ └─────────────────────────────────┘  │
│                                         │
└─────────────────────────────────────────┘
```

---

## 📋 개발 체크리스트

- [ ] DB 마이그레이션 (team_status_logs, team_blockers)
- [ ] RLS 정책 (팀원 본인 + 관리자만 보기/쓰기)
- [ ] Status Board UI (카드 컴포넌트)
- [ ] 필터링 로직 (상태/담당자별)
- [ ] 활동 로그 테이블 뷰
- [ ] 블로킹 자가보고 폼
- [ ] Telegram ↔ Portal 동기 (API)
- [ ] 실시간 갱신 (polling 또는 WebSocket)
- [ ] 테스트 + 배포

---

## 🚀 Post-MVP (나중에)

- 통계 대시보드 (평균 블로킹 시간, 완료율, etc)
- Slack/Discord 연동 알림
- 담당자별 활동 상세 분석
- 성능 개선 (blocked → resolved 소요 시간 줄이기)
