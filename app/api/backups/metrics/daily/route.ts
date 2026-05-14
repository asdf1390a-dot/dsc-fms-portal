import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized', status: 401 }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const limit = parseInt(searchParams.get('limit') || '90');

    let query = supabase
      .from('backup_metrics')
      .select('*')
      .eq('user_id', userId)
      .order('metric_date', { ascending: false })
      .limit(limit);

    if (startDate) query = query.gte('metric_date', startDate);
    if (endDate) query = query.lte('metric_date', endDate);

    const { data, error } = await query;

    if (error) throw error;
    return NextResponse.json({ data: data || [], status: 200 });
  } catch (error) {
    console.error('Error fetching daily metrics:', error);
    return NextResponse.json({ error: 'Internal server error', status: 500 }, { status: 500 });
  }
}
