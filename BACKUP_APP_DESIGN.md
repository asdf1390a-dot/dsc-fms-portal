# Backup App — Phase 1 Implementation

## Overview

The Backup Manager is a L4-level app integrated into JEEPNEY Personal Portal's "개인이력" section. It manages daily automatic backups of agent state and environment configurations.

## Architecture

### Database Schema (22_backup_module.sql)

**backups** — Main backup records
- `id` (uuid): Primary key
- `user_id` (uuid): Owner reference (auth.users)
- `name` (text): Backup display name
- `backup_type` (text): 'agent_state', 'environment', 'full'
- `status` (text): 'pending', 'in_progress', 'completed', 'failed'
- `size_bytes` (bigint): Total backup size
- `file_count` (int): Number of files in backup
- `created_at` (timestamptz): Creation timestamp
- `completed_at` (timestamptz): Completion timestamp
- `storage_path` (text): Path in Supabase Storage (`backups/{user_id}/{backup_id}/`)
- `metadata` (jsonb): Structured metadata {agents: [...], env_vars: [...], tags: [...]}
- `notes` (text): User notes or automation log

**backup_files** — Individual files within a backup
- `id` (uuid): Primary key
- `backup_id` (uuid): References backups (cascade delete)
- `file_path` (text): Relative path in backup (e.g., `agents/agent-1.json`)
- `file_type` (text): 'json', 'log', 'config', 'script', etc.
- `file_size` (bigint): Size in bytes
- `storage_url` (text): Full Supabase Storage URL
- `checksum` (text): SHA256 hash for integrity
- `created_at` (timestamptz): File added timestamp

**RLS** — Row-level security enabled
- Users can only view/delete their own backups
- backup_files inherit access from parent backup

### Frontend (pages/jeepney-personal/backup-app/index.js)

**Components:**
- `BackupApp` — Main page with list view
- `BackupDetailModal` — Detailed backup information

**Features:**
- List view with cards (latest-first by default)
- Sortable by creation date (latest/oldest)
- Status badges (completed/in_progress/pending/failed)
- Metadata display (size, file count, backup type)
- Detail modal with:
  - Full metadata table
  - User notes
  - Download button (Phase 2)
  - Restore button (Phase 2)
  - Delete button (Phase 2)

**UI Library Used:**
- Button (primary/secondary/danger variants)
- Card (hoverable)
- Badge (success/warning/error/info variants)
- Modal (lg size)
- Design tokens (colors, spacing, typography)

### API Routes (/pages/api/backup/)

**list.js** — GET /api/backup/list
- Returns all backups for authenticated user
- Sorted by created_at (descending)
- Required auth: Bearer token

**create.js** — POST /api/backup/create
- Creates new backup record
- Requires: `name` (string)
- Optional: `backup_type`, `status`, `size_bytes`, `file_count`, `storage_path`, `metadata`, `notes`
- Returns: created backup object

**[id].js** — GET/DELETE /api/backup/[id]
- GET: Retrieve single backup with files
- DELETE: Remove backup (ownership verified)
- Returns 404 if not found or unauthorized

**update.js** — PUT /api/backup/update?id=<id>
- Updates backup metadata
- Updatable fields: `status`, `size_bytes`, `file_count`, `completed_at`, `metadata`, `notes`
- Returns: updated backup object

**files.js** — GET/POST /api/backup/files?backup_id=<id>
- GET: List all files in backup
- POST: Add file to backup
- Requires: `file_path` (string for POST)
- Optional: `file_type`, `file_size`, `storage_url`, `checksum`

## Authentication

Uses existing `career-auth` pattern:
- Bearer token in Authorization header
- Extracted and validated via Supabase admin client
- User ID enforced in all queries

## Phase 2 Planned Features

1. **Download Functionality**
   - Generate ZIP from backup_files
   - Stream to browser with appropriate headers

2. **Restore Logic**
   - Copy agent state from backup
   - Restore environment variables
   - Verification and integrity checks

3. **Automated Backups**
   - Scheduled cron job
   - Webhook trigger on agent changes
   - Cleanup old backups (retention policy)

4. **Storage Integration**
   - Upload files to Supabase Storage
   - S3 bucket integration option
   - Compression (gzip, zip)

5. **Advanced Metadata**
   - Agent version snapshot
   - Environment hash for change detection
   - Rollback graph visualization

## Usage Example

### Creating a backup via API

```javascript
const response = await fetch('/api/backup/create', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${userToken}`,
  },
  body: JSON.stringify({
    name: 'Daily Backup 2026-05-13',
    backup_type: 'agent_state',
    status: 'in_progress',
    metadata: {
      agents: ['agent-1', 'agent-2'],
      env_vars: ['API_KEY', 'DB_URL'],
      tags: ['daily', 'production'],
    },
  }),
});

const { backup } = await response.json();
// backup.id is now available for adding files
```

### Adding files to backup

```javascript
const fileResponse = await fetch('/api/backup/files?backup_id=' + backup.id, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${userToken}`,
  },
  body: JSON.stringify({
    file_path: 'agents/agent-1.json',
    file_type: 'json',
    file_size: 2048,
    checksum: 'sha256-abc123...',
  }),
});
```

### Completing backup

```javascript
await fetch('/api/backup/update?id=' + backup.id, {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${userToken}`,
  },
  body: JSON.stringify({
    status: 'completed',
    completed_at: new Date().toISOString(),
  }),
});
```

## File Structure

```
dsc-fms-portal/
├── db/
│   └── 22_backup_module.sql           # Database schema
├── pages/
│   ├── api/backup/
│   │   ├── list.js                    # List backups
│   │   ├── create.js                  # Create backup
│   │   ├── [id].js                    # Get/delete single backup
│   │   ├── update.js                  # Update backup metadata
│   │   └── files.js                   # Manage backup files
│   └── jeepney-personal/
│       ├── backup-app/
│       │   └── index.js               # Backup list & detail modal
│       └── index.js                   # Updated with backup link
└── BACKUP_APP_DESIGN.md               # This file
```

## Testing Checklist (Phase 1)

- [ ] Database migration applied successfully
- [ ] Backup list page loads without errors
- [ ] API /list returns empty array initially
- [ ] API /create accepts valid backup payload
- [ ] Created backups appear in list
- [ ] Sort by latest/oldest works
- [ ] Detail modal opens on card click
- [ ] Metadata displayed correctly
- [ ] Status badges render correctly
- [ ] RLS prevents access to other users' backups
- [ ] Delete API removes backup
- [ ] Files API adds/lists files correctly

## Future Improvements

1. **Performance**: Add pagination to list view
2. **Search**: Filter backups by name, date range, type
3. **Export**: Download backup list as CSV
4. **Compression**: Gzip backup files before storage
5. **Verification**: Automated integrity checks
6. **Retention**: Auto-delete backups older than N days
7. **Notifications**: Alert on backup completion/failure
8. **Metrics**: Storage usage dashboard
