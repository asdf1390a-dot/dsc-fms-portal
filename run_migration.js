require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const { Client } = require('pg');

const connectionString = process.env.DIRECT_URL;
console.log('Connecting to:', connectionString.replace(/:[^@]*@/, ':***@'));

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  try {
    await client.connect();
    console.log('Connected to database');
    
    const migrationSql = fs.readFileSync('db/37_team_dashboard_phase2_communications.sql', 'utf-8');
    
    await client.query(migrationSql);
    console.log('✓ Migration executed successfully');
    
    // Verify tables were created
    const result = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('team_performance_metrics', 'team_resource_allocations', 'team_message_threads', 'team_messages')
      ORDER BY table_name
    `);
    
    console.log('\nCreated tables:');
    result.rows.forEach(row => console.log('  ✓', row.table_name));
    
  } catch (err) {
    console.error('Migration error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
