# Travel Management Module — Phase 2 Frontend Plan

**Timeline:** 2026-05-15 to 2026-05-27 (13 days)  
**Status:** Phase 1 API complete, ready to implement UI  

---

## 📂 File Structure

```
dsc-fms-portal/
├── app/
│   └── travels/
│       ├── page.tsx                  # TravelList page
│       └── [id]/
│           ├── page.tsx              # TravelDetail page
│           └── layout.tsx            # Tab navigation layout
├── components/
│   └── travels/
│       ├── TravelCard.tsx            # Card in list view
│       ├── TravelForm.tsx            # Create/edit modal
│       ├── MemberManager.tsx         # Add/remove members
│       ├── EventManager.tsx          # Event list + form
│       ├── CostManager.tsx           # Cost list + form
│       ├── SettlementTable.tsx       # Settlement summary
│       ├── ChecklistManager.tsx      # Checklist items + form
│       ├── DocumentUploader.tsx      # File upload
│       ├── NotificationSettings.tsx  # Rule management
│       └── TabNavigation.tsx         # Tab switcher
└── hooks/
    └── useTravelData.ts             # Custom hook for data fetching & sync
```

---

## 📱 Pages & Components

### Page 1: TravelList (`app/travels/page.tsx`)

**Features:**
- Fetch user travels on mount
- Display as card grid
- Filter by status (all, upcoming, ongoing, completed)
- Sort by (date, cost, name)
- Action buttons: Create new, View details

**Components Used:**
- TravelCard (8+ times)
- TravelForm (modal)

**State:**
- travels: Travel[]
- filter: status
- sort: 'date' | 'cost' | 'name'
- isCreateModalOpen: boolean

---

### Page 2: TravelDetail (`app/travels/[id]/page.tsx`)

**Layout:** 6 horizontal tabs

**Tab 1: Overview**
- Travel name, description, dates, location
- Member list (with roles)
- Edit button (organizer only)

**Tab 2: Schedule**
- Event list (flight, hotel, meal, transport, other)
- Timeline/calendar view
- Add event button
- Edit/delete buttons per event

**Tab 3: Costs & Settlement**
- Cost list with payer, amount, splits
- Settlement table showing member balances
- Add cost button
- Bulk edit splits
- Download settlement report

**Tab 4: Checklist**
- Items grouped by category (documents, clothing, toiletries, etc.)
- Check/uncheck items
- Priority indicators (low/medium/high)
- Add item button
- Delete item

**Tab 5: Documents**
- File list with upload date, size, type
- Document type tags (visa, passport, receipt, etc.)
- Upload button (drag-drop or file select)
- Download links
- Delete button

**Tab 6: Notifications**
- List of sent notifications
- Notification rule settings (enable/disable)
- Channels: in_app, email, telegram

---

## 🧩 Component Breakdown

### TravelCard (`components/travels/TravelCard.tsx`)
- Displays: name, location, date range, member count, total cost
- Actions: view, edit, delete
- Status badge (upcoming/ongoing/completed)
- Cost progress bar

### TravelForm (`components/travels/TravelForm.tsx`)
- Modal form with fields:
  - name (text input)
  - description (textarea)
  - start_date (date picker)
  - end_date (date picker)
  - location (text input)
- Validation: date range, required fields
- Submit handlers: create or update

### MemberManager (`components/travels/MemberManager.tsx`)
- Member list with role/permission tags
- Add member button (email search)
- Remove member button (organizer only)
- Permission toggle (organizer only)
- User avatar + name

### EventManager (`components/travels/EventManager.tsx`)
- Event list table (date, time, title, type, location, status)
- Event form modal:
  - title, event_type, event_date, event_time, location, description, details
- Event status (planned/completed/cancelled)

### CostManager (`components/travels/CostManager.tsx`)
- Cost list table (date, payer, title, amount, splits)
- Add cost button → form modal
- Cost form:
  - title, amount, currency, cost_type, payment_method, cost_date
  - Splits: select members, assign amounts
- Split calculator (equal split, custom amounts)

### SettlementTable (`components/travels/SettlementTable.tsx`)
- Fetch from `GET /api/travels/[id]/costs?endpoint=settlement`
- Display table: member | total_paid | share | balance
- Settlement summary: total cost, currency
- Visual indicators: green (owed), red (owes)
- Generate/download settlement report

