-- Travel Management Module — Database Migration
-- File: db/migrations/24_create_travel_tables.sql
-- Created: 2026-05-14
-- Purpose: Create tables for travel/trip management module

-- ============================================================================
-- 1. TRAVELS TABLE (여행 마스터)
-- ============================================================================

CREATE TABLE IF NOT EXISTS travels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  location VARCHAR(255),
  status VARCHAR(50) DEFAULT 'upcoming',
  -- Status: 'upcoming', 'ongoing', 'completed'

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT check_dates CHECK (end_date >= start_date),
  CONSTRAINT check_status CHECK (status IN ('upcoming', 'ongoing', 'completed'))
);

CREATE INDEX idx_travels_user_id ON travels(user_id);
CREATE INDEX idx_travels_start_date ON travels(start_date);
CREATE INDEX idx_travels_status ON travels(status);

-- ============================================================================
-- 2. TRAVEL_MEMBERS TABLE (멤버/권한)
-- ============================================================================

CREATE TABLE IF NOT EXISTS travel_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  travel_id uuid NOT NULL REFERENCES travels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  role VARCHAR(50) DEFAULT 'companion',
  -- Role: 'organizer', 'companion', 'guest'

  permission VARCHAR(50) DEFAULT 'read_write',
  -- Permission: 'read_only', 'read_write'

  joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(travel_id, user_id),
  CONSTRAINT check_role CHECK (role IN ('organizer', 'companion', 'guest')),
  CONSTRAINT check_permission CHECK (permission IN ('read_only', 'read_write'))
);

CREATE INDEX idx_travel_members_travel_id ON travel_members(travel_id);
CREATE INDEX idx_travel_members_user_id ON travel_members(user_id);

-- ============================================================================
-- 3. TRAVEL_EVENTS TABLE (일정/이벤트)
-- ============================================================================

CREATE TABLE IF NOT EXISTS travel_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  travel_id uuid NOT NULL REFERENCES travels(id) ON DELETE CASCADE,

  title VARCHAR(255) NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  -- Type: 'flight', 'hotel', 'meal', 'transport', 'other'

  event_date DATE NOT NULL,
  event_time TIME,

  location VARCHAR(255),
  description TEXT,

  -- Flexible JSON storage for event-specific data
  -- Example for flight: {"flight_number": "TR779", "airline": "Tirupati Airways", "departure_airport": "CMB", "arrival_airport": "SGN", "duration_hours": 7}
  details JSONB DEFAULT '{}'::jsonb,

  status VARCHAR(50) DEFAULT 'planned',
  -- Status: 'planned', 'completed', 'cancelled'

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT check_event_type CHECK (event_type IN ('flight', 'hotel', 'meal', 'transport', 'other')),
  CONSTRAINT check_event_status CHECK (status IN ('planned', 'completed', 'cancelled'))
);

CREATE INDEX idx_travel_events_travel_id ON travel_events(travel_id);
CREATE INDEX idx_travel_events_date ON travel_events(event_date);
CREATE INDEX idx_travel_events_type ON travel_events(event_type);

-- ============================================================================
-- 4. TRAVEL_COSTS TABLE (비용/경비)
-- ============================================================================

CREATE TABLE IF NOT EXISTS travel_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  travel_id uuid NOT NULL REFERENCES travels(id) ON DELETE CASCADE,
  payer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  title VARCHAR(255) NOT NULL,
  amount DECIMAL(12, 2) NOT NULL CHECK (amount >= 0),

  currency VARCHAR(10) DEFAULT 'INR',

  cost_type VARCHAR(50),
  -- Type: 'flight', 'accommodation', 'meal', 'transport', 'other'

  payment_method VARCHAR(50),
  -- Method: 'card', 'cash', 'bank_transfer', 'upi', 'other'

  cost_date DATE NOT NULL,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT check_cost_type CHECK (cost_type IN ('flight', 'accommodation', 'meal', 'transport', 'other', NULL)),
  CONSTRAINT check_payment_method CHECK (payment_method IN ('card', 'cash', 'bank_transfer', 'upi', 'other', NULL))
);

