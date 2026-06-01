/// <reference lib="dom" />
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function jsonResponse(data: any, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

// GET /api/team/performance/metrics - List performance metrics with filtering and pagination
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get('memberId');
    const startWeek = searchParams.get('startWeek');
    const endWeek = searchParams.get('endWeek');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 500);
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = supabase
      .from('team_performance_metrics')
      .select('*', { count: 'exact' });

    if (memberId) {
      query = query.eq('member_id', memberId);
    }

    if (startWeek) {
      query = query.gte('week_start', startWeek);
    }

    if (endWeek) {
      query = query.lte('week_end', endWeek);
    }

    const { data, error, count } = await query
      .order('week_start', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      if (error.code === 'PGRST116' || error.code === 'PGRST205' || error.message?.includes('does not exist') || error.message?.includes('Could not find the table')) {
        return jsonResponse({
          data: [],
          count: 0,
          limit,
          offset,
          notice: 'Table team_performance_metrics not yet initialized',
        });
      }
      return jsonResponse(
        { error: error.message, code: error.code },
        400
      );
    }

    return jsonResponse({
      data,
      count,
      limit,
      offset,
    });
  } catch (error: any) {
    return jsonResponse(
      { error: error.message || 'Internal server error' },
      500
    );
  }
}
