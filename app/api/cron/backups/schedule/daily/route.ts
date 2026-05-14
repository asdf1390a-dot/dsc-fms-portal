import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // Verify Vercel Cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized', status: 401 }, { status: 401 });
  }

  try {
    // Get all enabled policies
    const { data: policies, error: policiesError } = await supabase
      .from('backup_policies')
      .select('user_id, backup_time')
      .eq('backup_enabled', true);

    if (policiesError) throw policiesError;

    if (!policies || policies.length === 0) {
      return NextResponse.json({ triggered: 0, skipped: 0, failed: 0, status: 200 });
    }

    let triggered = 0;
    let skipped = 0;
    let failed = 0;

    for (const policy of policies) {
      try {
        // Check if backup already exists for today
        const today = new Date().toISOString().split('T')[0];
        const { data: existingBackup, error: checkError } = await supabase
          .from('backups')
          .select('id')
          .eq('user_id', policy.user_id)
          .gte('created_at', `${today}T00:00:00Z`)
          .lt('created_at', `${today}T23:59:59Z`)
          .single();

        if (checkError && checkError.code !== 'PGRST116') throw checkError;

        if (existingBackup) {
          skipped++;
          continue;
        }

        // Create backup record
        const { error: insertError } = await supabase
          .from('backups')
          .insert({
            user_id: policy.user_id,
            name: `Auto Backup ${new Date().toISOString().split('T')[0]}`,
            backup_type: 'agent_state',
            status: 'pending',
          });

        if (insertError) throw insertError;
        triggered++;
      } catch (err) {
        console.error(`Error triggering backup for ${policy.user_id}:`, err);
        failed++;
      }
    }

    return NextResponse.json({ triggered, skipped, failed, status: 200 });
  } catch (error) {
    console.error('Error in daily backup schedule:', error);
    return NextResponse.json({ error: 'Internal server error', status: 500 }, { status: 500 });
  }
}
