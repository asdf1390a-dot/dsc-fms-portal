-- Discord Bot Phase 1 — Telegram ↔ Discord 양방향 동기화
-- Scope: DISCORD-BOT-P1 (2026-05-22 ~ 2026-06-02)
-- See: DISCORD_BOT_PHASE1_DESIGN.md, DISCORD_BOT_PHASE1_IMPLEMENTATION_GUIDE.md
-- Applied after: 33_audit_system_phase1.sql

-- ============================================================
-- discord_configs: OAuth credentials, guild/channel mappings (per owner)
-- ============================================================
create table if not exists public.discord_configs (
  config_id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,

  guild_id text not null,
  application_id text,
  public_key text,

  oauth_access_token text,
  oauth_refresh_token text,
  oauth_expires_at timestamptz,
  oauth_scopes text[],

  -- Channel routing (semantic name -> Discord channel snowflake)
  channel_general text,
  channel_in_progress text,
  channel_completed text,
  channel_blocker text,
  channel_team_discuss text,

  telegram_chat_id text,
  telegram_thread_id text,

  enabled boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(owner_id, guild_id)
);

create index if not exists discord_configs_owner_idx on public.discord_configs(owner_id);
create index if not exists discord_configs_guild_idx on public.discord_configs(guild_id);
create index if not exists discord_configs_enabled_idx on public.discord_configs(enabled) where enabled = true;

-- ============================================================
-- discord_sync_logs: every sync transaction (telegram<->discord<->ctb)
-- ============================================================
create table if not exists public.discord_sync_logs (
  log_id bigserial primary key,
  owner_id uuid references auth.users(id) on delete set null,

  source_platform text not null
    check (source_platform in ('telegram', 'discord', 'ctb', 'manual')),
  source_msg_id text,
  source_channel_id text,
  source_user_id text,

  target_platform text not null
    check (target_platform in ('telegram', 'discord')),
  target_msg_id text,
  target_channel_id text,

  content_hash text,
  content_preview text,

  sync_status text not null default 'pending'
    check (sync_status in ('pending', 'success', 'fallback', 'error', 'duplicate', 'skipped')),
  error_message text,
  retry_count integer not null default 0,

  latency_ms integer,
  created_at timestamptz not null default now(),
  synced_at timestamptz
);

create index if not exists discord_sync_logs_owner_idx on public.discord_sync_logs(owner_id);
create index if not exists discord_sync_logs_hash_idx on public.discord_sync_logs(content_hash);
create index if not exists discord_sync_logs_created_idx on public.discord_sync_logs(created_at desc);
create index if not exists discord_sync_logs_status_idx on public.discord_sync_logs(sync_status);
create unique index if not exists discord_sync_logs_dedup_idx
  on public.discord_sync_logs(content_hash, target_platform)
  where content_hash is not null and sync_status in ('success', 'pending');

-- ============================================================
-- discord_message_maps: Discord <-> Telegram message id mapping (for edit/delete)
-- ============================================================
create table if not exists public.discord_message_maps (
  map_id bigserial primary key,
  owner_id uuid references auth.users(id) on delete set null,

  discord_msg_id text,
  discord_channel_id text,
  telegram_msg_id text,
  telegram_chat_id text,

  author_platform text not null check (author_platform in ('telegram', 'discord', 'ctb')),
  author_user_id text,
  author_display_name text,

  content text,
  is_command boolean not null default false,
  is_deleted boolean not null default false,

  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz,

  -- One of the two ids must be present; both should match the same logical message
  constraint discord_message_maps_has_id check (discord_msg_id is not null or telegram_msg_id is not null)
);

create unique index if not exists discord_message_maps_discord_idx
  on public.discord_message_maps(discord_msg_id) where discord_msg_id is not null;
create unique index if not exists discord_message_maps_telegram_idx
  on public.discord_message_maps(telegram_msg_id) where telegram_msg_id is not null;
create index if not exists discord_message_maps_owner_idx on public.discord_message_maps(owner_id);
create index if not exists discord_message_maps_created_idx on public.discord_message_maps(created_at desc);

-- ============================================================
-- discord_channel_settings: per-channel config (language, filters, routing rules)
-- ============================================================
create table if not exists public.discord_channel_settings (
  setting_id uuid primary key default gen_random_uuid(),
  config_id uuid not null references public.discord_configs(config_id) on delete cascade,

  channel_id text not null,
  channel_name text,
  channel_role text not null default 'general'
    check (channel_role in ('general', 'in_progress', 'completed', 'blocker', 'team_discuss', 'custom')),

  language text default 'ko',
  -- regex/substring filters; messages matching these get skipped during sync
  ignore_patterns text[] default '{}',
  -- mirror direction: 'both' | 'to_telegram' | 'to_discord' | 'none'
  mirror_direction text not null default 'both'
    check (mirror_direction in ('both', 'to_telegram', 'to_discord', 'none')),

  rate_limit_per_min integer not null default 30,
  enabled boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(config_id, channel_id)
);

create index if not exists discord_channel_settings_config_idx on public.discord_channel_settings(config_id);
create index if not exists discord_channel_settings_role_idx on public.discord_channel_settings(channel_role);

-- ============================================================
-- updated_at trigger
-- ============================================================
create or replace function public.discord_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_discord_configs_updated_at on public.discord_configs;
create trigger trg_discord_configs_updated_at before update on public.discord_configs
  for each row execute function public.discord_set_updated_at();

drop trigger if exists trg_discord_channel_settings_updated_at on public.discord_channel_settings;
create trigger trg_discord_channel_settings_updated_at before update on public.discord_channel_settings
  for each row execute function public.discord_set_updated_at();

-- ============================================================
-- RLS policies — owner-scoped
-- ============================================================
alter table public.discord_configs enable row level security;
alter table public.discord_sync_logs enable row level security;
alter table public.discord_message_maps enable row level security;
alter table public.discord_channel_settings enable row level security;

drop policy if exists "discord_configs_owner_rw" on public.discord_configs;
create policy "discord_configs_owner_rw" on public.discord_configs
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "discord_sync_logs_owner_rw" on public.discord_sync_logs;
create policy "discord_sync_logs_owner_rw" on public.discord_sync_logs
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "discord_message_maps_owner_rw" on public.discord_message_maps;
create policy "discord_message_maps_owner_rw" on public.discord_message_maps
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "discord_channel_settings_via_config" on public.discord_channel_settings;
create policy "discord_channel_settings_via_config" on public.discord_channel_settings
  for all using (
    exists (select 1 from public.discord_configs c
            where c.config_id = discord_channel_settings.config_id
              and c.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.discord_configs c
            where c.config_id = discord_channel_settings.config_id
              and c.owner_id = auth.uid())
  );

-- ============================================================
-- Daily metrics view (Phase 1 monitoring)
-- ============================================================
create or replace view public.discord_metrics_daily as
select
  date_trunc('day', created_at)::date as day,
  source_platform,
  target_platform,
  sync_status,
  count(*) as message_count,
  avg(latency_ms)::int as avg_latency_ms,
  max(latency_ms) as max_latency_ms
from public.discord_sync_logs
group by 1, 2, 3, 4
order by 1 desc;

comment on table public.discord_configs is 'Phase 1 — OAuth credentials and channel routing per owner';
comment on table public.discord_sync_logs is 'Phase 1 — Every sync attempt between Telegram, Discord, CTB';
comment on table public.discord_message_maps is 'Phase 1 — Cross-platform message id map (for edit/delete propagation)';
comment on table public.discord_channel_settings is 'Phase 1 — Per-channel routing, filters, rate limits';
