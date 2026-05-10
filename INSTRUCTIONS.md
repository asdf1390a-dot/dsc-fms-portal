# DSC FMS Portal — 배포 가이드 (이번 변경분)

## 📦 이 zip에 포함된 것

```
.gitignore                    ← 새 파일 (env 파일 깃 제외)
.env.local.example            ← 새 파일 (환경변수 템플릿)
package.json                  ← 수정 (@supabase/supabase-js 추가)
lib/supabase.js               ← 새 파일 (DB 클라이언트)
pages/assets/index.js         ← 새 파일 (모바일 자산목록)
db/                           ← 새 폴더 (DB 스크립트, 참고용)
INSTRUCTIONS.md               ← 이 파일
```

> `pages/index.js` (기존 대시보드)는 **건드리지 않았어요**.

---

## 🚀 배포 순서 (반드시 이 순서로!)

### 1️⃣ Vercel 환경변수 먼저 설정 (배포 전에)

1. https://vercel.com/dashboard → `dsc-fms-portal` 프로젝트 클릭
2. **Settings → Environment Variables**
3. 아래 2개 추가 (Production + Preview + Development 모두 체크):

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://pzkvhomhztikhkgwgqzr.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (텔레그램으로 보내드린 JWT 키 전체) |

`SUPABASE_SERVICE_ROLE_KEY`(`sb_secret_...`)는 지금은 안 넣어도 됨 (나중에 서버사이드 쓸 때만).

**Save 클릭.**

---

### 2️⃣ 코드 푸시 (둘 중 편한 거)

#### 방법 A — GitHub 웹 UI 드래그앤드롭

1. https://github.com/asdf1390a-dot/dsc-fms-portal 열기
2. **`.gitignore`, `.env.local.example`, `package.json`** 부터 (루트):
   - 각 파일 클릭 → 펜 아이콘(편집) 또는 Add file → Upload files → 드래그
3. **`lib/`, `pages/assets/`, `db/`** 폴더는:
   - 루트에서 **Add file → Upload files**
   - 압축 푼 폴더 통째로 드래그 (Chrome은 폴더 구조 유지됨)
4. 하단 commit 메시지: `Add Supabase asset master + /assets page`
5. **Commit changes**

#### 방법 B — git CLI

PC에 git 깔려있으면:
```bash
# 처음이면 클론
git clone https://github.com/asdf1390a-dot/dsc-fms-portal.git
cd dsc-fms-portal

# zip 풀어서 모든 파일/폴더를 이 위치로 복사 (덮어쓰기 OK)
# (압축 푼 폴더 안의 .gitignore, lib/, pages/, db/, package.json 등 모두)

git add .
git commit -m "Add Supabase asset master + /assets page"
git push
```

---

### 3️⃣ Vercel 자동 배포 대기 (~2분)

Vercel 대시보드에 가면 새 배포가 빌드 중인 거 보임. 끝나면 ✅ 표시.

**중요:** 환경변수가 1단계에서 미리 들어가있어야 빌드 성공함. 안 넣었으면 먼저 넣고 → 재배포(Redeploy).

---

### 4️⃣ 모바일에서 확인

휴대폰 브라우저에서:
```
https://dsc-fms-portal.vercel.app/assets
```

- 506대 자산 리스트 보여야 함
- 검색창에 `DCMI-PSF` 같은 거 입력 → 필터 됨
- 카테고리 칩 클릭 (`01 UTLITY` 등) → 카테고리별 필터
- 우상단 `EN · த` 누르면 영어/타밀 토글

---

## ❓ 트러블슈팅

| 증상 | 원인 / 해결 |
|---|---|
| 빈 화면, "Error: ..." | 환경변수 누락 → Vercel Settings 확인 → Redeploy |
| `Loading…`만 계속 뜸 | RLS 정책 미적용 → Supabase에서 `04_rls_public_read.sql` 다시 Run |
| 506대인데 0/0 표시 | anon 키가 잘못됨 → JWT 키 다시 복붙 |
| 빌드 실패 (Vercel) | `package.json`이 푸시 안 됐거나 `node_modules` 같이 푸시함 |

---

질문 있으면 텔레그램으로 화면 캡처와 함께. 🤖
