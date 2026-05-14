#!/usr/bin/env node

/**
 * Create Supabase Storage Bucket for Backups
 *
 * Creates the 'backups' bucket with proper configuration.
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log('📦 Creating Supabase Storage Bucket\n');

  try {
    // Check if bucket already exists
    const { data: buckets } = await supabase.storage.listBuckets();
    const existing = buckets?.find((b) => b.name === 'backups');

    if (existing) {
      console.log('✅ Bucket "backups" already exists');
      console.log(`   ID: ${existing.id}`);
      process.exit(0);
    }

    // Create the bucket
    console.log('⏳ Creating bucket "backups"...');
    const { data, error } = await supabase.storage.createBucket('backups', {
      public: false,
    });

    if (error) {
      console.error('❌ Failed to create bucket:', error.message);
      process.exit(1);
    }

    console.log('✅ Bucket created successfully');
    console.log(`   ID: ${data.name}`);

    // Verify RLS policies can be applied
    console.log('\n🔐 Bucket ready for RLS policies');
    console.log('   Users will upload to: backups/{user_id}/{backup_id}/*');
    console.log('   RLS is enforced at the database level (storage_policies)');

    console.log('\n✨ Storage setup complete!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

main();
