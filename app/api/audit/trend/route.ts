import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

// GET /api/audit/trend?range=7|30 — DRS trend over N days
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const rangeParam = url.searchParams.get('range') || '7';
    const range = Math.min(Math.max(parseInt(rangeParam, 10) || 7, 1), 90);

    const since = new Date();
    since.setUTCDate(since.getUTCDate() - (range - 1));
    const sinceDate = since.toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from('audit_sessions')
      .select(
        'report_date, drs_score, backup_recovery_rate, storage_health_rate, data_integrity_rate, accessibility_rate, status'
      )
      .gte('report_date', sinceDate)
      .order('report_date', { ascending: true });

    if (error) {
      return NextResponse.json(
        { success: false, error: { message: error.message } },
        { status: 500 }
      );
    }

    const series = data || [];
    const avg =
      series.length > 0
        ? Math.round(
            series.reduce((s, r) => s + (r.drs_score || 0), 0) / series.length
          )
        : null;

    return NextResponse.json({
      success: true,
      range,
      count: series.length,
      avg_drs: avg,
      data: series,
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: {
          message: err instanceof Error ? err.message : 'Server error',
        },
      },
      { status: 500 }
    );
  }
}
