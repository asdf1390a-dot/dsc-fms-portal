const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = 'https://pzkvhomhztikhkgwgqzr.supabase.co';
const serviceRoleKey = 'sb_secret_Uz2G3zJYx77CUoKVMEeb8Q_382yFu57';

const supabase = createClient(supabaseUrl, serviceRoleKey);

(async () => {
  try {
    const sqlPath = path.join(__dirname, '..', 'db', '44_team_dashboard_phase2c_metrics.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');
    
    console.log('📝 SQL file loaded, executing migration...');
    
    // Try using the rpc exec function or execute via query
    // Supabase doesn't have a native SQL exec, so we'll need to use a workaround
    // Try executing raw SQL statement by statement
    
    const statements = sql
      .split(/;+/)
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--') && s.length > 3);
    
    console.log(`Found ${statements.length} statements to execute`);
    
    // Since Supabase JS client doesn't support raw SQL directly,
    // we'll need to create the tables step-by-step
    // But first, let's verify the connection works
    
    const { data, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .limit(1);
    
    if (error) {
      console.error('Connection test failed:', error);
      throw error;
    }
    
    console.log('✅ Connected to Supabase');
    console.log('⚠️  Note: Direct SQL execution requires manual setup or API workaround');
    console.log('📌 Instructions: Go to Supabase Dashboard → SQL Editor → Run the migration file');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();
