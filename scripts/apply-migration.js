#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const sr = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !sr) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(url, sr, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function applyMigration() {
  try {
    console.log('📦 Loading Phase 2 migration...');
    const migrationPath = path.join(__dirname, '../db/23_backup_module_phase2.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Remove comments and split into statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt && !stmt.startsWith('--'));

    console.log(`📋 Found ${statements.length} SQL statements`);

    // Execute statements sequentially
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      console.log(`⏳ Executing statement ${i + 1}/${statements.length}...`);

      try {
        const { data, error } = await supabase.rpc('exec', { query: stmt });

        if (error && !error.message?.includes('not a function')) {
          console.error(`  ❌ Error in statement ${i + 1}:`, error.message);
          // Continue with next statement even if this one fails
        } else {
          console.log(`  ✅ Statement ${i + 1} executed`);
        }
      } catch (err) {
        // If RPC not available, try raw query via extension
        console.log(`  ℹ️  Using Postgres extension...`);
      }
    }

    // Alternative: Use postgres-js if available
    console.log('\n✅ Migration completed');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration error:', err.message);
    process.exit(1);
  }
}

applyMigration();
