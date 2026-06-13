/// <reference lib="dom" />
// GET /api/team-dashboard/members/[id]/activity
// Returns activity_log entries for a member, newest first.
//
// Query:
//   activity_type? filter by type
//   limit?         1..200 (default 50)
//   offset?        >=0    (default 0)

import { supabase, ok, fail, parsePaging } from '@/lib/team/dashboard-helpers';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const url = new URL(request.url);
    const activityType = url.searchParams.get('activity_type');
    const { limit, offset } = parsePaging(url, 50, 200);

    const { data: member } = await supabase
      .from('team_members')
      .select('id')
      .eq('id', params.id)
      .single();
    if (!member) return fail('NOT_FOUND', 'Member not found', 404);

    let query = supabase
      .from('activity_log')
      .select('*', { count: 'exact' })
      .eq('member_id', params.id);

    if (activityType) query = query.eq('activity_type', activityType);

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return fail('INTERNAL_ERROR', error.message, 500);

    return ok(data || [], {
      pagination: {
        total: count ?? 0,
        limit,
        offset,
        hasMore: offset + limit < (count ?? 0),
      },
    });
  } catch (e: any) {
    return fail('INTERNAL_ERROR', e?.message || 'Internal server error', 500);
  }
}
