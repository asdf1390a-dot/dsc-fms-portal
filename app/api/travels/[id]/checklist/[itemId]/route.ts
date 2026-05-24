// app/api/travels/[id]/checklist/[itemId]/route.ts
// PUT    — update checklist item (write access)
// DELETE — delete checklist item (write access)

import { supabaseAdmin } from '@/lib/travel/supabase-client';
import { hasWriteAccess } from '@/lib/travel/service';
import type { TravelChecklistItem, ApiResponse } from '@/types/travel';

function readUserId(request: Request): string | null {
  return request.headers.get('x-user-id');
}

function json<T>(body: ApiResponse<T>, status: number): Response {
  return Response.json({ ...body, status }, { status });
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string; itemId: string } }
): Promise<Response> {
  try {
    const userId = readUserId(request);
    if (!userId) return json<TravelChecklistItem>({ error: 'Unauthorized', status: 401 }, 401);

    const canWrite = await hasWriteAccess(supabaseAdmin, userId, params.id);
    if (!canWrite) return json<TravelChecklistItem>({ error: 'Forbidden', status: 403 }, 403);

    const updates: Partial<TravelChecklistItem> = await request.json();
    const allowed: (keyof TravelChecklistItem)[] = [
      'title',
      'category',
      'priority',
      'notes',
      'is_completed',
    ];
    const patch: Record<string, any> = {};
    for (const key of allowed) {
      if (key in updates) patch[key] = (updates as any)[key];
    }

    if (Object.keys(patch).length === 0) {
      return json<TravelChecklistItem>(
        { error: 'No valid fields to update', status: 400 },
        400
      );
    }

    const { data: updated, error } = await supabaseAdmin
      .from('travel_checklist_items')
      .update(patch)
      .eq('id', params.itemId)
      .eq('travel_id', params.id)
      .select()
      .single();

    if (error || !updated) {
      console.error('Update checklist item error:', error);
      return json<TravelChecklistItem>(
        { error: error?.message || 'Failed to update checklist item', status: 500 },
        500
      );
    }

    return json<TravelChecklistItem>(
      { data: updated as TravelChecklistItem, status: 200 },
      200
    );
  } catch (err) {
    console.error('PUT /checklist/:itemId error:', err);
    return json<TravelChecklistItem>(
      { error: err instanceof Error ? err.message : 'Server error', status: 500 },
      500
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string; itemId: string } }
): Promise<Response> {
  try {
    const userId = readUserId(request);
    if (!userId) return json<TravelChecklistItem>({ error: 'Unauthorized', status: 401 }, 401);

    const canWrite = await hasWriteAccess(supabaseAdmin, userId, params.id);
    if (!canWrite) return json<TravelChecklistItem>({ error: 'Forbidden', status: 403 }, 403);

    const { error } = await supabaseAdmin
      .from('travel_checklist_items')
      .delete()
      .eq('id', params.itemId)
      .eq('travel_id', params.id);

    if (error) {
      console.error('Delete checklist item error:', error);
      return json<TravelChecklistItem>({ error: error.message, status: 500 }, 500);
    }

    return json<TravelChecklistItem>({ message: 'Checklist item deleted', status: 200 }, 200);
  } catch (err) {
    console.error('DELETE /checklist/:itemId error:', err);
    return json<TravelChecklistItem>(
      { error: err instanceof Error ? err.message : 'Server error', status: 500 },
      500
    );
  }
}