### ChecklistManager (`components/travels/ChecklistManager.tsx`)
- List grouped by category
- Checkbox to toggle completed status
- Priority indicator
- Add item form (title, category, priority, notes)
- Delete button per item

### DocumentUploader (`components/travels/DocumentUploader.tsx`)
- Drag-drop or file select area
- File validation (size, type)
- Upload progress
- File list with metadata (name, size, type, uploaded_at)
- Download link
- Delete button

### NotificationSettings (`components/travels/NotificationSettings.tsx`)
- Rule list (notification_rules)
- Enable/disable toggle per rule
- Notification history (last 10 notifications)

### TabNavigation (`components/travels/TabNavigation.tsx`)
- Horizontal tab bar with 6 tabs
- Active tab indicator
- Responsive mobile version (collapsible)

---

## 🪝 Custom Hooks

### `useTravelData(travelId)`
```typescript
const {
  travel,         // Full travel with relations
  loading,        // boolean
  error,          // Error | null
  refetch,        // () => Promise<void>
  updateTravel,   // (data) => Promise<void>
  deleteTravel,   // () => Promise<void>
} = useTravelData(id);
```

**Implementation:**
- Fetch on mount using `GET /api/travels/[id]`
- Auto-refetch on route change
- Cached state with React Query or SWR
- Optimistic UI updates
- Real-time subscription (future: Supabase Realtime)

---

## 📊 State Management

**Option 1: React Context (Simple)**
- `TravelContext` with travel data
- `TravelProvider` at route level
- `useTravelContext()` hook in components

**Option 2: Zustand (Recommended)**
```typescript
// store/travelStore.ts
const useTravelStore = create((set) => ({
  travels: [],
  current: null,
  loading: false,
  setTravels: (travels) => set({ travels }),
  setCurrent: (travel) => set({ current: travel }),
  setLoading: (loading) => set({ loading }),
}));
```

**Option 3: React Query (Most Robust)**
- `useQuery()` for fetching
- `useMutation()` for create/update/delete
- Automatic caching and background refetch

---

## ✅ Implementation Sequence

**Day 1 (2026-05-15):** Pages + Core Components
- [ ] TravelList page
- [ ] TravelCard component
- [ ] TravelDetail page shell (tabs)
- [ ] useTravelData hook

**Day 2-3 (2026-05-16~17):** Tab Content
- [ ] Overview tab (member list, details)
- [ ] Schedule tab (events list + form)
- [ ] Costs tab (cost list + settlement)

**Day 4 (2026-05-18):** More Tab Content
- [ ] Checklist tab (list + form)
- [ ] Documents tab (uploader + list)
- [ ] Notifications tab (settings + history)

**Day 5-6 (2026-05-19~20):** Polish & Styling
- [ ] Responsive mobile design
- [ ] Loading/error states
- [ ] Form validation & error messages
- [ ] Animations/transitions

**Day 7 (2026-05-21):** Integration & Testing
- [ ] API integration testing
- [ ] Real-time subscription setup
- [ ] E2E test scenarios
- [ ] Bug fixes

---

## 🎨 Design Notes

- **Colors:** Use DSC FMS existing design tokens
- **Typography:** 16px base, 14px secondary, 20px headers
- **Spacing:** 4px base unit (4, 8, 12, 16, 24, 32)
- **Responsive:** Mobile (320px), Tablet (768px), Desktop (1024px+)
- **Icons:** Lucide React or Tabler Icons
- **Forms:** React Hook Form + Zod validation
- **Modals:** Radix Dialog or Headless UI

---

## 🔗 API Integration Checklist

- [x] Travel CRUD
- [x] Member management
- [x] Event management
- [x] Cost management
- [x] Settlement calculation
- [x] Checklist management
- [x] Document upload/download
- [x] Notification management

---

## ⚡ Performance Targets

- TravelList page: < 2s load time
- TravelDetail: < 1s load for cached travel
- Image optimization: lazy load documents
- Bundle size: monitor with next/bundle-analyze
- Lighthouse target: 90+ (Performance)

---

**Prepared by:** Subagent  
**Next Step:** Implement TravelList page and components  
**Est. Completion:** 2026-05-27
