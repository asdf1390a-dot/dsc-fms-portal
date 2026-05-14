# Travel Management Database Migration Guide

## Current Status
- ✓ API endpoints implemented (`/api/travels/*`)
- ✓ TypeScript types defined
- ✓ Authentication logic in place
- ❌ **Database tables not yet created**

## Required Action

Execute the migration SQL file in Supabase SQL Editor:

### Steps:

1. **Open Supabase Dashboard**
   - URL: https://pzkvhomhztikhkgwgqzr.supabase.co
   - Sign in with your account

2. **Navigate to SQL Editor**
   - In the left sidebar, click "SQL Editor"
   - Click "New Query"

3. **Copy and Run Migration**
   - Open the file: `db/24_create_travel_tables.sql`
   - Copy ALL content
   - Paste it into the Supabase SQL Editor
   - Click "RUN" button

4. **Verify Tables Created**
   - After running, you should see all 9 tables created:
     - travels
     - travel_members
     - travel_events
     - travel_costs
     - travel_cost_splits
     - travel_checklist_items
     - travel_documents
     - travel_notifications
     - travel_notification_rules

## API Testing (After Migration)

Once tables are created, test with:

```bash
# 1. Create test user and get token
curl -X POST "https://pzkvhomhztikhkgwgqzr.supabase.co/auth/v1/signup" \
  -H "apikey: <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPass123"}'

# 2. Sign in
curl -X POST "https://pzkvhomhztikhkgwgqzr.supabase.co/auth/v1/token?grant_type=password" \
  -H "apikey: <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPass123"}'

# 3. Create travel
curl -X POST "http://localhost:3000/api/travels" \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Singapore Trip 2026",
    "start_date": "2026-05-24",
    "end_date": "2026-05-31",
    "location": "Singapore",
    "description": "Travel MVP test"
  }'
```

## Notes

- RLS (Row Level Security) policies are included in the migration
- All tables have proper constraints and indexes
- Notification rules support days_before_departure triggers
- Cost splitting system supports equal/percentage-based splits
