# 팀 블로킹 자가보고 시스템

**목표**: 팀원이 차단된 상황을 즉시 보고 → Telegram 현황판에 자동 반영

---

## 📢 Telegram 블로킹 보고 (즉시 구현)

### 사용 방법

```
/blocked [이유] [필요 정보] [예상 해결 시간]

예시:
/blocked SendGrid 키 없음 필요: SendGrid API 키 예상: 30분
/blocked Vercel 토큰 부재 필요: Staging project ID, token 예상: 1시간
```

### 시스템 흐름

```
팀원 /blocked 명령 실행
    ↓
Telegram 봇이 메시지 캡처
    ↓
DB team_blockers 에 저장
    ↓
비서가 30분마다 확인하며 현황판 업데이트
    ↓
Telegram msg#2008에 자동 반영 (🟡 상태로)
```

### DB 구조

**team_blockers 테이블**
```sql
CREATE TABLE team_blockers (
  id BIGSERIAL PRIMARY KEY,
  team_member TEXT NOT NULL,        -- 누가
  reason TEXT NOT NULL,              -- 왜 막혔는가
  required_info TEXT,                -- 필요한 정보/권한
  estimated_resolution_mins INT,     -- 예상 해결 시간 (분)
  reported_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,           -- NULL = 아직 미해결
  resolution_notes TEXT,
  
  CONSTRAINT check_resolution CHECK (resolved_at IS NULL OR resolved_at > reported_at)
);
```

---

## 🔧 구현 체크리스트

**Phase 1 (즉시)**
- [ ] Telegram 봇 `/blocked` 명령 핸들러 추가
- [ ] DB team_blockers 마이그레이션
- [ ] 메시지 → DB 저장 로직

**Phase 2 (명일)**
- [ ] 비서 크론이 블로킹 목록을 읽고 상황판에 반영
- [ ] `/unblock [id]` 명령으로 해결 표시

**Phase 3 (Portal MVP)**
- [ ] 포털에서 블로킹 폼 UI 추가
- [ ] 블로킹 이력 대시보드

---

## 📝 팀원 안내사항

```
팀원에게 공지:
차단되면 빠르게 보고해주세요.

/blocked SendGrid 키 없음 필요: SendGrid API 키

- 팀장(나)은 30분마다 현황판 갱신
- 블로킹 보고 → 자동으로 현황판에 표시됨
- 해결되면 /unblock [id]로 완료 표시
```

---

## 🚀 현황판 반영 예시

**Before:**
```
🟢 백업앱 Phase 2 Week 2 — 유휴?
```

**After (차단 보고 후):**
```
🟡 백업앱 Phase 2 Week 2 — 정보 대기 중
  ├─ 필요: SendGrid API 키
  ├─ 필요: Telegram 봇 토큰
  ├─ 필요: Staging Vercel ID
  └─ 보고 시각: 13:43 KST
```

---

## 🔐 RLS 정책

```sql
-- team_blockers 테이블 RLS
-- 누구나 읽기 (팀 전체에게 투명성 필요)
-- 본인만 쓰기 (거짓 보고 방지)
-- 관리자(비서)만 resolve 가능
```
