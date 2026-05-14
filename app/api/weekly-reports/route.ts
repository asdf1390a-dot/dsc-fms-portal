import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { listWeeklyReports, getWeeklyReport } from '@/lib/weekly-reports/service';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const week = searchParams.get('week');
    const month = searchParams.get('month');

    // If year and week are provided, fetch specific report
    if (year && week) {
      const yearNum = parseInt(year, 10);
      const weekNum = parseInt(week, 10);

      if (isNaN(yearNum) || isNaN(weekNum) || weekNum < 1 || weekNum > 53) {
        return NextResponse.json(
          { error: 'Invalid year or week format', status: 400 },
          { status: 400 }
        );
      }

      const report = await getWeeklyReport(supabase, yearNum, weekNum);

      if (!report) {
        return NextResponse.json(
          { error: 'Weekly report not found', status: 404 },
          { status: 404 }
        );
      }

      return NextResponse.json(report, { status: 200 });
    }

    // Otherwise, list reports by year (and optionally month)
    if (!year) {
      return NextResponse.json(
        { error: 'Year parameter is required', status: 400 },
        { status: 400 }
      );
    }

    const yearNum = parseInt(year, 10);
    const monthNum = month ? parseInt(month, 10) : undefined;

    if (isNaN(yearNum) || (monthNum !== undefined && (monthNum < 1 || monthNum > 12))) {
      return NextResponse.json(
        { error: 'Invalid year or month format', status: 400 },
        { status: 400 }
      );
    }

    const result = await listWeeklyReports(supabase, yearNum, monthNum);
    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error('Error in weekly reports:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process request', status: 500 },
      { status: 500 }
    );
  }
}
