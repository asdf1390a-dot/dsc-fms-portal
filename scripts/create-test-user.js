#!/usr/bin/env node
// Script to create a test user for Backup Phase 2 UI evaluation
// Run with: node scripts/create-test-user.js

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load .env.local manually
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && !key.startsWith('#')) {
    envVars[key] = valueParts.join('=').replace(/^"|"$/g, '');
  }
});

const SUPABASE_URL = envVars.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing environment variables:');
  console.error('  - NEXT_PUBLIC_SUPABASE_URL');
  console.error('  - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function createTestUser() {
  try {
    console.log('🔧 Creating test user for Backup Phase 2 UI evaluation...\n');

    const testEmail = 'backup-evaluator@dsc.test';
    const testPassword = 'TestEvaluator2026!Backup@DSC';

    // Create the user
    const { data, error: createError } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      user_metadata: {
        employee_id: 'EVAL-001',
        full_name: 'Backup Evaluator',
        role: 'evaluator',
      },
      email_confirm: true,
    });

    if (createError) {
      if (createError.message.includes('already exists')) {
        console.log('✅ Test user already exists\n');
      } else {
        throw createError;
      }
    } else {
      console.log('✅ Test user created successfully\n');
      console.log(`📧 Email: ${data.user?.email}`);
      console.log(`🆔 User ID: ${data.user?.id}\n`);
    }

    // Test login to get access token
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    if (signInError) {
      console.error('❌ Failed to sign in:', signInError.message);
      process.exit(1);
    }

    console.log('📋 Test Credentials:');
    console.log('─'.repeat(50));
    console.log(`Email:    ${testEmail}`);
    console.log(`Password: ${testPassword}`);
    console.log(`Token:    ${signInData.session?.access_token}`);
    console.log('─'.repeat(50));
    console.log('\n📝 Usage Instructions:');
    console.log('  1. Open browser DevTools (F12)');
    console.log('  2. Go to Application → Local Storage');
    console.log('  3. Find key: sb-<project-id>-auth-token');
    console.log('  4. Or use curl with Authorization header:');
    console.log(`     curl -H "Authorization: Bearer ${signInData.session?.access_token}" http://localhost:3000/api/backup/list\n`);
    console.log('  5. Or navigate to login page and sign in with credentials above\n');

  } catch (error) {
    console.error('❌ Error creating test user:', error.message);
    process.exit(1);
  }
}

createTestUser();
