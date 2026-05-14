require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  console.log('🔍 Checking database schema...\n');

  const tables = [
    'backup_policies',
    'backup_storage_quotas',
    'backup_notifications',
    'backup_metrics',
  ];

  for (const table of tables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);

      if (error && error.code === 'PGRST116') {
        console.log(`❌ ${table} — NOT FOUND`);
      } else if (error) {
        console.log(`⚠️  ${table} — ERROR: ${error.message}`);
      } else {
        console.log(`✅ ${table} — EXISTS`);
      }
    } catch (e) {
      console.log(`❌ ${table} — ERROR: ${e.message}`);
    }
  }

  // Check if new columns exist in backups table
  console.log('\n🔍 Checking backups table extensions...');
  try {
    const { data, error } = await supabase
      .from('backups')
      .select('storage_provider, is_compressed, compression_ratio')
      .limit(1);

    if (error) {
      console.log(`❌ New columns NOT FOUND: ${error.message}`);
    } else {
      console.log(`✅ New columns — EXISTS`);
    }
  } catch (e) {
    console.log(`❌ ERROR: ${e.message}`);
  }
}

checkSchema();
