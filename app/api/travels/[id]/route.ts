// app/api/travels/[id]/route.ts
// GET    /api/travels/:id  — fetch travel with relations
// PUT    /api/travels/:id  — update travel (organizer or read_write member)
// DELETE /api/travels/:id  — delete travel (organizer only)

import { supabaseAdmin } from '@/lib/travel/supabase-client';
import {
  getTravelWithRelations,
  hasReadAccess,
  hasWriteAccess,
  isOrganizer,
  validateTravelDates,
} from '@/lib/travel/service';
import type { Travel, ApiResponse } from '@/types/travel';

function readUserId(request: Request): string | null {
  return request.headers.get('x-user-id');
}

function json<T>(body: ApiResponse<T>, status: number): Response {
  return Response.json({ ...body, status }, { status });
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
): Promise<Response> {
  try {
    const userId = readUserId(request);
    if (!userId) return json<Travel>({ error: 'Unauthorized', status: 401 }, 401);

    const canRead = await hasReadAccess(supabaseAdmin, userId, params.id);
    if (!canRead) {
      return json<Travel>({ error: 'Forbidden', status: 403 }, 403);
    }

    const travel = await getTravelWithRelations(supabaseAdmin, params.id);
    if (!travel) {
      return json<Travel>({ error: 'Travel not found', status: 404 }, 404);
    }

    return json<Travel>({ data: travel as Travel, status: 200 }, 200);
  } catch (err) {
    console.error('GET /api/travels/:id error:', err);
    return json<Travel>(
      { error: err instanceof Error ? err.message : 'Server error', status: 500 },
      500
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
): Promise<Response> {
  try {
    const userId = readUserId(request);
    if (!userId) return json<Travel>({ error: 'Unauthorized', status: 401 }, 401);

    const canWrite = await hasWriteAccess(supabaseAdmin, userId, params.id);
    if (!canWrite) {
      return json<Travel>({ error: 'Forbidden', status: 403 }, 403);
    }

    const updates: Partial<Travel> = await request.json();
    const allowed: (keyof Travel)[] = [
      'name',
      'description',
      'start_date',
      'end_date',
      'location',
      'status',
    ];
    const patch: Record<string, any> = {};
    for (const key of allowed) {
      if (key in updates) patch[key] = (updates as any)[key];
    }

    if (patch.start_date && patch.end_date) {
      const dateCheck = validateTravelDates(patch.start_date, patch.end_date);
      if (!dateCheck.valid) {
        return json<Travel>({ error: dateCheck.error, status: 400 }, 400);
      }
    }

    if (Object.keys(patch).length === 0) {
      return json<Travel>({ error: 'No valid fields to update', status: 400 }, 400);
    }

    const { data: updated, error } = await supabaseAdmin
      .from('travels')
      .update(patch)
      .eq('id', params.id)
      .select()
      .single();

    if (error || !updated) {
      console.error('Update travel error:', error);
      return json<Travel>(
        { error: error?.message || 'Failed to update travel', status: 500 },
        500
      );
    }

    return json<Travel>({ data: updated as Travel, status: 200 }, 200);
  } catch (err) {
    console.error('PUT /api/travels/:id error:', err);
    return json<Travel>(
      { error: err instanceof Error ? err.message : 'Server error', status: 500 },
      500
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
): Promise<Response> {
  try {
    const userId = readUserId(request);
    if (!userId) return json<Travel>({ error: 'Unauthorized', status: 401 }, 401);

    const isOrg = await isOrganizer(supabaseAdmin, userId, params.id);
    if (!isOrg) {
      return json<Travel>({ error: 'Only organizer can delete', status: 403 }, 403);
    }

    const { error } = await supabaseAdmin
      .from('travels')
      .delete()
      .eq('id', params.id);

    if (error) {
      console.error('Delete travel error:', error);
      return json<Travel>({ error: error.message, status: 500 }, 500);
    }

    return json<Travel>({ message: 'Travel deleted', status: 200 }, 200);
  } catch (err) {
    console.error('DELETE /api/travels/:id error:', err);
    return json<Travel>(
      { error: err instanceof Error ? err.message : 'Server error', status: 500 },
      500
    );
  }
}
