-- ============================================================
-- DSC FMS Portal — Weekly Reports Email Notification Module
-- 파일: 26_weekly_reports_email.sql
-- 작성: 2026-05-15
-- 전제: 25_weekly_reports.sql 실행 완료
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. email_notifications — 이메일 알림 큐
-- ─────────────────────────────────────────────────────────────
create table if not exists email_notifications (
  id                uuid primary key default gen_random_uuid(),
  recipient         text not null,
  subject           text not null,
  template          text not null
    check (template in ('report_generated','report_reviewed','report_approved')),
  data              jsonb not null default '{}'::jsonb,
  status            text not null default 'pending'
    check (status in ('pending','sent','failed','skipped')),
  sent_at           timestamptz,
  error_msg         text,
  retry_count       int not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists email_notifications_status_idx
  on email_notifications(status);
create index if not exists email_notifications_created_idx
  on email_notifications(created_at desc);
create index if not exists email_notifications_recipient_idx
  on email_notifications(recipient);

comment on table email_notifications is
  '주간 보고서 이메일 알림 큐 — 생성, 검토, 승인 등 상태 변경시 큐에 추가';

-- ─────────────────────────────────────────────────────────────
-- 2. telegram_notifications — Telegram 알림 로그
-- ─────────────────────────────────────────────────────────────
create table if not exists telegram_notifications (
  id                uuid primary key default gen_random_uuid(),
  chat_id           text not null,
  message           text not null,
  report_id         uuid references weekly_reports(id) on delete set null,
  status            text not null default 'pending'
    check (status in ('pending','sent','failed')),
  sent_at           timestamptz,
  error_msg         text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists telegram_notifications_report_idx
  on telegram_notifications(report_id);
create index if not exists telegram_notifications_status_idx
  on telegram_notifications(status);

comment on table telegram_notifications is
  '주간 보고서 Telegram 알림 로그';

-- ─────────────────────────────────────────────────────────────
-- 3. 갱신 트리거
-- ─────────────────────────────────────────────────────────────
create or replace function email_notifications_touch_updated()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_email_notifications_updated on email_notifications;
create trigger trg_email_notifications_updated
  before update on email_notifications
  for each row execute function email_notifications_touch_updated();

drop trigger if exists trg_telegram_notifications_updated on telegram_notifications;
create trigger trg_telegram_notifications_updated
  before update on telegram_notifications
  for each row execute function email_notifications_touch_updated();

-- ─────────────────────────────────────────────────────────────
-- 4. RLS 정책
-- ─────────────────────────────────────────────────────────────
alter table email_notifications enable row level security;
alter table telegram_notifications enable row level security;

-- Admin: 모든 알림 조회/관리
create policy "admin_manage_email_notifications"
  on email_notifications for all
  using (auth.jwt() ->> 'role' = 'admin')
  with check (auth.jwt() ->> 'role' = 'admin');

-- Service role: Cron/API에서 알림 생성
create policy "service_insert_email_notifications"
  on email_notifications for insert
  with check (auth.jwt() ->> 'role' = 'service_role');

-- Service role: Telegram 알림 관리
create policy "service_manage_telegram_notifications"
  on telegram_notifications for all
  using (auth.jwt() ->> 'role' = 'service_role')
  with check (auth.jwt() ->> 'role' = 'service_role');

-- ─────────────────────────────────────────────────────────────
-- 5. 함수: 알림 발송 (이메일)
-- ─────────────────────────────────────────────────────────────
create or replace function queue_email_notification(
  p_recipient text,
  p_subject text,
  p_template text,
  p_data jsonb
)
returns uuid language plpgsql as $$
declare
  v_notification_id uuid;
begin
  insert into email_notifications (recipient, subject, template, data)
  values (p_recipient, p_subject, p_template, p_data)
  returning id into v_notification_id;

  return v_notification_id;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 6. 함수: 알림 발송 (Telegram)
-- ─────────────────────────────────────────────────────────────
create or replace function queue_telegram_notification(
  p_chat_id text,
  p_message text,
  p_report_id uuid default null
)
returns uuid language plpgsql as $$
declare
  v_notification_id uuid;
begin
  insert into telegram_notifications (chat_id, message, report_id)
  values (p_chat_id, p_message, p_report_id)
  returning id into v_notification_id;

  return v_notification_id;
end;
$$;
