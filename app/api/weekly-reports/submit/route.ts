import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import type { PostSubmitRequest } from '@/lib/weekly-reports/types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as PostSubmitRequest;
    const { year, week } = body ?? {};
    const userIdFromHeader = request.headers.get('x-user-id');
    const userId = body?.user_id ?? userIdFromHeader ?? null;

    if (typeof year !== 'number' || typeof week !== 'number' || week < 1 || week > 53) {
      return NextResponse.json(
        { error: 'Missing/invalid fields. Required: year (int), week (1-53).', status: 400 },
        { status: 400 },
      );
    }

    const { data: report, error } = await supabase.rpc('submit_weekly_entries', {
      p_year: year,
      p_week: week,
      p_user_id: userId,
    });

    if (error) throw error;

    return NextResponse.json(
      {
        success: true,
        report_id: (report as any)?.id ?? null,
        status: (report as any)?.status ?? null,
        week: `${year}-W${String(week).padStart(2, '0')}`,
        report,
      },
      { status: 200 },
    );
  } catch (error: any) {
    console.error('POST /api/weekly-reports/submit error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to submit weekly entries', status: 500 },
      { status: 500 },
    );
  }
}
