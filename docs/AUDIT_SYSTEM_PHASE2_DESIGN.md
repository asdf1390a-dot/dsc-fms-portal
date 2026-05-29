# Audit System Phase 2 — Design

Source: `audit_system_framework.md`, Phase 1 implementation in `app/api/audit/`, DB schema `db/35_audit_system.sql`.

Phase 2 scope: harden the daily reliability score (DRS) pipeline for the four issues raised by the evaluator's conditional GO review.

## 0. Indicator set (canonical for Phase 2)

Phase 2 follows the column set already in `audit_sessions` (db/35), which slightly differs from the original framework doc — backup, storage, integrity, access. The framework's "API response time / alert delivery" indicators are surfaced separately by the harness, not in DRS.

| Indicator              | Column                  | Weight |
|------------------------|-------------------------|--------|
| Backup recovery rate   | `backup_recovery_rate`  | 0.40   |
| Storage health rate    | `storage_health_rate`   | 0.30   |
| Data integrity rate    | `data_integrity_rate`   | 0.20   |
| Accessibility rate     | `accessibility_rate`    | 0.10   |

Sum = 1.00. Validated by `weights sum to 1.0` test.

## 1. [HIGH] Partial-data DRS calculation

**Problem.** Phase 1 silently substituted `100` for any missing indicator, masking sensor outages and producing a falsely healthy DRS.

**Decision.** Renormalize weights across the indicators that have data, and flag the report as partial.

Algorithm (see `lib/audit/drs-calculator.ts`):

1. `used` = indicators with a non-null value in `[0, 100]`.
2. `completeness = Σ WEIGHTS[k] for k in used`  (range 0..1).
3. If `completeness == 0`:
   - if `hasHistory == false` → bootstrap path (§3).
   - else → `drs=0`, `status='critical'`, surface observability failure.
4. If `0 < completeness < 0.5` → still compute renormalized DRS, but force `status='critical'` and attach `Insufficient data` warning. Surface the number so trend charts keep working; the flag protects decision-makers.
5. Otherwise → `drs = Σ (value[k] * WEIGHTS[k]) / completeness`, status via thresholds (≥95 good, ≥85 caution, else critical).

**Why renormalize instead of zero-fill.** A missing indicator is an observability failure, not a 0% indicator value. Zero-fill conflates the two and triggers false-positive alerts during sensor outages. Renormalization preserves the score's semantics (weighted average over observed dimensions) while `is_partial` + `missing_indicators` carry the observability concern downstream.

**Persisted shape.** `audit_sessions` columns are unchanged; missing indicators remain `NULL`. The Phase 2 cron returns `computation.warnings` and `computation.completeness` in the API response so downstream consumers (dashboard, Telegram bot) can render the partial state without a DB migration.

## 2. [HIGH] Network failure retry policy

**Problem.** Phase 1 cron made unguarded Supabase and Telegram calls; a single transient 503 wipes the day's DRS.

**Decision.** Wrap external calls with `withRetry()` (`lib/audit/retry.ts`).

| Parameter      | Value                                    |
|----------------|------------------------------------------|
| Max attempts   | 4 (1 initial + 3 retries)                |
| Base delay     | 500 ms                                   |
| Factor         | 2.0                                      |
| Jitter         | full (`sleep = random(0, base*2^(n-1))`) |
| Budget         | 15 000 ms total wall-clock               |
| Retryable      | network errors, HTTP 429, HTTP 5xx, timeouts |
| Non-retryable  | HTTP 4xx (except 429) — fast-fail        |

The 15 s budget keeps the cron under Vercel's serverless cap and lets the daily run finish well before the 03:30 Telegram broadcast.

## 3. [MEDIUM] Bootstrap (first-day initial value)

**Problem.** Day 0 has no history and no events — every "missing" path triggers critical.

**Decision.** Distinguish "first ever run" from "ongoing run with missing data" via a history probe (`select count(*) from audit_sessions`).

- `hasHistory = false` AND `completeness = 0` → emit `status='bootstrap'`, `drs=100`, single `Bootstrap report` warning. Treated as an "untested optimism" baseline that dashboards render distinctly from `good`.
- `hasHistory = true` AND `completeness = 0` → real observability failure → `critical` with `drs=0`.

The DB column `audit_sessions.status` has a CHECK constraint that does not include `'bootstrap'`. We persist `'good'` in that column and carry the true status in the API response. A future DDL (db/38, see deployment checklist) can extend the constraint without breaking compatibility.

## 4. [MEDIUM] Multilingual alerts and reports

**Decision.** Locale is a request parameter on the cron endpoint, defaulting to `AUDIT_DEFAULT_LOCALE` env (fallback `en`). Supported: `en`, `ko`, `ta`.

- Per-message dictionaries live in `lib/audit/drs-calculator.ts` (`MESSAGES`).
- Telegram alert text uses the resolved locale.
- Warnings inside `computation.warnings` honor the same locale so the dashboard can render without re-translation.
- Persistence is locale-neutral (numbers + enum status), so backfilling translated views later is purely a presentation concern.

The Vercel cron entry can pass `?locale=ko` if the operations team wants Korean as default; the env-level default keeps it configurable without code change.

## API surface

| Endpoint                                | Method | Auth                 | Purpose                                  |
|-----------------------------------------|--------|----------------------|------------------------------------------|
| `/api/audit/cron/daily-v2`              | POST   | `Bearer CRON_SECRET` | Phase 2 daily DRS (replaces Phase 1)     |
| `/api/audit/health`                     | GET    | none                 | Probe env + Supabase + latest session    |
| `/api/audit/report` (Phase 1, unchanged)| GET    | none                 | Latest or by-date session                |
| `/api/audit/trend`  (Phase 1, unchanged)| GET    | none                 | DRS time series                          |
| `/api/audit/issue`  (Phase 1, unchanged)| GET    | none                 | Active issues                            |

The Phase 1 cron route is kept in place for the canary period; ops switches `vercel.json` to `daily-v2` once Phase 2 is verified.

## Files

- `lib/audit/drs-calculator.ts` — partial-data + bootstrap + i18n
- `lib/audit/retry.ts` — exponential backoff with full jitter
- `app/api/audit/cron/daily-v2/route.ts` — Phase 2 cron handler
- `app/api/audit/health/route.ts` — health probe
- `__tests__/audit-drs-phase2.test.ts` — unit tests (4 concerns)
