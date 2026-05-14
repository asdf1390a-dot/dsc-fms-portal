# Travel Management MVP — Comprehensive Test Plan

## Prerequisites
- ✅ Database migration executed: `db/24_create_travel_tables.sql` in Supabase SQL Editor
- ✅ Dev server running: `npm run dev` on port 3000 (or 3001)
- ✅ Test Supabase user created with valid auth token
- ✅ All environment variables set in `.env.local`

## Phase 1: Authentication & Setup (Pre-test Checklist)

### 1.1 Supabase Database Setup
```bash
# 1. Open Supabase dashboard
https://pzkvhomhztikhkgwgqzr.supabase.co

# 2. Click SQL Editor → New Query
# 3. Copy entire content of db/24_create_travel_tables.sql
# 4. Paste and click RUN

# Expected: All 9 tables created successfully
# Tables: travels, travel_members, travel_events, travel_costs, travel_cost_splits,
#         travel_checklist_items, travel_documents, travel_notifications, travel_notification_rules
```

### 1.2 Create Test User (Supabase Auth)
```bash
curl -X POST "https://pzkvhomhztikhkgwgqzr.supabase.co/auth/v1/signup" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6a3Zob21oenRpa2hrZ3dncXpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNzE4NjUsImV4cCI6MjA5Mzg0Nzg2NX0.hbhswNU-8YqhuxwfPL7_ANGr4CykS-BQaVcQXtjPfsE" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test.travel@example.com",
    "password": "TestTravel@2026"
  }'

# Save: user_id and access_token from response
```

### 1.3 Get Auth Token
```bash
curl -X POST "https://pzkvhomhztikhkgwgqzr.supabase.co/auth/v1/token?grant_type=password" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6a3Zob21oenRpa2hyZ3dncXpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNzE4NjUsImV4cCI6MjA5Mzg0Nzg2NX0.hbhswNU-8YqhuxwfPL7_ANGr4CykS-BQaVcQXtjPfsE" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test.travel@example.com",
    "password": "TestTravel@2026"
  }'

# Save: access_token value
export TEST_TOKEN="<access_token_from_response>"
```

---

## Phase 2: Core API Endpoints

### 2.1 Create Travel (POST /api/travels)
**Status:** 🟡 Ready to test (requires database)

```bash
curl -X POST "http://localhost:3000/api/travels" \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Singapore Trip 2026",
    "start_date": "2026-05-24",
    "end_date": "2026-05-31",
    "location": "Singapore",
    "description": "Tier-2 expansion trip from DSC Mannur"
  }'

# Expected response:
# {
#   "success": true,
#   "data": {
#     "id": "<uuid>",
#     "user_id": "<uuid>",
#     "name": "Singapore Trip 2026",
#     "status": "upcoming",
#     "created_at": "2026-05-14T...",
#     ...
#   },
#   "message": "Travel created successfully"
# }

# Save: travel_id for subsequent tests
export TRAVEL_ID="<id_from_response>"
```

**Test Cases:**
- ✅ Valid travel with all fields
- ✅ Valid travel without description
- ❌ Missing required fields (name, dates)
- ❌ Invalid date range (end_date < start_date)
- ❌ No authorization header
- ❌ Invalid token

---

### 2.2 Get Travels (GET /api/travels)
**Status:** 🟡 Ready to test

```bash
curl -X GET "http://localhost:3000/api/travels" \
  -H "Authorization: Bearer $TEST_TOKEN"

# Expected: List of travels user created/joined
```

**Test Cases:**
- ✅ List all travels
- ✅ Filter by status: `?status=upcoming`
- ✅ Sort by: `?sortBy=name&order=asc`
- ✅ Pagination (if implemented)
- ❌ No authorization

---

### 2.3 Get Travel Detail (GET /api/travels/:id)
**Status:** 🟡 Ready to test

```bash
curl -X GET "http://localhost:3000/api/travels/$TRAVEL_ID" \
  -H "Authorization: Bearer $TEST_TOKEN"

# Expected: Full travel object with nested members, events, costs, etc.
```

**Test Cases:**
- ✅ Valid travel_id
- ❌ Invalid travel_id
- ❌ Travel from another user (RLS policy)

---

### 2.4 Update Travel (PATCH /api/travels/:id)
**Status:** 🟡 Ready to test

```bash
curl -X PATCH "http://localhost:3000/api/travels/$TRAVEL_ID" \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Singapore + Penang Trip 2026",
    "status": "ongoing",
    "description": "Extended tier-2 expansion"
  }'

# Expected: Updated travel object
```

