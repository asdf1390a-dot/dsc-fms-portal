/// <reference lib="dom" />
// GET /api/team-dashboard/members
// List team members with pagination + filter by department/role/active/search.
//
// Query:
//   department? string
//   role?       string
//   active?     'true' | 'false'
//   search?     name/email ilike
//   limit?      1..200 (default 50)
//   offset?     >=0    (default 0)
//
// Public read (RLS allows SELECT) — anon JWT or no auth both work.

import { supabase, ok, fail, parsePaging } from '@/lib/team/dashboard-helpers';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const department = url.searchParams.get('department');
    const role = url.searchParams.get('role');
    const active = url.searchParams.get('active');
    const search = url.searchParams.get('search');
    const { limit, offset } = parsePaging(url);

    let query = supabase.from('team_members').select('*', { count: 'exact' });

    if (department) query = query.eq('department', department);
    if (role) query = query.eq('role', role);
    if (active === 'true' || active === 'false') query = query.eq('active', active === 'true');
    if (search) query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);

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
