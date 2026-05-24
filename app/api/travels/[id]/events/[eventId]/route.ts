// app/api/travels/[id]/events/[eventId]/route.ts
// PUT    — update event (write access required)
// DELETE — delete event (write access required)

import { supabaseAdmin } from '@/lib/travel/supabase-client';
import { hasWriteAccess } from '@/lib/travel/service';
import type { TravelEvent, ApiResponse } from '@/types/travel';

function readUserId(request: Request): string | null {
  return request.headers.get('x-user-id');
}

function json<T>(body: ApiResponse<T>, status: number): Response {
  return Response.json({ ...body, status }, { status });
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string; eventId: string } }
): Promise<Response> {
  try {
    const userId = readUserId(request);
    if (!userId) return json<TravelEvent>({ error: 'Unauthorized', status: 401 }, 401);

    const canWrite = await hasWriteAccess(supabaseAdmin, userId, params.id);
    if (!canWrite) return json<TravelEvent>({ error: 'Forbidden', status: 403 }, 403);

    const updates: Partial<TravelEvent> = await request.json();
    const allowed: (keyof TravelEvent)[] = [
      'title',
      'event_type',
      'event_date',
      'event_time',
      'location',
      'description',
      'details',
      'status',
    ];
    const patch: Record<string, any> = {};
    for (const key of allowed) {
      if (key in updates) patch[key] = (updates as any)[key];
    }

    if (Object.keys(patch).length === 0) {
      return json<TravelEvent>({ error: 'No valid fields to update', status: 400 }, 400);
    }

    const { data: updated, error } = await supabaseAdmin
      .from('travel_events')
      .update(patch)
      .eq('id', params.eventId)
      .eq('travel_id', params.id)
      .select()
      .single();

    if (error || !updated) {
      console.error('Update event error:', error);
      return json<TravelEvent>(
        { error: error?.message || 'Failed to update event', status: 500 },
        500
      );
    }

    return json<TravelEvent>({ data: updated as TravelEvent, status: 200 }, 200);
  } catch (err) {
    console.error('PUT /events/:eventId error:', err);
    return json<TravelEvent>(
      { error: err instanceof Error ? err.message : 'Server error', status: 500 },
      500
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string; eventId: string } }
): Promise<Response> {
  try {
    const userId = readUserId(request);
    if (!userId) return json<TravelEvent>({ error: 'Unauthorized', status: 401 }, 401);

    const canWrite = await hasWriteAccess(supabaseAdmin, userId, params.id);
    if (!canWrite) return json<TravelEvent>({ error: 'Forbidden', status: 403 }, 403);

    const { error } = await supabaseAdmin
      .from('travel_events')
      .delete()
      .eq('id', params.eventId)
      .eq('travel_id', params.id);

    if (error) {
      console.error('Delete event error:', error);
      return json<TravelEvent>({ error: error.message, status: 500 }, 500);
    }

    return json<TravelEvent>({ message: 'Event deleted', status: 200 }, 200);
  } catch (err) {
    console.error('DELETE /events/:eventId error:', err);
    return json<TravelEvent>(
      { error: err instanceof Error ? err.message : 'Server error', status: 500 },
      500
    );
  }
}