---

## Phase 3: Travel Members

### 3.1 Add Member (POST /api/travels/:id/members)
**Status:** 🟡 Ready to test

```bash
curl -X POST "http://localhost:3000/api/travels/$TRAVEL_ID/members" \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "user_email": "companion@example.com",
    "role": "companion",
    "permission": "read_write"
  }'
```

---

### 3.2 Get Members (GET /api/travels/:id/members)
**Status:** 🟡 Ready to test

```bash
curl -X GET "http://localhost:3000/api/travels/$TRAVEL_ID/members" \
  -H "Authorization: Bearer $TEST_TOKEN"
```

---

## Phase 4: Travel Schedule (Events)

### 4.1 Create Event (POST /api/travels/:id/events)
**Status:** 🟡 Ready to test

```bash
curl -X POST "http://localhost:3000/api/travels/$TRAVEL_ID/events" \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Flight: Bangalore to Singapore",
    "event_type": "flight",
    "event_date": "2026-05-24",
    "event_time": "06:00",
    "location": "Bangalore Airport (BLR)",
    "description": "Air India Express to Singapore",
    "details": {
      "flight_number": "IX555",
      "airline": "Air India Express",
      "departure_airport": "BLR",
      "arrival_airport": "SIN",
      "duration_hours": 3
    }
  }'
```

---

### 4.2 Get Events (GET /api/travels/:id/events)
**Status:** 🟡 Ready to test

```bash
curl -X GET "http://localhost:3000/api/travels/$TRAVEL_ID/events" \
  -H "Authorization: Bearer $TEST_TOKEN"
```

---

### 4.3 Update Event (PATCH /api/travels/:id/events/:eventId)
**Status:** 🟡 Ready to test

---

## Phase 5: Travel Costs

### 5.1 Create Cost (POST /api/travels/:id/costs)
**Status:** 🟡 Ready to test

```bash
curl -X POST "http://localhost:3000/api/travels/$TRAVEL_ID/costs" \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Flight tickets (BLR→SIN)",
    "amount": "15000",
    "currency": "INR",
    "category": "transport"
  }'
```

---

### 5.2 Get Costs (GET /api/travels/:id/costs)
**Status:** 🟡 Ready to test

---

### 5.3 Cost Splits
Cost splitting implementation supports equal/percentage-based splits.

---

## Phase 6: Checklist

### 6.1 Create Checklist Item (POST /api/travels/:id/checklist)
**Status:** 🟡 Ready to test

```bash
curl -X POST "http://localhost:3000/api/travels/$TRAVEL_ID/checklist" \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "item_text": "Book hotel in Singapore",
    "category": "accommodation",
    "priority": "high"
  }'
```

---

### 6.2 Get Checklist (GET /api/travels/:id/checklist)
**Status:** 🟡 Ready to test

---

### 6.3 Update Checklist (PATCH /api/travels/:id/checklist/:itemId)
**Status:** 🟡 Ready to test

---

## Phase 7: Documents

### 7.1 Upload Document (POST /api/travels/:id/documents)
**Status:** 🟡 Ready to test (requires file upload)

---

### 7.2 Get Documents (GET /api/travels/:id/documents)
**Status:** 🟡 Ready to test

---

## Phase 8: Notifications

### 8.1 Get Notification Rules (GET /api/travels/:id/notifications)
**Status:** 🟡 Ready to test

```bash
curl -X GET "http://localhost:3000/api/travels/$TRAVEL_ID/notifications" \
  -H "Authorization: Bearer $TEST_TOKEN"

# Expected: Default notification rules created at travel creation
```

**Default Rules (Auto-created):**
- 7 days before departure
- 1 day before departure  
- 24 hours before departure (Emergency alert)

---

### 8.2 Toggle Notification Rule (PATCH /api/travels/:id/notifications)
**Status:** 🟡 Ready to test

```bash
curl -X PATCH "http://localhost:3000/api/travels/$TRAVEL_ID/notifications" \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ruleId": "<rule_id>",
    "is_enabled": false
  }'
```

---

## Phase 9: Cron & Automated Notifications

### 9.1 Cron Notification Job (POST /api/cron/notifications)
**Status:** 🟡 Ready to test

```bash
curl -X POST "http://localhost:3000/api/cron/notifications" \
  -H "Authorization: Bearer test-secret-travel-migration"

# Expected: Processes travels with upcoming dates and sends notifications
```

**Test Case:** Create a travel starting tomorrow and verify notifications are sent.

---

