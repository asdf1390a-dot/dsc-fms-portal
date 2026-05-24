// app/api/travels/route.ts
// GET  /api/travels       — list travels involving the authenticated user
// POST /api/travels       — create a new travel and register the creator as organizer

import { supabaseAdmin } from '@/lib/travel/supabase-client';
import {
  getUserTravels,
  getUserInvolvedTravels,
  validateTravelDates,
} from '@/lib/travel/service';
import type {
  Travel,
  CreateTravelRequest,
  ApiResponse,
  ApiResponseList,
} from '@/types/travel';

function readUserId(request: Request): string | null {
  return request.headers.get('x-user-id');
}

function json<T>(body: ApiResponse<T> | ApiResponseList<T>, status: number): Response {
  return Response.json({ ...body, status }, { status });
}

function deriveStatus(startDate: string, endDate: string): Travel['status'] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (today < start) return 'upcoming';
  if (today > end) return 'completed';
  return 'ongoing';
}

export async function GET(request: Request): Promise<Response> {
  try {
    const userId = readUserId(request);
    if (!userId) {
      return json<Travel[]>({ error: 'Unauthorized', status: 401 }, 401);
    }

    const url = new URL(request.url);
    const status = url.searchParams.get('status') as
      | 'upcoming'
      | 'ongoing'
      | 'completed'
      | null;
    const sortBy = (url.searchParams.get('sort_by') as 'date' | 'cost' | 'name') || 'date';
    const scope = url.searchParams.get('scope') || 'involved'; // 'organized' | 'involved'

    let travels: Travel[];
    if (scope === 'organized') {
      travels = (await getUserTravels(
        supabaseAdmin,
        userId,
        status || undefined,
        sortBy
      )) as Travel[];
    } else {
      travels = (await getUserInvolvedTravels(supabaseAdmin, userId)) as Travel[];

      if (status) {
        travels = travels.filter((t) => t.status === status);
      }

      if (sortBy === 'date') {
        travels.sort(
          (a, b) =>
            new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
        );
      } else if (sortBy === 'name') {
        travels.sort((a, b) => a.name.localeCompare(b.name));
      }
    }

    return json<Travel[]>({ data: travels, status: 200 }, 200);
  } catch (err) {
    console.error('GET /api/travels error:', err);
    return json<Travel[]>(
      { error: err instanceof Error ? err.message : 'Server error', status: 500 },
      500
    );
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const userId = readUserId(request);
    if (!userId) {
      return json<Travel>({ error: 'Unauthorized', status: 401 }, 401);
    }

    const payload: CreateTravelRequest = await request.json();

    if (!payload.name || !payload.start_date || !payload.end_date || !payload.location) {
      return json<Travel>(
        { error: 'name, start_date, end_date, location are required', status: 400 },
        400
      );
    }

    const dateCheck = validateTravelDates(payload.start_date, payload.end_date);
    if (!dateCheck.valid) {
      return json<Travel>({ error: dateCheck.error, status: 400 }, 400);
    }

    const status = deriveStatus(payload.start_date, payload.end_date);

    const { data: travel, error: insertError } = await supabaseAdmin
      .from('travels')
      .insert([
        {
          user_id: userId,
          name: payload.name,
          description: payload.description || null,
          start_date: payload.start_date,
          end_date: payload.end_date,
          location: payload.location,
          status,
        },
      ])
      .select()
      .single();

    if (insertError || !travel) {
      console.error('Insert travel error:', insertError);
      return json<Travel>(
        { error: insertError?.message || 'Failed to create travel', status: 500 },
        500
      );
    }

    // Register creator as organizer with read_write permission
    const { error: memberError } = await supabaseAdmin.from('travel_members').insert([
      {
        travel_id: travel.id,
        user_id: userId,
        role: 'organizer',
        permission: 'read_write',
      },
    ]);

    if (memberError) {
      console.error('Insert organizer member error:', memberError);
    }

    // Default notification rule: 3 days before departure
    await supabaseAdmin.from('travel_notification_rules').insert([
      {
        travel_id: travel.id,
        rule_type: 'days_before_departure',
        rule_config: { days: 3, channels: ['in_app'] },
        is_enabled: true,
      },
    ]);

    return json<Travel>({ data: travel as Travel, status: 201 }, 201);
  } catch (err) {
    console.error('POST /api/travels error:', err);
    return json<Travel>(
      { error: err instanceof Error ? err.message : 'Server error', status: 500 },
      500
    );
  }
}
