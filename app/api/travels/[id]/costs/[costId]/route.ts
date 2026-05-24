// app/api/travels/[id]/costs/[costId]/route.ts
// PUT    — update cost (write access)
// DELETE — delete cost (write access; splits cascade via FK)

import { supabaseAdmin } from '@/lib/travel/supabase-client';
import {
  hasWriteAccess,
  validateCostAmount,
  validateCostSplits,
} from '@/lib/travel/service';
import type { TravelCost, ApiResponse } from '@/types/travel';

function readUserId(request: Request): string | null {
  return request.headers.get('x-user-id');
}

function json<T>(body: ApiResponse<T>, status: number): Response {
  return Response.json({ ...body, status }, { status });
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string; costId: string } }
): Promise<Response> {
  try {
    const userId = readUserId(request);
    if (!userId) return json<TravelCost>({ error: 'Unauthorized', status: 401 }, 401);

    const canWrite = await hasWriteAccess(supabaseAdmin, userId, params.id);
    if (!canWrite) return json<TravelCost>({ error: 'Forbidden', status: 403 }, 403);

    const body: Partial<TravelCost> & { splits?: Array<{ member_id: string; amount: number }> } =
      await request.json();

    const allowed: (keyof TravelCost)[] = [
      'title',
      'amount',
      'currency',
      'cost_type',
      'payment_method',
      'cost_date',
    ];
    const patch: Record<string, any> = {};
    for (const key of allowed) {
      if (key in body) patch[key] = (body as any)[key];
    }

    if (patch.amount !== undefined) {
      const amountCheck = validateCostAmount(patch.amount);
      if (!amountCheck.valid) {
        return json<TravelCost>({ error: amountCheck.error, status: 400 }, 400);
      }
    }

    if (body.splits && body.splits.length > 0 && patch.amount !== undefined) {
      const splitsCheck = validateCostSplits(patch.amount, body.splits);
      if (!splitsCheck.valid) {
        return json<TravelCost>({ error: splitsCheck.error, status: 400 }, 400);
      }
    }

    if (Object.keys(patch).length === 0 && !body.splits) {
      return json<TravelCost>({ error: 'No valid fields to update', status: 400 }, 400);
    }

    let updated: any = null;
    if (Object.keys(patch).length > 0) {
      const { data, error } = await supabaseAdmin
        .from('travel_costs')
        .update(patch)
        .eq('id', params.costId)
        .eq('travel_id', params.id)
        .select()
        .single();

      if (error || !data) {
        console.error('Update cost error:', error);
        return json<TravelCost>(
          { error: error?.message || 'Failed to update cost', status: 500 },
          500
        );
      }
      updated = data;
    }

    // Replace splits if provided
    if (body.splits) {
      await supabaseAdmin
        .from('travel_cost_splits')
        .delete()
        .eq('cost_id', params.costId);

      if (body.splits.length > 0) {
        const splitRows = body.splits.map((s) => ({
          cost_id: params.costId,
          member_id: s.member_id,
          amount: s.amount,
        }));
        const { error: splitErr } = await supabaseAdmin
          .from('travel_cost_splits')
          .insert(splitRows);
        if (splitErr) {
          console.error('Replace splits error:', splitErr);
          return json<TravelCost>(
            { error: `Cost updated but splits failed: ${splitErr.message}`, status: 500 },
            500
          );
        }
      }
    }

    if (!updated) {
      const { data } = await supabaseAdmin
        .from('travel_costs')
        .select('*')
        .eq('id', params.costId)
        .single();
      updated = data;
    }

    return json<TravelCost>({ data: updated as TravelCost, status: 200 }, 200);
  } catch (err) {
    console.error('PUT /costs/:costId error:', err);
    return json<TravelCost>(
      { error: err instanceof Error ? err.message : 'Server error', status: 500 },
      500
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string; costId: string } }
): Promise<Response> {
  try {
    const userId = readUserId(request);
    if (!userId) return json<TravelCost>({ error: 'Unauthorized', status: 401 }, 401);

    const canWrite = await hasWriteAccess(supabaseAdmin, userId, params.id);
    if (!canWrite) return json<TravelCost>({ error: 'Forbidden', status: 403 }, 403);

    const { error } = await supabaseAdmin
      .from('travel_costs')
      .delete()
      .eq('id', params.costId)
      .eq('travel_id', params.id);

    if (error) {
      console.error('Delete cost error:', error);
      return json<TravelCost>({ error: error.message, status: 500 }, 500);
    }

    return json<TravelCost>({ message: 'Cost deleted', status: 200 }, 200);
  } catch (err) {
    console.error('DELETE /costs/:costId error:', err);
    return json<TravelCost>(
      { error: err instanceof Error ? err.message : 'Server error', status: 500 },
      500
    );
  }
}
