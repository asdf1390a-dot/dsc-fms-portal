import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { generateWeeklyReport } from '@/lib/weekly-reports/service';
import type { PostAutoGenerateRequest } from '@/lib/weekly-reports/types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as PostAutoGenerateRequest;
    const { year, week, force = false, seed_entries = true } = body ?? {};

    const userId = request.headers.get('x-user-id');
    const triggeredBy = userId ? `user:${userId}` : 'auto-generate';

    const generated = await generateWeeklyReport(supabase, year, week, force, triggeredBy);

    let seededCount = 0;
    if (seed_entries && generated?.report_id) {
      // Extract year/week from the result.week string ("YYYY-Www") or use input
      const m = generated.week ? /^(\d{4})-W(\d{2})$/.exec(generated.week) : null;
      const seedYear = m ? parseInt(m[1], 10) : (year ?? null);
      const seedWeek = m ? parseInt(m[2], 10) : (week ?? null);

      if (seedYear && seedWeek) {
        const { data: count, error: seedErr } = await supabase.rpc('seed_entries_from_auto', {
          p_year: seedYear,
          p_week: seedWeek,
        });
        if (seedErr) {
          console.warn('seed_entries_from_auto failed:', seedErr.message);
        } else {
          seededCount = (count as number) ?? 0;
        }
      }
    }

    return NextResponse.json(
      {
        ...generated,
        seeded_entries: seededCount,
      },
      { status: 200 },
    );
  } catch (error: any) {
    console.error('POST /api/weekly-reports/auto-generate error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to auto-generate weekly report', status: 500 },
      { status: 500 },
    );
  }
}
