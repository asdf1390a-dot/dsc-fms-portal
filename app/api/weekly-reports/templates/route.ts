import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import type { WeeklyDept } from '@/lib/weekly-reports/types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export const dynamic = 'force-dynamic';

const VALID_DEPTS: WeeklyDept[] = ['production', 'technology', 'maintenance', 'management'];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dept = searchParams.get('dept_name') as WeeklyDept | null;
    const activeParam = searchParams.get('active');
    const onlyActive = activeParam === null ? true : activeParam === 'true' || activeParam === '1';

    if (dept && !VALID_DEPTS.includes(dept)) {
      return NextResponse.json(
        { error: `Invalid dept_name. Must be one of: ${VALID_DEPTS.join(', ')}`, status: 400 },
        { status: 400 },
      );
    }

    let query = supabase
      .from('weekly_report_templates')
      .select('*')
      .order('dept_name', { ascending: true })
      .order('version', { ascending: false });

    if (dept) query = query.eq('dept_name', dept);
    if (onlyActive) query = query.eq('is_active', true);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json(
      {
        total: data?.length ?? 0,
        templates: data ?? [],
      },
      { status: 200 },
    );
  } catch (error: any) {
    console.error('GET /api/weekly-reports/templates error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to list templates', status: 500 },
      { status: 500 },
    );
  }
}
