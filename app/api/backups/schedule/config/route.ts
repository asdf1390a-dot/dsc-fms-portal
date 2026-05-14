import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateBackupPolicy } from '@/lib/backups/service';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized', status: 401 }, { status: 401 });
    }

    const policy = await getOrCreateBackupPolicy(supabase, userId);
    return NextResponse.json({ data: policy, status: 200 });
  } catch (error) {
    console.error('Error fetching backup config:', error);
    return NextResponse.json({ error: 'Internal server error', status: 500 }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized', status: 401 }, { status: 401 });
    }

    const body = await request.json();

    // Validation
    if (body.backup_time && !/^\d{2}:\d{2}$/.test(body.backup_time)) {
      return NextResponse.json(
        { error: 'Invalid time format (HH:MM)', status: 400 },
        { status: 400 }
      );
    }

    if (body.backup_interval && !['daily', 'weekly', 'monthly'].includes(body.backup_interval)) {
      return NextResponse.json(
        { error: 'Invalid backup interval', status: 400 },
        { status: 400 }
      );
    }

    if (body.retention_days && (body.retention_days < 7 || body.retention_days > 3650)) {
      return NextResponse.json(
        { error: 'Retention days must be between 7 and 3650', status: 400 },
        { status: 400 }
      );
    }

    if (body.warning_threshold_percent && (body.warning_threshold_percent < 1 || body.warning_threshold_percent > 100)) {
      return NextResponse.json(
        { error: 'Warning threshold must be between 1 and 100', status: 400 },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('backup_policies')
      .update(body)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ data, status: 200 });
  } catch (error) {
    console.error('Error updating backup config:', error);
    return NextResponse.json({ error: 'Internal server error', status: 500 }, { status: 500 });
  }
}
