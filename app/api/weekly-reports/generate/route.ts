import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { generateWeeklyReport } from '@/lib/weekly-reports/service';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { year, week, force = false } = body;

    // Determine triggered_by
    const userId = request.headers.get('x-user-id');
    const triggeredBy = userId ? `user:${userId}` : 'manual';

    const result = await generateWeeklyReport(
      supabase,
      year,
      week,
      force,
      triggeredBy
    );

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error('Error in generate weekly report:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate weekly report', status: 500 },
      { status: 500 }
    );
  }
}
