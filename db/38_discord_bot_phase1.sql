-- Migration: Discord Bot Phase 1
-- Date: 2026-06-09
-- Purpose: Telegram <-> Discord bilateral sync + CTB updates + task queue
-- Run in Supabase SQL Editor.

-- 1. Sync log: every message sync attempt across platforms
CREATE TABLE IF NOT EXISTS discord_sync_log (
  id              SERIAL PRIMARY KEY,
  source_platform TEXT NOT NULL CHECK (source_platform IN ('telegram', 'discord', 'ctb')),
  source_msg_id   BIGINT,
  target_platform TEXT NOT NULL CHECK (target_platform IN ('telegram', 'discord')),
  target_msg_id   BIGINT,
  content_hash    TEXT,
  sync_status     TEXT NOT NULL DEFAULT 'pending'
                  CHECK (sync_status IN ('success', 'fallback', 'error', 'duplicate', 'pending')),
  error_msg       TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  synced_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sync_log_source  ON discord_sync_log (source_msg_id);
CREATE INDEX IF NOT EXISTS idx_sync_log_hash    ON discord_sync_log (content_hash);
CREATE INDEX IF NOT EXISTS idx_sync_log_created ON discord_sync_log (created_at DESC);

-- 2. Discord messages: raw inbound message archive
CREATE TABLE IF NOT EXISTS discord_messages (
  id                  SERIAL PRIMARY KEY,
  discord_msg_id      BIGINT UNIQUE NOT NULL,
  user_id             BIGINT NOT NULL,
  user_name           TEXT NOT NULL,
  channel_id          BIGINT NOT NULL,
  channel_name        TEXT,
  content             TEXT,
  is_command          BOOLEAN DEFAULT FALSE,
  synced_to_telegram  BOOLEAN DEFAULT FALSE,
  telegram_msg_id     BIGINT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_discord_msg_user    ON discord_messages (user_id);
CREATE INDEX IF NOT EXISTS idx_discord_msg_channel ON discord_messages (channel_id);

-- 3. Task queue: /task @assign generated tasks
CREATE TABLE IF NOT EXISTS discord_task_queue (
  id               SERIAL PRIMARY KEY,
  task_id          UUID,
  assigned_to      TEXT NOT NULL,
  task_description TEXT NOT NULL CHECK (LENGTH(task_description) BETWEEN 5 AND 500),
  priority         TEXT DEFAULT 'P1' CHECK (priority IN ('P0', 'P1', 'P2')),
  deadline         TIMESTAMPTZ,
  platform_origin  TEXT NOT NULL CHECK (platform_origin IN ('discord', 'telegram')),
  status           TEXT DEFAULT 'pending'
                   CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  completed_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_task_queue_assigned ON discord_task_queue (assigned_to);
CREATE INDEX IF NOT EXISTS idx_task_queue_status   ON discord_task_queue (status);

-- 4. Notifications log for both platforms
CREATE TABLE IF NOT EXISTS discord_notifications (
  id           SERIAL PRIMARY KEY,
  user_id      BIGINT,
  notify_type  TEXT NOT NULL
               CHECK (notify_type IN ('task_assigned', 'ctb_update', 'blocker_alert', 'sync_error')),
  content      TEXT NOT NULL,
  platform     TEXT NOT NULL CHECK (platform IN ('discord', 'telegram', 'both')),
  is_read      BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  read_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notifications_user    ON discord_notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON discord_notifications (created_at DESC);

-- RLS: service_role only (bot writes via service key; portal admin can read)
ALTER TABLE discord_sync_log      ENABLE ROW LEVEL SECURITY;
ALTER TABLE discord_messages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE discord_task_queue    ENABLE ROW LEVEL SECURITY;
ALTER TABLE discord_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth read sync_log"      ON discord_sync_log;
DROP POLICY IF EXISTS "auth read messages"      ON discord_messages;
DROP POLICY IF EXISTS "auth read task_queue"    ON discord_task_queue;
DROP POLICY IF EXISTS "auth read notifications" ON discord_notifications;

CREATE POLICY "auth read sync_log"      ON discord_sync_log      FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth read messages"      ON discord_messages      FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth read task_queue"    ON discord_task_queue    FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth read notifications" ON discord_notifications FOR SELECT TO authenticated USING (true);