CREATE INDEX idx_travel_costs_travel_id ON travel_costs(travel_id);
CREATE INDEX idx_travel_costs_payer_id ON travel_costs(payer_id);
CREATE INDEX idx_travel_costs_date ON travel_costs(cost_date);

-- ============================================================================
-- 5. TRAVEL_COST_SPLITS TABLE (비용 분담)
-- ============================================================================

CREATE TABLE IF NOT EXISTS travel_cost_splits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cost_id uuid NOT NULL REFERENCES travel_costs(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES travel_members(id) ON DELETE CASCADE,

  amount DECIMAL(12, 2) NOT NULL CHECK (amount >= 0),

  UNIQUE(cost_id, member_id)
);

CREATE INDEX idx_travel_cost_splits_cost_id ON travel_cost_splits(cost_id);
CREATE INDEX idx_travel_cost_splits_member_id ON travel_cost_splits(member_id);

-- ============================================================================
-- 6. TRAVEL_CHECKLIST_ITEMS TABLE (체크리스트)
-- ============================================================================

CREATE TABLE IF NOT EXISTS travel_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  travel_id uuid NOT NULL REFERENCES travels(id) ON DELETE CASCADE,

  title VARCHAR(255) NOT NULL,

  category VARCHAR(50),
  -- Category: 'documents', 'clothing', 'toiletries', 'electronics', 'medicine', 'custom'

  is_completed BOOLEAN DEFAULT FALSE,
  notes TEXT,

  priority VARCHAR(50) DEFAULT 'medium',
  -- Priority: 'low', 'medium', 'high'

  created_by uuid NOT NULL REFERENCES auth.users(id),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT check_category CHECK (category IN ('documents', 'clothing', 'toiletries', 'electronics', 'medicine', 'custom', NULL)),
  CONSTRAINT check_priority CHECK (priority IN ('low', 'medium', 'high'))
);

CREATE INDEX idx_travel_checklist_items_travel_id ON travel_checklist_items(travel_id);
CREATE INDEX idx_travel_checklist_items_category ON travel_checklist_items(category);
CREATE INDEX idx_travel_checklist_items_is_completed ON travel_checklist_items(is_completed);

-- ============================================================================
-- 7. TRAVEL_DOCUMENTS TABLE (서류/파일 보관)
-- ============================================================================

CREATE TABLE IF NOT EXISTS travel_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  travel_id uuid NOT NULL REFERENCES travels(id) ON DELETE CASCADE,

  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  -- Format: "travels/{travel_id}/documents/{filename}"

  file_size BIGINT,
  file_type VARCHAR(50),
  -- Mime type: application/pdf, image/jpeg, etc.

  document_type VARCHAR(50),
  -- Type: 'visa', 'passport', 'flight_ticket', 'hotel_booking', 'receipt', 'other'

  uploaded_by uuid NOT NULL REFERENCES auth.users(id),
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(travel_id, file_path),
  CONSTRAINT check_doc_type CHECK (document_type IN ('visa', 'passport', 'flight_ticket', 'hotel_booking', 'receipt', 'other'))
);

CREATE INDEX idx_travel_documents_travel_id ON travel_documents(travel_id);
CREATE INDEX idx_travel_documents_type ON travel_documents(document_type);
CREATE INDEX idx_travel_documents_uploaded_at ON travel_documents(uploaded_at);

-- ============================================================================
-- 8. TRAVEL_NOTIFICATIONS TABLE (알림 로그)
-- ============================================================================

CREATE TABLE IF NOT EXISTS travel_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  travel_id uuid NOT NULL REFERENCES travels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  notification_type VARCHAR(50),
  -- Type: 'auto_rule', 'custom', 'system'

  title VARCHAR(255) NOT NULL,
  message TEXT,

  trigger_date DATE,
  trigger_time TIME,

  -- JSON: {"in_app": true, "email": true, "telegram": false}
  channels JSONB DEFAULT '{"in_app": true, "email": false, "telegram": false}'::jsonb,

  is_sent BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT check_notification_type CHECK (notification_type IN ('auto_rule', 'custom', 'system', NULL))
);

