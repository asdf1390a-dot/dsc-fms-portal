-- 11_bm_missing_columns.sql
-- bm_events 보완 컬럼 추가 (Phase 1)
-- 기존 04_bm_module_v2.sql에 누락된 컬럼/제약 보강

-- ── 기본 누락 컬럼 ─────────────────────────────────────────────
alter table bm_events
  add column if not exists action_taken   text,
  add column if not exists cause          text,
  add column if not exists resolved_by    uuid references auth.users(id),
  add column if not exists resolver_name  text,
  add column if not exists reported_by    uuid references auth.users(id),
  add column if not exists reporter_name  text,
  add column if not exists symptom        text,
  add column if not exists symptom_ta     text,
  add column if not exists photos         text[] default '{}';

-- ── severity 컬럼 (신고 폼/[id].js에서 사용) ──────────────────
alter table bm_events
  add column if not exists severity text default 'normal';

-- severity CHECK 제약 (drop 후 재생성)
alter table bm_events drop constraint if exists bm_events_severity_check;
alter table bm_events
  add constraint bm_events_severity_check
    check (severity in ('minor','normal','major','line_down'));

-- ── downtime_minutes (generated column) ──────────────────────
-- resolved_at - reported_at 으로 자동 계산
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'bm_events' and column_name = 'downtime_minutes'
  ) then
    alter table bm_events
      add column downtime_minutes integer
        generated always as (
          case
            when resolved_at is not null and reported_at is not null
            then (extract(epoch from (resolved_at - reported_at))::integer / 60)
            else null
          end
        ) stored;
  end if;
end$$;

-- ── status 제약 갱신 (wontfix 허용) ───────────────────────────
alter table bm_events drop constraint if exists bm_events_status_check;
alter table bm_events
  add constraint bm_events_status_check
    check (status in ('open','in_progress','pending_parts','resolved','cancelled','wontfix'));

-- ── 인덱스 (집계용) ───────────────────────────────────────────
create index if not exists bm_events_severity_idx     on bm_events(severity);
create index if not exists bm_events_resolved_at_idx  on bm_events(resolved_at desc);
-- bm_events_reported_at_idx: 04_bm_module_v2.sql 에서 이미 생성됨 (중복 제거)
