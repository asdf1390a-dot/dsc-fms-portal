/// <reference lib="dom" />
// GET /api/team-dashboard/members/[id]
//   Returns the member record + their portfolio_items (sorted by start_date desc).
//
// PUT /api/team-dashboard/members/[id]
//   Updates the member. Requires Bearer JWT (authenticated). Writes an
//   activity_log row describing the change.

import { z } from 'zod';
import { supabase, ok, fail, getUserId } from '@/lib/team/dashboard-helpers';

const UpdateSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role: z.string().min(1).optional(),
  department: z.string().nullable().optional(),
  start_date: z.string().nullable().optional(),
  avatar_url: z.string().url().nullable().optional().or(z.literal('')),
  bio: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const { data: member, error } = await supabase
      .from('team_members')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error || !member) return fail('NOT_FOUND', 'Member not found', 404);

    const { data: portfolio } = await supabase
      .from('portfolio_items')
      .select('*')
      .eq('member_id', params.id)
      .order('start_date', { ascending: false });

    return ok({ ...member, portfolio: portfolio || [] });
  } catch (e: any) {
    return fail('INTERNAL_ERROR', e?.message || 'Internal server error', 500);
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const userId = getUserId(request);
    if (!userId) return fail('UNAUTHORIZED', 'Authentication required', 401);

    const { data: existing, error: existsErr } = await supabase
      .from('team_members')
      .select('id')
      .eq('id', params.id)
      .single();
    if (existsErr || !existing) return fail('NOT_FOUND', 'Member not found', 404);

    const body = await request.json();
    const parsed = UpdateSchema.safeParse(body);
    if (!parsed.success) {
      return fail('INVALID_REQUEST', 'Validation error', 400, parsed.error.issues);
    }

    const updateData = { ...parsed.data, updated_at: new Date().toISOString() };

    const { data, error } = await supabase
      .from('team_members')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single();

    if (error) return fail('INTERNAL_ERROR', error.message, 500);

    // Best-effort activity log; do not fail the request if logging fails.
    await supabase.from('activity_log').insert({
      member_id: params.id,
      activity_type: 'member_updated',
      activity_description: `Member profile updated by ${userId}`,
      metadata: { updated_fields: Object.keys(parsed.data), actor: userId },
    });

    return ok(data);
  } catch (e: any) {
    return fail('INTERNAL_ERROR', e?.message || 'Internal server error', 500);
  }
}
