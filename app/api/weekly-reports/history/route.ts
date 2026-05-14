import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import type { WeeklyDept, WeeklyEntryStatus } from '@/lib/weekly-reports/types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export const dynamic = 'force-dynamic';

const VALID_DEPTS: WeeklyDept[] = ['production', 'technology', 'maintenance', 'management'];
const VALID_STATUSES: WeeklyEntryStatus[] = ['draft', 'submitted', 'merged', 'rejected'];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const yearStr = searchParams.get('year');
    const weekStr = searchParams.get('week');
    const dept = searchParams.get('dept_name') as WeeklyDept | null;
    const status = searchParams.get('status') as WeeklyEntryStatus | null;
    const view = searchParams.get('view') ?? 'entries'; // 'entries' | 'reports'
    const limitStr = searchParams.get('limit');
    const offsetStr = searchParams.get('offset');

    if (dept && !VALID_DEPTS.includes(dept)) {
      return NextResponse.json(
        { error: `Invalid dept_name. Must be one of: ${VALID_DEPTS.join(', ')}`, status: 400 },
        { status: 400 },
      );
    }
    if (status && !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`, status: 400 },
        { status: 400 },
      );
    }

    const limit = limitStr ? Math.min(Math.max(parseInt(limitStr, 10) || 50, 1), 500) : 50;
    const offset = offsetStr ? Math.max(parseInt(offsetStr, 10) || 0, 0) : 0;

    if (view === 'reports') {
      // History of generated/reviewed/approved weekly_reports rows
      let q = supabase
        .from('weekly_reports_summary')
        .select('*', { count: 'exact' })
        .order('year', { ascending: false })
        .order('week', { ascending: false })
        .range(offset, offset + limit - 1);

      if (yearStr) {
        const y = parseInt(yearStr, 10);
        if (!isNaN(y)) q = q.eq('year', y);
      }
      if (weekStr) {
        const w = parseInt(weekStr, 10);
        if (!isNaN(w)) q = q.eq('week', w);
      }

      const { data, error, count } = await q;
      if (error) throw error;

      return NextResponse.json(
        { view: 'reports', total: count ?? data?.length ?? 0, limit, offset, items: data ?? [] },
        { status: 200 },
      );
    }

    // Default: history of entries (template-based input layer)
    let q = supabase
      .from('weekly_entries_view')
      .select('*', { count: 'exact' })
      .order('year', { ascending: false })
      .order('week', { ascending: false })
      .order('dept_name', { ascending: true })
      .range(offset, offset + limit - 1);

    if (yearStr) {
      const y = parseInt(yearStr, 10);
      if (!isNaN(y)) q = q.eq('year', y);
    }
    if (weekStr) {
      const w = parseInt(weekStr, 10);
      if (!isNaN(w)) q = q.eq('week', w);
    }
    if (dept) q = q.eq('dept_name', dept);
    if (status) q = q.eq('status', status);

    const { data, error, count } = await q;
    if (error) throw error;

    return NextResponse.json(
      { view: 'entries', total: count ?? data?.length ?? 0, limit, offset, items: data ?? [] },
      { status: 200 },
    );
  } catch (error: any) {
    console.error('GET /api/weekly-reports/history error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch history', status: 500 },
      { status: 500 },
    );
  }
}