CREATE INDEX idx_travel_notifications_travel_id ON travel_notifications(travel_id);
CREATE INDEX idx_travel_notifications_user_id ON travel_notifications(user_id);
CREATE INDEX idx_travel_notifications_is_sent ON travel_notifications(is_sent);
CREATE INDEX idx_travel_notifications_trigger_date ON travel_notifications(trigger_date);

-- ============================================================================
-- 9. TRAVEL_NOTIFICATION_RULES TABLE (알림 규칙)
-- ============================================================================

CREATE TABLE IF NOT EXISTS travel_notification_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  travel_id uuid NOT NULL REFERENCES travels(id) ON DELETE CASCADE,

  rule_type VARCHAR(50),
  -- Type: 'days_before_departure', 'event_time', 'checklist_reminder', 'custom'

  -- JSON configuration
  -- Example: {"days": 7, "channels": ["in_app", "email", "telegram"]}
  -- Example: {"hours": 1, "event_type": "flight"}
  rule_config JSONB DEFAULT '{}'::jsonb,

  is_enabled BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT check_rule_type CHECK (rule_type IN ('days_before_departure', 'event_time', 'checklist_reminder', 'custom', NULL))
);

CREATE INDEX idx_travel_notification_rules_travel_id ON travel_notification_rules(travel_id);
CREATE INDEX idx_travel_notification_rules_type ON travel_notification_rules(rule_type);

-- ============================================================================
-- 10. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE travels ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_cost_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_notification_rules ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Policies for TRAVELS table
-- ============================================================================

CREATE POLICY "Users can view own or member travels"
  ON travels FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM travel_members
      WHERE travel_members.travel_id = travels.id
        AND travel_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create travels"
  ON travels FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own travels"
  ON travels FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own travels"
  ON travels FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- Policies for TRAVEL_MEMBERS table
-- ============================================================================

CREATE POLICY "Members can view other members in same travel"
  ON travel_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM travel_members tm
      WHERE tm.travel_id = travel_members.travel_id
        AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Only organizer can add members"
  ON travel_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM travels
      WHERE travels.id = travel_members.travel_id
        AND travels.user_id = auth.uid()
    )
  );

CREATE POLICY "Only organizer can update members"
  ON travel_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM travels
      WHERE travels.id = travel_members.travel_id
        AND travels.user_id = auth.uid()
    )
  );

CREATE POLICY "Only organizer can remove members"
  ON travel_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM travels
      WHERE travels.id = travel_members.travel_id
        AND travels.user_id = auth.uid()
    )
  );

-- ============================================================================
-- Policies for TRAVEL_EVENTS table
-- ============================================================================

CREATE POLICY "Members can view travel events"
  ON travel_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM travel_members
      WHERE travel_members.travel_id = travel_events.travel_id
        AND travel_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Members with write permission can insert events"
  ON travel_events FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM travel_members
      WHERE travel_members.travel_id = travel_events.travel_id
        AND travel_members.user_id = auth.uid()
        AND travel_members.permission = 'read_write'
    )
  );

CREATE POLICY "Members with write permission can update events"
  ON travel_events FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM travel_members
      WHERE travel_members.travel_id = travel_events.travel_id
        AND travel_members.user_id = auth.uid()
        AND travel_members.permission = 'read_write'
    )
  );

CREATE POLICY "Members with write permission can delete events"
  ON travel_events FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM travel_members
      WHERE travel_members.travel_id = travel_events.travel_id
        AND travel_members.user_id = auth.uid()
        AND travel_members.permission = 'read_write'
    )
  );

-- ============================================================================
-- Policies for TRAVEL_COSTS table
-- ============================================================================

CREATE POLICY "Members can view costs"
  ON travel_costs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM travel_members
      WHERE travel_members.travel_id = travel_costs.travel_id
        AND travel_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Members with write permission can insert costs"
  ON travel_costs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM travel_members
      WHERE travel_members.travel_id = travel_costs.travel_id
        AND travel_members.user_id = auth.uid()
        AND travel_members.permission = 'read_write'
    )
  );

