# PM/BM History & Stats API Guide

This guide provides comprehensive documentation for the PM/BM History Integration Phase 1 API endpoints.

## Overview

Two new API endpoints have been implemented for the DSC FMS Portal:

1. **GET /api/assets/history** - Aggregated PM schedule and BM event history
2. **GET /api/assets/stats** - PM/BM statistics and KPIs

Both endpoints:
- Require Bearer JWT authentication
- Support pagination with limit/offset
- Filter by date range (default: last 90 days)
- Return data ordered by date (newest first for event logs)

---

## Endpoint 1: GET /api/assets/history

Returns aggregated PM schedules and BM events for assets, ordered by date (newest first).

### Request

```bash
GET /api/assets/history?asset_id=<uuid>&from_date=2026-05-01&to_date=2026-05-14&limit=20&offset=0
Authorization: Bearer <jwt_token>
```

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `asset_id` | UUID | null | Filter by specific asset (optional) |
| `from_date` | YYYY-MM-DD | 90 days ago | Start date (inclusive) |
| `to_date` | YYYY-MM-DD | today | End date (inclusive) |
| `status` | string | null | Filter BM events by status (open, in_progress, pending_parts, resolved, cancelled) |
| `limit` | integer | 20 | Page size (1-100) |
| `offset` | integer | 0 | Pagination offset |

### Response Structure

```json
{
  "success": true,
  "user_id": "uuid",
  "date_range": {
    "from": "2026-05-01",
    "to": "2026-05-14"
  },
  "filter": {
    "asset_id": "uuid-or-null",
    "status": "resolved-or-null"
  },
  "pagination": {
    "total": 45,
    "limit": 20,
    "offset": 0,
    "returned": 20
  },
  "history": [
    {
      "type": "PM",
      "id": "uuid",
      "asset_id": "uuid",
      "asset_number": "ASSET-001",
      "asset_name": "Hydraulic Press",
      "location": "Shop Floor A",
      "date": "2026-05-14",
      "timestamp": "2026-05-14T00:00:00Z",
      "title": "Monthly Hydraulic System Check",
      "description": "Routine inspection and maintenance",
      "status": "completed",
      "completed_at": "2026-05-14T08:30:00Z",
      "completed_by_name": "John Doe",
      "actual_hours": 2.5,
      "estimated_hours": 2.0,
      "frequency_days": 30,
      "notes": "System operating normally"
    },
    {
      "type": "BM",
      "id": "uuid",
      "asset_id": "uuid",
      "asset_number": "ASSET-001",
      "asset_name": "Hydraulic Press",
      "location": "Shop Floor A",
      "date": "2026-05-13T14:45:00Z",
      "timestamp": "2026-05-13T14:45:00Z",
      "description": "Pressure gauge reading anomaly",
      "status": "resolved",
      "reported_at": "2026-05-13T14:45:00Z",
      "resolved_at": "2026-05-13T16:30:00Z",
      "downtime_start": "2026-05-13T14:45:00Z",
      "downtime_end": "2026-05-13T16:30:00Z",
      "cause_code": "ELEC-SENSOR",
      "priority": "high",
      "work_hours": 1.75
    }
  ]
}
```

### Response Fields

**PM Record:**
- `type`: Always "PM"
- `status`: pending, in_progress, completed, skipped
- `completed_at`: Timestamp when PM was completed (null if not completed)
- `actual_hours`: Hours actually spent on PM
- `estimated_hours`: Planned hours for PM
- `frequency_days`: PM frequency in days

**BM Record:**
- `type`: Always "BM"
- `status`: open, in_progress, pending_parts, resolved, cancelled
- `downtime_start/end`: Actual machine downtime period
- `cause_code`: Root cause category (MECH-WEAR, ELEC-SHORT, etc.)
- `priority`: low, medium, high, critical
- `work_hours`: Actual repair time

### Example Requests

**Get all history for one asset:**
```bash
curl -X GET "http://localhost:3000/api/assets/history?asset_id=550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer <your-jwt-token>"
```

**Get history for last 30 days with pagination:**
```bash
curl -X GET "http://localhost:3000/api/assets/history?from_date=2026-04-14&to_date=2026-05-14&limit=20&offset=0" \
  -H "Authorization: Bearer <your-jwt-token>"
```

**Get only resolved BM events:**
```bash
curl -X GET "http://localhost:3000/api/assets/history?status=resolved&limit=50" \
  -H "Authorization: Bearer <your-jwt-token>"
```

---

## Endpoint 2: GET /api/assets/stats

Returns aggregated PM/BM statistics and KPIs for assets.

### Request

```bash
GET /api/assets/stats?asset_id=<uuid>&from_date=2026-05-01&to_date=2026-05-14
Authorization: Bearer <jwt_token>
```

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `asset_id` | UUID | null | Filter by specific asset (optional, returns all if null) |
| `from_date` | YYYY-MM-DD | 90 days ago | Period start date |
| `to_date` | YYYY-MM-DD | today | Period end date |

### Response Structure

