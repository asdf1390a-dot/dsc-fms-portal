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

// GET /api/team/performance/trends - Get performance trends for a member over time
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get('memberId');
    const weeks = Math.min(parseInt(searchParams.get('weeks') || '12'), 52);

    if (!memberId) {
      return jsonResponse(
        { error: 'memberId parameter is required' },
        400
      );
    }

    const { data, error, count } = await supabase
      .from('team_performance_metrics')
      .select('*', { count: 'exact' })
      .eq('member_id', memberId)
      .order('week_start', { ascending: false })
      .limit(weeks);

    if (error) {
      if (error.code === 'PGRST116' || error.code === 'PGRST205' || error.message?.includes('does not exist') || error.message?.includes('Could not find the table')) {
        return jsonResponse({
          memberId,
          weeks,
          data: [],
          total: 0,
          notice: 'Table team_performance_metrics not yet initialized',
        });
      }
      return jsonResponse(
        { error: error.message, code: error.code },
        400
      );
    }

    return jsonResponse({
      memberId,
      weeks,
      data,
      total: count,
    });
  } catch (error: any) {
    return jsonResponse(
      { error: error.message || 'Internal server error' },
      500
    );
  }
}
