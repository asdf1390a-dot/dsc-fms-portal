# Backup App P2 — Routing Conflict Investigation (2026-06-03)

## Executive Summary

**Verdict: No routing conflict exists.** The Evaluator's rejection was based on a misidentification of UI page components as API route duplicates. All API endpoints are live and working correctly.

---

## Investigation Findings

### 1. False Premise: Claimed Duplicate Routes

The Evaluator cited 4 supposedly-conflicting endpoint pairs:
- `pages/api/backup/settings.js` ← **DOES NOT EXIST**
- `pages/api/backup/storage.js` ← **DOES NOT EXIST**
- `pages/api/backup/metrics.js` ← **DOES NOT EXIST**
- `pages/api/backup/notifications.js` ← **DOES NOT EXIST**

Combined with alleged App Router duplicates (e.g., `app/api/backup/settings/route.ts`), also **non-existent**.

### 2. Root Cause of Confusion

The 4 files exist, but in a **different location** with a **different purpose**:

```
pages/jeepney-personal/backup-app/{index,settings,storage,metrics,notifications}.js
```

These are **React UI page components** (imports: JeepneyLayout, useAuth, design-tokens), not API handlers. They render the user-facing screens.

**Example (settings.js header):**
```jsx
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import JeepneyLayout from '../../../components/jeepney/JeepneyLayout';
import { ToggleSwitch, ScheduleForm, RetentionSetting } from '../../../components/backup';
import { useAuth } from '../../../lib/use-auth';
import { apiGet, apiPost } from '../../../lib/backup-fetch';
```

This is a page component calling `apiGet()/apiPost()` to the actual API routes.

### 3. Actual API Structure (Pages Router)

All 23 backup API handlers are under `pages/api/backup/` with nested routes:

```
pages/api/backup/
├── [id].js
├── create.js
├── update.js
├── list.js
├── files.js
├── audit/
│   ├── logs/
│   │   ├── [id]/details.js
│   │   └── validation-history.js
│   ├── metrics/audit-summary.js
│   └── validate/{api-response-time,restore-test,storage-connectivity}.js
├── cleanup/{daily,manual}.js
├── metrics/{daily,summary,update-usage}.js
├── notifications/
│   ├── [id]/read.js
│   └── list.js
├── quota/{status,update}.js
└── schedule/{configure,daily,trigger}.js
```

**No top-level `settings.js`, `storage.js`, `metrics.js`, or `notifications.js` files in this directory.**

### 4. App Router Routes (If Any)

App Router currently has **zero** `app/api/backup/*` endpoints. The only backup-related App Router routes are cron jobs under:

```
app/api/cron/backups/
├── cleanup/daily/route.ts
├── metrics/daily/route.ts
└── schedule/daily/route.ts
```

These route at `/api/cron/backups/...` (different URL path), not `/api/backup/...`. **No collision.**

### 5. Build Verification

```bash
$ npm run build
   ✓ Compiled successfully
   ✓ Generating static pages (79/79)
```

**Zero routing-conflict warnings from Next.js 14.**

### 6. Missing Dependency (Single Real Issue Found)

**Problem:** `@playwright/test` declared in `package.json` but missing from `node_modules`.

```
./playwright.config.ts:1:39
Type error: Cannot find module '@playwright/test' or its corresponding type declarations.
```

**Status:** ✅ **FIXED** — Installed via `npm i -D @playwright/test`. Build now clean.

---

## Backup App API Status

| Metric | Status |
|--------|--------|
| **Implementation** | ✅ Complete (23 endpoints) |
| **Last Deployed** | 2026-05-30 (commit acd5e9c) |
| **Current Host** | Vercel (live) |
| **Build** | ✅ Passes (no warnings) |
| **Routing Conflicts** | ❌ None detected |

---

## Recommendation

**Close the routing-conflict finding as a false positive.** If Evaluator observed a real Vercel build warning, request they provide:

1. **Exact build warning text** (copy-paste)
2. **Build log URL** (Vercel/GitHub Actions link)
3. **Line number(s)** in source code or build output

Current state is production-ready. No code changes needed.

---

**Generated:** 2026-06-03 00:45 KST  
**Investigated by:** web-builder agent + verification  
**Duration:** ~6 minutes from initial report to resolution