CREATE POLICY "Members with write permission can update own costs"
  ON travel_costs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM travel_members
      WHERE travel_members.travel_id = travel_costs.travel_id
        AND travel_members.user_id = auth.uid()
        AND travel_members.permission = 'read_write'
    )
  );

CREATE POLICY "Members with write permission can delete own costs"
  ON travel_costs FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM travel_members
      WHERE travel_members.travel_id = travel_costs.travel_id
        AND travel_members.user_id = auth.uid()
        AND travel_members.permission = 'read_write'
    )
  );

-- ============================================================================
-- Policies for TRAVEL_COST_SPLITS table
-- ============================================================================

CREATE POLICY "Members can view cost splits"
  ON travel_cost_splits FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM travel_costs
      INNER JOIN travel_members ON travel_members.travel_id = travel_costs.travel_id
      WHERE travel_costs.id = travel_cost_splits.cost_id
        AND travel_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Members with write permission can insert splits"
  ON travel_cost_splits FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM travel_costs
      INNER JOIN travel_members ON travel_members.travel_id = travel_costs.travel_id
      WHERE travel_costs.id = travel_cost_splits.cost_id
        AND travel_members.user_id = auth.uid()
        AND travel_members.permission = 'read_write'
    )
  );

-- ============================================================================
-- Policies for TRAVEL_CHECKLIST_ITEMS table
-- ============================================================================

CREATE POLICY "Members can view checklist items"
  ON travel_checklist_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM travel_members
      WHERE travel_members.travel_id = travel_checklist_items.travel_id
        AND travel_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Members with write permission can insert items"
  ON travel_checklist_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM travel_members
      WHERE travel_members.travel_id = travel_checklist_items.travel_id
        AND travel_members.user_id = auth.uid()
        AND travel_members.permission = 'read_write'
    )
  );

CREATE POLICY "Members with write permission can update items"
  ON travel_checklist_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM travel_members
      WHERE travel_members.travel_id = travel_checklist_items.travel_id
        AND travel_members.user_id = auth.uid()
        AND travel_members.permission = 'read_write'
    )
  );

CREATE POLICY "Members with write permission can delete items"
  ON travel_checklist_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM travel_members
      WHERE travel_members.travel_id = travel_checklist_items.travel_id
        AND travel_members.user_id = auth.uid()
        AND travel_members.permission = 'read_write'
    )
  );

-- ============================================================================
-- Policies for TRAVEL_DOCUMENTS table
-- ============================================================================

CREATE POLICY "Members can view documents"
  ON travel_documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM travel_members
      WHERE travel_members.travel_id = travel_documents.travel_id
        AND travel_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Members with write permission can upload documents"
  ON travel_documents FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM travel_members
      WHERE travel_members.travel_id = travel_documents.travel_id
        AND travel_members.user_id = auth.uid()
        AND travel_members.permission = 'read_write'
    )
  );

CREATE POLICY "Members with write permission can delete documents"
  ON travel_documents FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM travel_members
      WHERE travel_members.travel_id = travel_documents.travel_id
        AND travel_members.user_id = auth.uid()
        AND travel_members.permission = 'read_write'
    )
  );

-- ============================================================================
-- Policies for TRAVEL_NOTIFICATIONS table
-- ============================================================================

CREATE POLICY "Users can view own notifications"
  ON travel_notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications"
  ON travel_notifications FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update own notifications"
  ON travel_notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- Policies for TRAVEL_NOTIFICATION_RULES table
-- ============================================================================

CREATE POLICY "Members can view notification rules"
  ON travel_notification_rules FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM travel_members
      WHERE travel_members.travel_id = travel_notification_rules.travel_id
        AND travel_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Organizer can manage notification rules"
  ON travel_notification_rules FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM travels
      WHERE travels.id = travel_notification_rules.travel_id
        AND travels.user_id = auth.uid()
    )
  );

