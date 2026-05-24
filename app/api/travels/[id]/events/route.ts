// app/api/travels/[id]/events/route.ts
// GET  — list events of a travel (any member with read access)
// POST — create an event (organizer or read_write member)

import { supabaseAdmin } from '@/lib/travel/supabase-client';
import {
  hasReadAccess,
  hasWriteAccess,
  getTravelEvents,
} from '@/lib/travel/service';
import type {
  TravelEvent,
  CreateTravelEventRequest,
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
    if (!userId) return json<TravelEvent[]>({ error: 'Unauthorized', status: 401 }, 401);

    const canRead = await hasReadAccess(supabaseAdmin, userId, params.id);
    if (!canRead) return json<TravelEvent[]>({ error: 'Forbidden', status: 403 }, 403);

    const events = await getTravelEvents(supabaseAdmin, params.id);
    return json<TravelEvent[]>({ data: events as TravelEvent[], status: 200 }, 200);
  } catch (err) {
    console.error('GET /events error:', err);
    return json<TravelEvent[]>(
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
    if (!userId) return json<TravelEvent>({ error: 'Unauthorized', status: 401 }, 401);

    const canWrite = await hasWriteAccess(supabaseAdmin, userId, params.id);
    if (!canWrite) return json<TravelEvent>({ error: 'Forbidden', status: 403 }, 403);

    const payload: CreateTravelEventRequest = await request.json();
    if (!payload.title || !payload.event_type || !payload.event_date) {
      return json<TravelEvent>(
        { error: 'title, event_type, event_date are required', status: 400 },
        400
      );
    }

    const { data: event, error } = await supabaseAdmin
      .from('travel_events')
      .insert([
        {
          travel_id: params.id,
          title: payload.title,
          event_type: payload.event_type,
          event_date: payload.event_date,
          event_time: payload.event_time || null,
          location: payload.location || null,
          description: payload.description || null,
          details: payload.details || null,
          status: 'planned',
        },
      ])
      .select()
      .single();

    if (error || !event) {
      console.error('Insert event error:', error);
      return json<TravelEvent>(
        { error: error?.message || 'Failed to create event', status: 500 },
        500
      );
    }

    return json<TravelEvent>({ data: event as TravelEvent, status: 201 }, 201);
  } catch (err) {
    console.error('POST /events error:', err);
    return json<TravelEvent>(
      { error: err instanceof Error ? err.message : 'Server error', status: 500 },
      500
    );
  }
}
