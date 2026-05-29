# Team Dashboard Phase 2 — Deploy Checklist

Scope: 8 endpoints under `app/api/team/*` (+ aliases `app/api/portfolio/[memberId]`, `app/api/activity-log/[memberId]`).
RLS: public SELECT, authenticated INSERT/UPDATE/DELETE. JWT decode is local (asset-master pattern).

## 1. DB migration (Supabase SQL Editor)

Run in order:
1. `db/41_team_dashboard_schema.sql` — only if not previously applied (creates `team_members`).
2. `db/42_team_dashboard_phase2_api.sql` — additive: adds `department, start_date, avatar_url, active` to `team_members`; creates `team_structure`, `portfolio_items`, `activity_log` + indexes + RLS + updated_at trigger.

Verify:
```sql
select table_name from information_schema.tables
 where table_schema='public'
   and table_name in ('team_members','team_structure','portfolio_items','activity_log');
-- expect 4 rows
```

## 2. Environment (Vercel + local)

Required (already present for the portal):
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`  — server-only, used by all `app/api/team/*` routes.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — unchanged.

No new env vars introduced.

## 3. Auth contract

- All write endpoints require `Authorization: Bearer <Supabase access_token>`.
- Token is decoded locally via `lib/team/auth.ts` (`authenticateRequest`). No Supabase round-trip.
- 401 `{ success: false, error: <reason> }` on missing/expired/malformed.

## 4. Endpoints (smoke matrix)

| Method | Path                                | Auth | Notes                                              |
|-------:|-------------------------------------|:----:|----------------------------------------------------|
| GET    | /api/team/members                   |  -   | `?page&limit&search&department&active`             |
| POST   | /api/team/members                   |  Y   | body: name, email, ...                             |
| GET    | /api/team/members/:id               |  -   | includes team_structure, portfolio_items, activity |
| PUT    | /api/team/members/:id               |  Y   | partial; camelCase aliases supported               |
| PATCH  | /api/team/members/:id               |  Y   | alias for PUT                                      |
| DELETE | /api/team/members/:id               |  Y   |                                                    |
| GET    | /api/team/structure                 |  -   | returns `{ tree, flat }`                           |
| POST   | /api/team/structure                 |  Y   | upsert by member_id                                |
| GET    | /api/team/portfolio                 |  -   | `?memberId&status`                                 |
| POST   | /api/team/portfolio                 |  Y   | requires member_id + project_name                  |
| GET    | /api/portfolio/:memberId            |  -   | shorthand                                          |
| POST   | /api/portfolio/:memberId            |  Y   | shorthand                                          |
| GET    | /api/team/activity                  |  -   | `?memberId&type&limit` (max 200)                   |
| POST   | /api/team/activity                  |  Y   | requires member_id + activity_type                 |
| GET    | /api/activity-log/:memberId         |  -   | shorthand                                          |

## 5. CI gates (must pass before merge)

```bash
npx jest __tests__/api/team-dashboard-phase2.test.ts   # expect 26/26
npm run build                                          # expect compiled successfully
```

## 6. Post-deploy verification

```bash
BASE=https://dsc-fms-portal.vercel.app
curl -fsS "$BASE/api/team/members?limit=1"          | jq .success
curl -fsS "$BASE/api/team/structure"                 | jq '.data | keys'
curl -fsS "$BASE/api/team/portfolio?status=in_progress" | jq .success
curl -fsS "$BASE/api/team/activity?limit=1"          | jq .success
# write smoke (use a real access_token):
curl -fsS -X POST "$BASE/api/team/members" \
  -H "authorization: Bearer $JWT" -H 'content-type: application/json' \
  -d '{"name":"Smoke","email":"smoke+'"$(date +%s)"'@example.com"}' | jq
```

## 7. Rollback

- All DDL in `db/42` is additive — safe to leave in place on rollback.
- App rollback: revert the merge commit on `main`; Vercel will auto-deploy previous build.