```json
{
  "success": true,
  "user_id": "uuid",
  "date_range": {
    "from": "2026-05-01",
    "to": "2026-05-14"
  },
  "filter": {
    "asset_id": null
  },
  "stats": [
    {
      "asset_id": "uuid",
      "asset_number": "ASSET-001",
      "asset_name": "Hydraulic Press",
      "location": "Shop Floor A",
      "pm": {
        "scheduled": 4,
        "completed": 3,
        "compliance_rate_percent": "75.0",
        "last_pm_date": "2026-05-14"
      },
      "bm": {
        "total_events": 5,
        "events_by_status": {
          "open": 1,
          "in_progress": 0,
          "pending_parts": 1,
          "resolved": 3,
          "cancelled": 0
        },
        "last_bm_date": "2026-05-13"
      },
      "kpi": {
        "mttr_minutes": "45.50",
        "mtbf_hours": "432.00",
        "uptime_percent": "99.37"
      }
    }
  ]
}
```

### KPI Definitions

**MTTR (Mean Time To Repair):**
- Average time to repair (in minutes) for resolved BM events
- Calculation: Sum of (downtime_end - downtime_start) / count of resolved events
- Falls back to (resolved_at - reported_at) if actual downtime not recorded

**MTBF (Mean Time Between Failures):**
- Average operating hours between failures
- Calculation: (Total hours in period) / (Number of BM events)
- Assumes 24/7 operation

**Uptime Percentage:**
- Percentage of time asset was operational
- Calculation: (1 - Total Downtime Hours / Total Hours) * 100
- Defaults to 100% if no BM events

### Example Requests

**Get stats for one asset:**
```bash
curl -X GET "http://localhost:3000/api/assets/stats?asset_id=550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer <your-jwt-token>"
```

**Get stats for all assets for a specific month:**
```bash
curl -X GET "http://localhost:3000/api/assets/stats?from_date=2026-05-01&to_date=2026-05-31" \
  -H "Authorization: Bearer <your-jwt-token>"
```

---

## Authentication

Both endpoints require a valid Supabase JWT token in the `Authorization` header:

```
Authorization: Bearer <jwt_token>
```

To obtain a token:

1. **Via Supabase Dashboard:**
   - Log in at https://app.supabase.com
   - Navigate to your project
   - Go to Settings → API
   - Copy your JWT from the API section

2. **Via Supabase CLI:**
   ```bash
   supabase auth users list  # Requires authenticated session
   ```

3. **For Testing with Development Account:**
   - Create a test user in Supabase Dashboard
   - Use the generated JWT token from your login session

---

## Error Responses

### 400 Bad Request
```json
{
  "error": "invalid_request",
  "details": ["limit must be integer 1..100", "offset must be non-negative integer"]
}
```

### 401 Unauthorized
```json
{
  "error": "missing_token"
}
```
or
```json
{
  "error": "invalid_token"
}
```

### 500 Internal Server Error
```json
{
  "error": "error message from database"
}
```

---

## Database Indexes

The following indexes optimize query performance:

**pm_schedules:**
- `pm_schedules_scheduled_date_idx` on (scheduled_date)
- `pm_schedules_asset_id_idx` on (asset_id)

**bm_events:**
- `bm_events_asset_idx` on (asset_id)
- `bm_events_reported_at_idx` on (reported_at desc)

---

## Sorting & Pagination Rules

- **History endpoint:** Events ordered by date (newest first) - per project sort-order rule for event logs
- **Pagination:** Offset-based (limit + offset)
- **Default page size:** 20 items
- **Maximum page size:** 100 items (history) / no limit (stats)

---

## Integration Notes for Phase 2

These endpoints are ready for component integration:

1. **History Component:**
   - Can fetch and display combined PM/BM timeline
   - Use pagination to handle large datasets
   - Filter by asset for focused views

2. **Stats Component:**
   - Display KPIs on asset dashboard
   - Use compliance rate for health indicators
   - Compare MTTR/MTBF across assets

3. **Caching Strategy:**
   - Consider implementing 5-minute in-memory cache for stats
   - Cache invalidates on new PM/BM events
   - See `lib/cache-manager.js` for existing patterns

---

## Testing Checklist

- [ ] `/api/assets/history` returns 401 without token
- [ ] `/api/assets/history` returns 400 with invalid limit
- [ ] `/api/assets/history` paginates correctly (offset + limit)
- [ ] `/api/assets/history` filters by asset_id
- [ ] `/api/assets/history` filters by date range
- [ ] `/api/assets/history` mixes PM and BM events correctly
- [ ] `/api/assets/stats` returns all assets without asset_id filter
- [ ] `/api/assets/stats` calculates PM compliance correctly
- [ ] `/api/assets/stats` calculates MTTR from downtime_start/end
- [ ] `/api/assets/stats` calculates MTBF correctly
- [ ] `/api/assets/stats` calculates uptime percentage correctly

---

## Implementation Details

### Query Optimization

1. Both endpoints use Supabase Admin client for authenticated access
2. `count: 'exact'` option used only in history endpoint (pagination support)
3. Select projections limited to required fields only
4. Filtering applied server-side before pagination

### Performance Characteristics

- **History endpoint:** O(n*m) for merge sort, where n=PM events, m=BM events
- **Stats endpoint:** O(n + m) for aggregation, where n=PM data, m=BM data
- Both optimized for typical small-to-medium asset counts (<100)
- Pagination prevents loading entire datasets

### Time Zone Handling

- All dates stored in UTC (ISO 8601 format)
- Client responsible for converting to local time
- Date range filters use calendar dates (YYYY-MM-DD) with assumed UTC midnight

---

## See Also

- Phase 1 Design: `PHASE1_DESIGN.md` (if available)
- PM Module Schema: `db/06_pm_module.sql`
- BM Module Schema: `db/04_bm_module_v2.sql`
- Existing API patterns: `pages/api/bm/records.js`