## Phase 10: UI End-to-End

### 10.1 Travel List Page
**Path:** `/travel`
- ✅ Displays list of travels
- ✅ Status filter working
- ✅ Sort by date/name working
- ✅ "New Travel" button functional

### 10.2 Create Travel Page
**Path:** `/travel/create`
- ✅ Form validation
- ✅ Date range validation
- ✅ Duration calculation
- ✅ API integration

### 10.3 Travel Detail Page
**Path:** `/travel/:id`
- ✅ Tab navigation (6 tabs)
- ✅ Overview tab
- ✅ Schedule tab
- ✅ Costs tab
- ✅ Checklist tab
- ✅ Documents tab
- ✅ Notifications tab (Emergency alerts)

---

## Phase 11: Row-Level Security (RLS) Testing

### 11.1 User Can Only See Own Travels
- ✅ Create travel with User A
- ✅ Login as User B
- ✅ Verify User B cannot see User A's travel

### 11.2 Travel Members See All Travel Data
- ✅ Create travel with User A
- ✅ Add User B as companion
- ✅ Login as User B
- ✅ Verify User B can see full travel details

---

## Phase 12: Error Handling

### 12.1 Database Errors
- ✅ Handle PGRST205 (table not found)
- ✅ Handle unique constraint violations
- ✅ Handle invalid UUID format

### 12.2 Auth Errors
- ✅ Missing authorization header
- ✅ Invalid token
- ✅ Expired token

### 12.3 Validation Errors
- ✅ Missing required fields
- ✅ Invalid date ranges
- ✅ Invalid email format

---

## Phase 13: Performance & Load Testing

### 13.1 Large Travel List
- ✅ Create 50+ travels
- ✅ Verify list loads in <2s
- ✅ Verify filtering/sorting responsive

### 13.2 Complex Event List
- ✅ Create 100+ events for single travel
- ✅ Verify pagination/lazy loading

---

## Final Checklist

- [ ] Database migration executed
- [ ] All 9 tables created and RLS policies applied
- [ ] Phase 1-9 API endpoints tested
- [ ] Phase 10 UI pages tested (all 3 main pages)
- [ ] Phase 11 RLS policies verified
- [ ] Phase 12 error handling confirmed
- [ ] Cron job scheduled and tested
- [ ] Notifications sent via all channels (in-app, email, Telegram)
- [ ] Emergency alerts (24h before departure) working
- [ ] Production deployment to Vercel
- [ ] Cron job configured in Vercel dashboard

---

## Known Issues & Limitations

### MVP Scope
- ✅ Basic travel CRUD
- ✅ Schedule/events (flight, hotel, meal, transport)
- ✅ Cost tracking with splits
- ✅ Checklist management
- ✅ Document storage
- ✅ Emergency notifications only (24h, 1d, 7d before departure)
- ✅ Tab-based UI navigation
- ✅ Accordion layouts for collapse/expand

### Phase 2 Features (Out of MVP scope)
- ❌ Custom notification rules
- ❌ SMS notifications
- ❌ Expense reimbursement tracking
- ❌ Travel budget forecasting
- ❌ Photo gallery
- ❌ Collaborative map markers

---

## Deployment Checklist

### Pre-Production
- [ ] All tests passed
- [ ] Environment variables configured
- [ ] CRON_SECRET set in production env
- [ ] Email template tested
- [ ] Telegram bot connected
- [ ] Vercel deployment configured

### Production
- [ ] Deploy to Vercel with all env vars
- [ ] Configure cron job in Vercel dashboard: `POST /api/cron/notifications` daily 02:00 KST
- [ ] Verify Supabase production database
- [ ] Test end-to-end in production
- [ ] Monitor error logs for first 24h
- [ ] Announce to team

---

## Support & Troubleshooting

### Database Connection Issues
```
Error: "Could not find the table 'public.travels'"
→ Ensure db/24_create_travel_tables.sql was executed successfully
```

### Auth Token Issues
```
Error: "Unauthorized"
→ Verify TEST_TOKEN is valid (not expired)
→ Check NEXT_PUBLIC_SUPABASE_URL and service role key
```

### Cron Job Issues
```
Error: "Failed to process notifications"
→ Check CRON_SECRET matches in .env.local
→ Verify Vercel cron job is properly scheduled
```

---

## Estimated Testing Timeline
- Phase 1-9 (APIs): 30 minutes
- Phase 10 (UI): 20 minutes
- Phase 11-13 (Advanced): 30 minutes
- **Total:** ~1.5 hours for full comprehensive test

