import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { generateWeeklyReport } from '@/lib/weekly-reports/service';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = 'force-dynamic';

/**
 * Cron endpoint to auto-generate weekly reports
 * Triggered every Sunday at 23:00 KST by Vercel Cron
 *
 * Authorization: X-CRON-TOKEN header (set in Vercel env)
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron token
    const cronToken = request.headers.get('x-cron-token');
    if (cronToken !== process.env.CRON_TOKEN) {
      return NextResponse.json(
        { error: 'Unauthorized', status: 401 },
        { status: 401 }
      );
    }

    // Get current ISO week
    const now = new Date();
    const year = now.getUTCFullYear();
    const week = getISOWeek(now);

    console.log(`[Cron] Generating weekly report for ${year}-W${String(week).padStart(2, '0')}`);

    const result = await generateWeeklyReport(
      supabase,
      year,
      week,
      false,
      'cron:weekly_auto_generate'
    );

    return NextResponse.json({
      message: 'Weekly report generated successfully',
      ...result,
    }, { status: 200 });
  } catch (error: any) {
    console.error('[Cron] Error generating weekly report:', error);

    // Log error for monitoring
    try {
      await supabase
        .from('weekly_auto_logs')
        .insert({
          status: 'failed',
          error_msg: error.message,
          triggered_by: 'cron:weekly_auto_generate',
        });
    } catch (logError) {
      console.error('[Cron] Failed to log error:', logError);
    }

    return NextResponse.json(
      { error: error.message || 'Failed to generate weekly report', status: 500 },
      { status: 500 }
    );
  }
}

/**
 * Calculate ISO week number for a given date
 * ISO 8601: Week 1 is the first week with a Thursday
 */
function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}
