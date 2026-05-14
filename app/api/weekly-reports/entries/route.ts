import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import type { PostEntryRequest, WeeklyDept } from '@/lib/weekly-reports/types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export const dynamic = 'force-dynamic';

const VALID_DEPTS: WeeklyDept[] = ['production', 'technology', 'maintenance', 'management'];

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as PostEntryRequest;
    const { year, week, dept_name, data, source = 'manual', template_id } = body ?? {};

    if (
      typeof year !== 'number' ||
      typeof week !== 'number' ||
      week < 1 ||
      week > 53 ||
      !dept_name ||
      !VALID_DEPTS.includes(dept_name) ||
      typeof data !== 'object' ||
      data === null
    ) {
      return NextResponse.json(
        {
          error:
            'Missing/invalid fields. Required: year (int), week (1-53), dept_name (production|technology|maintenance|management), data (object).',
          status: 400,
        },
        { status: 400 },
      );
    }

    const { data: entry, error } = await supabase.rpc('upsert_weekly_entry', {
      p_year: year,
      p_week: week,
      p_dept_name: dept_name,
      p_data: data,
      p_source: source,
      p_template_id: template_id ?? null,
    });

    if (error) throw error;

    return NextResponse.json(
      {
        success: true,
        entry,
      },
      { status: 200 },
    );
  } catch (error: any) {
    console.error('POST /api/weekly-reports/entries error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to upsert weekly entry', status: 500 },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const yearStr = searchParams.get('year');
    const weekStr = searchParams.get('week');
    const dept = searchParams.get('dept_name') as WeeklyDept | null;

    if (!yearStr || !weekStr) {
      return NextResponse.json(
        { error: 'year and week query params are required', status: 400 },
        { status: 400 },
      );
    }

    const year = parseInt(yearStr, 10);
    const week = parseInt(weekStr, 10);
    if (isNaN(year) || isNaN(week) || week < 1 || week > 53) {
      return NextResponse.json(
        { error: 'Invalid year/week', status: 400 },
        { status: 400 },
      );
    }
    if (dept && !VALID_DEPTS.includes(dept)) {
      return NextResponse.json(
        { error: `Invalid dept_name. Must be one of: ${VALID_DEPTS.join(', ')}`, status: 400 },
        { status: 400 },
      );
    }

    let query = supabase
      .from('weekly_entries_view')
      .select('*')
      .eq('year', year)
      .eq('week', week)
      .order('dept_name', { ascending: true });

    if (dept) query = query.eq('dept_name', dept);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json(
      { total: data?.length ?? 0, entries: data ?? [] },
      { status: 200 },
    );
  } catch (error: any) {
    console.error('GET /api/weekly-reports/entries error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch entries', status: 500 },
      { status: 500 },
    );
  }
}
