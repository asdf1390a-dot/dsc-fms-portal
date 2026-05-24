// app/api/travels/[id]/members/route.ts
// GET  — list members of a travel
// POST — add a member (organizer only)

import { supabaseAdmin } from '@/lib/travel/supabase-client';
import {
  hasReadAccess,
  isOrganizer,
  getTravelMembers,
} from '@/lib/travel/service';
import type {
  TravelMember,
  CreateTravelMemberRequest,
  ApiResponse,
  ApiResponseList,
} from '@/types/travel';

function readUserId(request: Request): string | null {
  return request.headers.get('x-user-id');
}

function json<T>(body: ApiResponse<T> | ApiResponseList<T>, status: number): Response {
  return Response.json({ ...body, status }, { status });
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
): Promise<Response> {
  try {
    const userId = readUserId(request);
    if (!userId) return json<TravelMember[]>({ error: 'Unauthorized', status: 401 }, 401);

    const canRead = await hasReadAccess(supabaseAdmin, userId, params.id);
    if (!canRead) return json<TravelMember[]>({ error: 'Forbidden', status: 403 }, 403);

    const members = await getTravelMembers(supabaseAdmin, params.id);
    return json<TravelMember[]>({ data: members as TravelMember[], status: 200 }, 200);
  } catch (err) {
    console.error('GET /members error:', err);
    return json<TravelMember[]>(
      { error: err instanceof Error ? err.message : 'Server error', status: 500 },
      500
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
): Promise<Response> {
  try {
    const userId = readUserId(request);
    if (!userId) return json<TravelMember>({ error: 'Unauthorized', status: 401 }, 401);

    const isOrg = await isOrganizer(supabaseAdmin, userId, params.id);
    if (!isOrg) {
      return json<TravelMember>(
        { error: 'Only organizer can add members', status: 403 },
        403
      );
    }

    const payload: CreateTravelMemberRequest = await request.json();
    if (!payload.user_id) {
      return json<TravelMember>({ error: 'user_id is required', status: 400 }, 400);
    }

    const { data: existing } = await supabaseAdmin
      .from('travel_members')
      .select('id')
      .eq('travel_id', params.id)
      .eq('user_id', payload.user_id)
      .maybeSingle();

    if (existing) {
      return json<TravelMember>(
        { error: 'User is already a member of this travel', status: 400 },
        400
      );
    }

    const { data: member, error } = await supabaseAdmin
      .from('travel_members')
      .insert([
        {
          travel_id: params.id,
          user_id: payload.user_id,
          role: payload.role || 'companion',
          permission: payload.permission || 'read_only',
        },
      ])
      .select()
      .single();

    if (error || !member) {
      console.error('Add member error:', error);
      return json<TravelMember>(
        { error: error?.message || 'Failed to add member', status: 500 },
        500
      );
    }

    return json<TravelMember>({ data: member as TravelMember, status: 201 }, 201);
  } catch (err) {
    console.error('POST /members error:', err);
    return json<TravelMember>(
      { error: err instanceof Error ? err.message : 'Server error', status: 500 },
      500
    );
  }
}
