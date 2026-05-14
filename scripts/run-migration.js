const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing Supabase credentials in environment');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function runMigration() {
  try {
    console.log('Reading migration file...');
    const migrationSql = fs.readFileSync('./db/24_create_travel_tables.sql', 'utf8');
    
    console.log('Executing migration...');
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: migrationSql
    });
    
    if (error) {
      console.error('Migration error:', error);
      process.exit(1);
    }
    
    console.log('Migration completed successfully!');
    console.log('Tables created:');
    console.log('- travels');
    console.log('- travel_members');
    console.log('- travel_events');
    console.log('- travel_costs');
    console.log('- travel_cost_splits');
    console.log('- travel_checklist_items');
    console.log('- travel_documents');
    console.log('- travel_notifications');
    console.log('- travel_notification_rules');
    
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

runMigration();
