-- Backup Module — agents and environment backups
-- L4: 개인이력 > 백업 관리

-- backups: daily backup records for agents
create table if not exists backups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),

  -- Identity
  name text not null,                    -- Backup name (e.g., "Agent State 2026-05-13")
  backup_type text not null default 'agent_state',  -- agent_state, environment, full
  status text not null default 'completed'
    check (status in ('pending', 'in_progress', 'completed', 'failed')),

  -- Metadata
  size_bytes bigint,                     -- Backup size in bytes
  file_count int default 0,              -- Number of files in backup
  created_at timestamptz not null default now(),
  completed_at timestamptz,              -- When backup finished

  -- Storage reference
  storage_path text,                     -- Path in Supabase Storage: backups/{user_id}/{backup_id}/

  -- Restoration metadata
  metadata jsonb default '{}'::jsonb,    -- Additional metadata: {agents: [...], env_vars: [...], tags: [...]}

  -- Audit
  created_by uuid references auth.users(id),
  notes text                             -- User notes or automation log
);

create index if not exists backups_user_id_idx on backups(user_id);
create index if not exists backups_created_at_idx on backups(created_at desc);
create index if not exists backups_status_idx on backups(status);

-- backup_files: individual files within a backup
create table if not exists backup_files (
  id uuid primary key default gen_random_uuid(),
  backup_id uuid not null references backups(id) on delete cascade,

  file_path text not null,               -- Relative path in backup (e.g., agents/agent-1.json)
  file_type text,                        -- json, log, config, script, etc.
  file_size bigint,                      -- Size in bytes

  -- Storage
  storage_url text,                      -- Full Supabase Storage URL

  -- Checksum for integrity
  checksum text,                         -- SHA256 hash

  created_at timestamptz not null default now()
);

create index if not exists backup_files_backup_id_idx on backup_files(backup_id);
create index if not exists backup_files_file_type_idx on backup_files(file_type);

-- Enable RLS
alter table backups enable row level security;
alter table backup_files enable row level security;

-- RLS: backups — users can only see their own
create policy "backups_own" on backups
  for all using (auth.uid() = user_id);

-- RLS: backup_files — inherit from parent backup
create policy "backup_files_own" on backup_files
  for all using (
    backup_id in (
      select id from backups where user_id = auth.uid()
    )
  );
