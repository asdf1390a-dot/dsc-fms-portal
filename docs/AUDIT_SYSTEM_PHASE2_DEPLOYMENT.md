# Audit System Phase 2 — Deployment Checklist

Target deploy: 2026-05-28.

## 0. Pre-flight

- [ ] `npm run build` succeeds locally on a clean checkout.
- [ ] `npx jest __tests__/audit-drs-phase2.test.ts` passes (4 concerns covered).
- [ ] Memory-Automation Phase 2A is healthy (`GET :3009/health`) — DRS does not depend on it but ops dashboard ties them together.

## 1. Environment variables (Vercel)

| Variable                 | Required | Notes                                              |
|--------------------------|----------|----------------------------------------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | yes    | already set                                        |
| `SUPABASE_SERVICE_ROLE_KEY`| yes    | already set, server-only                            |
| `CRON_SECRET`            | yes      | already set for Phase 1; reused                     |
| `TELEGRAM_BOT_TOKEN`     | optional | required only for critical alerts                   |
| `TELEGRAM_CHAT_ID`       | optional | same                                                |
| `AUDIT_DEFAULT_LOCALE`   | new      | `en` (default) \| `ko` \| `ta`. Sets cron default.  |

Verify: `GET /api/audit/health` — every `env.*` key must be `true` (token presence only, not value).

## 2. Database

No DDL is required for Phase 2. The existing `audit_sessions` and `audit_event_logs` tables (db/35) are sufficient. Phase 2 persists the same columns; new computation metadata is returned in the API response, not stored.

Optional follow-up (not blocking):

- `db/38_audit_phase2_status_ext.sql` — extend `audit_sessions.status` CHECK to include `'bootstrap'` so we can persist the true status instead of mapping to `'good'`.
- `db/38_audit_phase2_warnings.sql` — add `warnings jsonb` and `completeness numeric` columns to `audit_sessions` for full audit trail.

These are scheduled for Phase 2.1; Phase 2 ships without them.

## 3. Cron switch

Edit `vercel.json`:

```jsonc
{
  "crons": [
    {
      "path": "/api/audit/cron/daily-v2",
      "schedule": "30 18 * * *"  // 03:30 KST = 18:30 UTC
    }
  ]
}
```

Keep the Phase 1 path commented for one week as a rollback target.

## 4. Smoke test (after deploy)

```bash
# health
curl -s https://dsc-fms-portal.vercel.app/api/audit/health | jq

# manual cron trigger (requires CRON_SECRET)
curl -X POST \
  -H "authorization: Bearer $CRON_SECRET" \
  "https://dsc-fms-portal.vercel.app/api/audit/cron/daily-v2?locale=en" | jq

# locale variants
curl -X POST -H "authorization: Bearer $CRON_SECRET" \
  "https://dsc-fms-portal.vercel.app/api/audit/cron/daily-v2?locale=ko" | jq .computation.warnings
curl -X POST -H "authorization: Bearer $CRON_SECRET" \
  "https://dsc-fms-portal.vercel.app/api/audit/cron/daily-v2?locale=ta" | jq .computation.warnings
```

Expected response shape (success):

```json
{
  "success": true,
  "phase": 2,
  "locale": "en",
  "event_count": 0,
  "data": { "report_date": "...", "drs_score": 100, "status": "good", ... },
  "computation": {
    "drs_score": 100,
    "status": "bootstrap",
    "completeness": 0,
    "is_partial": true,
    "is_bootstrap": true,
    "used_indicators": [],
    "missing_indicators": [...],
    "contributions": {},
    "warnings": ["..."]
  }
}
```

## 5. Acceptance criteria (mapped to evaluator concerns)

- [ ] (1) Partial-data: insert 2 of 4 event types for a test date, manually trigger cron with `?date=...` (TODO param in 2.1), observe `is_partial=true`, `completeness=0.7`, renormalized score.
- [ ] (2) Retry: temporarily set wrong Supabase URL, observe 4 attempts in logs before failure.
- [ ] (3) Bootstrap: with empty `audit_sessions`, trigger cron, observe `is_bootstrap=true`, `drs_score=100`, `status='bootstrap'` in the `computation` object.
- [ ] (4) i18n: cron with `?locale=ko` and `?locale=ta` returns warnings in the respective scripts; Telegram alert (if critical) uses the same locale.

## 6. Rollback

1. Revert `vercel.json` to point cron back to `/api/audit/cron/daily`.
2. Phase 1 route was untouched; no DB rollback needed.
3. Delete the test session row if smoke test wrote one:
   ```sql
   delete from audit_sessions where report_date = '<smoke-date>';
   ```
