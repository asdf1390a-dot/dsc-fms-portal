// app/api/travels/[id]/checklist/route.ts
// GET  — list checklist items (read access)
// POST — create checklist item (write access)

import { supabaseAdmin } from '@/lib/travel/supabase-client';
import { hasReadAccess, hasWriteAccess } from '@/lib/travel/service';
import type {
  TravelChecklistItem,
  CreateChecklistItemRequest,
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
    if (!userId) return json<TravelChecklistItem[]>({ error: 'Unauthorized', status: 401 }, 401);

    const canRead = await hasReadAccess(supabaseAdmin, userId, params.id);
    if (!canRead) return json<TravelChecklistItem[]>({ error: 'Forbidden', status: 403 }, 403);

    const { data, error } = await supabaseAdmin
      .from('travel_checklist_items')
      .select('*')
      .eq('travel_id', params.id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Fetch checklist error:', error);
      return json<TravelChecklistItem[]>({ error: error.message, status: 500 }, 500);
    }

    return json<TravelChecklistItem[]>(
      { data: (data || []) as TravelChecklistItem[], status: 200 },
      200
    );
  } catch (err) {
    console.error('GET /checklist error:', err);
    return json<TravelChecklistItem[]>(
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
    if (!userId) return json<TravelChecklistItem>({ error: 'Unauthorized', status: 401 }, 401);

    const canWrite = await hasWriteAccess(supabaseAdmin, userId, params.id);
    if (!canWrite) return json<TravelChecklistItem>({ error: 'Forbidden', status: 403 }, 403);

    const payload: CreateChecklistItemRequest = await request.json();
    if (!payload.title) {
      return json<TravelChecklistItem>({ error: 'title is required', status: 400 }, 400);
    }

    const { data, error } = await supabaseAdmin
      .from('travel_checklist_items')
      .insert([
        {
          travel_id: params.id,
          title: payload.title,
          category: payload.category || 'custom',
          priority: payload.priority || 'medium',
          notes: payload.notes || null,
          is_completed: false,
          created_by: userId,
        },
      ])
      .select()
      .single();

    if (error || !data) {
      console.error('Insert checklist error:', error);
      return json<TravelChecklistItem>(
        { error: error?.message || 'Failed to create checklist item', status: 500 },
        500
      );
    }

    return json<TravelChecklistItem>({ data: data as TravelChecklistItem, status: 201 }, 201);
  } catch (err) {
    console.error('POST /checklist error:', err);
    return json<TravelChecklistItem>(
      { error: err instanceof Error ? err.message : 'Server error', status: 500 },
      500
    );
  }
}
