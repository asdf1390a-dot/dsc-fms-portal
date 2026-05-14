import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = 'force-dynamic';

export async function PUT(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized', status: 401 }, { status: 401 });
    }

    // Recalculate storage
    const { data: backups, error: backupError } = await supabase
      .from('backups')
      .select('size_bytes')
      .eq('user_id', userId)
      .eq('status', 'completed');

    if (backupError) throw backupError;

    const currentUsage = backups?.reduce((sum, b) => sum + (b.size_bytes || 0), 0) || 0;

    // Update quota
    const { data, error } = await supabase
      .from('backup_storage_quotas')
      .update({
        current_usage_bytes: currentUsage,
        last_calculated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      data: {
        current_usage_bytes: currentUsage,
        recalculated_at: new Date().toISOString(),
      },
      status: 200,
    });
  } catch (error) {
    console.error('Error updating quota:', error);
    return NextResponse.json({ error: 'Internal server error', status: 500 }, { status: 500 });
  }
}
