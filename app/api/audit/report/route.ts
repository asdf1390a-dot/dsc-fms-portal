import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

// GET /api/audit/report — latest DRS report (optional ?date=YYYY-MM-DD)
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const date = url.searchParams.get('date');

    let query = supabase.from('audit_sessions').select('*');

    if (date) {
      query = query.eq('report_date', date).limit(1);
    } else {
      query = query.order('report_date', { ascending: false }).limit(1);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { success: false, error: { message: error.message } },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { success: true, data: null, message: 'No audit session found' },
        { status: 200 }
      );
    }

    return NextResponse.json({ success: true, data: data[0] });
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
