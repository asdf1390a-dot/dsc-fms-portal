import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

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

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: backups, error: backupError } = await supabase
      .from('backups')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString());

    if (backupError) throw backupError;

    if (!backups || backups.length === 0) {
      return NextResponse.json({
        data: {
          total_backups: 0,
          successful_backups: 0,
          failed_backups: 0,
          skipped_backups: 0,
          total_size_bytes: 0,
          average_duration_seconds: 0,
          max_duration_seconds: 0,
          failure_rate_percent: 0,
          period_days: days,
        },
        status: 200,
      });
    }

    const successful = backups.filter(b => b.status === 'completed').length;
    const failed = backups.filter(b => b.status === 'failed').length;
    const totalSize = backups.reduce((sum, b) => sum + (b.size_bytes || 0), 0);
    const durations = backups
      .filter(b => b.created_at && b.completed_at)
      .map(b => (new Date(b.completed_at).getTime() - new Date(b.created_at).getTime()) / 1000);
    const avgDuration = durations.length ? Math.round(durations.reduce((a, b) => a + b) / durations.length) : 0;
    const maxDuration = durations.length ? Math.max(...durations) : 0;

    return NextResponse.json({
      data: {
        total_backups: backups.length,
        successful_backups: successful,
        failed_backups: failed,
        skipped_backups: 0,
        total_size_bytes: totalSize,
        average_duration_seconds: avgDuration,
        max_duration_seconds: maxDuration,
        failure_rate_percent: backups.length ? (failed / backups.length) * 100 : 0,
        period_days: days,
      },
      status: 200,
    });
  } catch (error) {
    console.error('Error fetching metrics summary:', error);
    return NextResponse.json({ error: 'Internal server error', status: 500 }, { status: 500 });
  }
}
