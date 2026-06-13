/// <reference lib="dom" />
// GET  /api/team-dashboard/members/[id]/portfolio
//   List portfolio_items for the member. Sorted by start_date desc.
// POST /api/team-dashboard/members/[id]/portfolio
//   Create a portfolio item. Requires Bearer JWT.

import { z } from 'zod';
import { supabase, ok, fail, getUserId, parsePaging } from '@/lib/team/dashboard-helpers';

const CreatePortfolioSchema = z.object({
  project_name: z.string().min(1, 'project_name is required'),
  description: z.string().optional(),
  role: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  status: z.enum(['planned', 'in_progress', 'completed', 'on_hold', 'cancelled']).optional(),
  image_url: z.string().url().optional().or(z.literal('')),
});

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const url = new URL(request.url);
    const { limit, offset } = parsePaging(url, 50, 200);
    const status = url.searchParams.get('status');

    // Verify member exists.
    const { data: member } = await supabase
      .from('team_members')
      .select('id')
      .eq('id', params.id)
      .single();
    if (!member) return fail('NOT_FOUND', 'Member not found', 404);

    let query = supabase
      .from('portfolio_items')
      .select('*', { count: 'exact' })
      .eq('member_id', params.id);

    if (status) query = query.eq('status', status);

    const { data, error, count } = await query
      .order('start_date', { ascending: false, nullsFirst: false })
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

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const userId = getUserId(request);
    if (!userId) return fail('UNAUTHORIZED', 'Authentication required', 401);

    const { data: member } = await supabase
      .from('team_members')
      .select('id')
      .eq('id', params.id)
      .single();
    if (!member) return fail('NOT_FOUND', 'Member not found', 404);

    const body = await request.json();
    const parsed = CreatePortfolioSchema.safeParse(body);
    if (!parsed.success) {
      return fail('INVALID_REQUEST', 'Validation error', 400, parsed.error.issues);
    }

    const insertRow = {
      member_id: params.id,
      project_name: parsed.data.project_name,
      description: parsed.data.description ?? null,
      role: parsed.data.role ?? null,
      start_date: parsed.data.start_date ?? null,
      end_date: parsed.data.end_date ?? null,
      status: parsed.data.status ?? 'completed',
      image_url: parsed.data.image_url || null,
    };

    const { data, error } = await supabase
      .from('portfolio_items')
      .insert(insertRow)
      .select()
      .single();

    if (error) return fail('INTERNAL_ERROR', error.message, 500);

    await supabase.from('activity_log').insert({
      member_id: params.id,
      activity_type: 'portfolio_added',
      activity_description: `Portfolio item "${insertRow.project_name}" added`,
      metadata: { portfolio_id: data.id, actor: userId },
    });

    return ok(data, {}, 201);
  } catch (e: any) {
    return fail('INTERNAL_ERROR', e?.message || 'Internal server error', 500);
  }
}
