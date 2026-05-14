#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function migrate() {
  try {
    console.log('📋 Migration Setup Instructions\n');
    console.log('================================\n');

    const migrationPath = path.join(__dirname, '..', 'db', '24_create_travel_tables.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');

    console.log('To execute this migration:\n');
    console.log('1. Go to Supabase Dashboard: https://app.supabase.com');
    console.log('2. Navigate to: Project > SQL Editor');
    console.log('3. Click "+ New Query"');
    console.log('4. Copy the SQL from: db/24_create_travel_tables.sql');
    console.log('5. Execute the query\n');

    console.log('OR use psql directly:\n');
    console.log('psql "$SUPABASE_DB_URL" < db/24_create_travel_tables.sql\n');

    console.log('Tables to be created:');
    console.log('  ✓ travels');
    console.log('  ✓ travel_members');
    console.log('  ✓ travel_events');
    console.log('  ✓ travel_costs');
    console.log('  ✓ travel_cost_splits');
    console.log('  ✓ travel_checklist_items');
    console.log('  ✓ travel_documents');
    console.log('  ✓ travel_notifications');
    console.log('  ✓ travel_notification_rules\n');
    console.log('🔐 Row-Level Security (RLS) policies will be enabled');
    console.log('🎯 Indexes created for optimal query performance');
    console.log('⚙️  Trigger functions installed for audit trails');

  } catch (err) {
    console.error('❌ Error:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

migrate();
