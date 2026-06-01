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

// GET /api/team/resources/capacity - Calculate team resource capacity
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month') || new Date().toISOString().substring(0, 7);

    // Fetch all active team members
    const { data: members, error: membersError } = await supabase
      .from('team_members')
      .select('id, active')
      .eq('active', true);

    if (membersError) {
      return jsonResponse(
        { error: membersError.message, code: membersError.code },
        400
      );
    }

    const totalMembers = members?.length || 0;
    const totalTeamCapacity = totalMembers * 160; // Assuming 40 hours/week * 4 weeks

    // Fetch resource allocations for the month
    const { data: allocations, error: allocError } = await supabase
      .from('team_resource_allocations')
      .select('allocated_hours')
      .gte('start_date', `${month}-01`)
      .lte('end_date', `${month}-31`);

    let totalAllocated = 0;
    if (allocError) {
      if (allocError.code !== 'PGRST116' && allocError.code !== 'PGRST205' && !allocError.message?.includes('does not exist') && !allocError.message?.includes('Could not find the table')) {
        return jsonResponse(
          { error: allocError.message, code: allocError.code },
          400
        );
      }
    } else {
      totalAllocated = allocations?.reduce((sum, a) => sum + (a.allocated_hours || 0), 0) || 0;
    }
    const totalAvailable = totalTeamCapacity - totalAllocated;
    const teamAllocationPercentage = totalTeamCapacity > 0
      ? Math.round((totalAllocated / totalTeamCapacity) * 100)
      : 0;

    return jsonResponse({
      month,
      totalMembers,
      totalTeamCapacity,
      totalAllocated,
      totalAvailable,
      teamAllocationPercentage,
    });
  } catch (error: any) {
    return jsonResponse(
      { error: error.message || 'Internal server error' },
      500
    );
  }
}