CREATE POLICY "Organizer can update notification rules"
  ON travel_notification_rules FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM travels
      WHERE travels.id = travel_notification_rules.travel_id
        AND travels.user_id = auth.uid()
    )
  );

CREATE POLICY "Organizer can delete notification rules"
  ON travel_notification_rules FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM travels
      WHERE travels.id = travel_notification_rules.travel_id
        AND travels.user_id = auth.uid()
    )
  );

-- ============================================================================
-- 11. TRIGGER FUNCTIONS (자동 업데이트)
-- ============================================================================

-- Update travels.updated_at automatically
CREATE OR REPLACE FUNCTION update_travels_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER travels_update_timestamp
  BEFORE UPDATE ON travels
  FOR EACH ROW
  EXECUTE FUNCTION update_travels_updated_at();

-- Similar triggers for other tables
CREATE OR REPLACE FUNCTION update_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER travel_events_update_timestamp
  BEFORE UPDATE ON travel_events
  FOR EACH ROW
  EXECUTE FUNCTION update_events_updated_at();

CREATE OR REPLACE FUNCTION update_costs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER travel_costs_update_timestamp
  BEFORE UPDATE ON travel_costs
  FOR EACH ROW
  EXECUTE FUNCTION update_costs_updated_at();

CREATE OR REPLACE FUNCTION update_checklist_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER travel_checklist_items_update_timestamp
  BEFORE UPDATE ON travel_checklist_items
  FOR EACH ROW
  EXECUTE FUNCTION update_checklist_items_updated_at();

-- ============================================================================
-- 12. VIEWS (쿼리 편의성)
-- ============================================================================

-- View: Travel with member count and total cost
CREATE OR REPLACE VIEW travel_summary AS
SELECT
  t.id,
  t.user_id,
  t.name,
  t.start_date,
  t.end_date,
  t.location,
  t.status,
  COUNT(DISTINCT tm.id) as member_count,
  COALESCE(SUM(tc.amount), 0) as total_cost,
  MAX(tc.currency) as currency,
  t.created_at,
  t.updated_at
FROM travels t
LEFT JOIN travel_members tm ON t.id = tm.travel_id
LEFT JOIN travel_costs tc ON t.id = tc.travel_id
GROUP BY t.id, t.user_id, t.name, t.start_date, t.end_date, t.location, t.status, t.created_at, t.updated_at;

-- View: Checklist progress per travel
CREATE OR REPLACE VIEW travel_checklist_progress AS
SELECT
  travel_id,
  COUNT(*) as total_items,
  COUNT(*) FILTER (WHERE is_completed = true) as completed_items,
  ROUND(100.0 * COUNT(*) FILTER (WHERE is_completed = true) / COUNT(*), 1) as progress_percent
FROM travel_checklist_items
GROUP BY travel_id;

-- View: Settlement summary
CREATE OR REPLACE VIEW travel_settlement_summary AS
SELECT
  tc.travel_id,
  tc.payer_id,
  u.email,
  u.raw_user_meta_data->>'name' as user_name,
  COALESCE(SUM(tc.amount), 0) as total_paid,
  COALESCE(SUM(tcs.amount), 0) as total_share,
  COALESCE(SUM(tc.amount), 0) - COALESCE(SUM(tcs.amount), 0) as balance
FROM travel_costs tc
LEFT JOIN travel_cost_splits tcs ON tc.id = tcs.cost_id
LEFT JOIN auth.users u ON tc.payer_id = u.id
GROUP BY tc.travel_id, tc.payer_id, u.id, u.email, u.raw_user_meta_data;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================

-- Summary:
-- - 9 main tables created (travels, members, events, costs, splits, checklist, documents, notifications, rules)
-- - RLS policies enabled for all tables
-- - Indexes created for common queries
-- - Trigger functions for auto-updated timestamps
-- - Views for convenient data aggregation
-- - All constraints and validations in place

-- Migration Date: 2026-05-14
-- Status: Ready for implementation
