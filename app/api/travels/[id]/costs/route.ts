// app/api/travels/[id]/costs/route.ts
// GET  — list costs of a travel (read access)
// POST — create a cost with optional splits (write access)

import { supabaseAdmin } from '@/lib/travel/supabase-client';
import {
  hasReadAccess,
  hasWriteAccess,
  getTravelCosts,
  validateCostAmount,
  validateCostSplits,
} from '@/lib/travel/service';
import type {
  TravelCost,
  CreateTravelCostRequest,
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
    if (!userId) return json<TravelCost[]>({ error: 'Unauthorized', status: 401 }, 401);

    const canRead = await hasReadAccess(supabaseAdmin, userId, params.id);
    if (!canRead) return json<TravelCost[]>({ error: 'Forbidden', status: 403 }, 403);

    const costs = await getTravelCosts(supabaseAdmin, params.id);
    return json<TravelCost[]>({ data: costs as TravelCost[], status: 200 }, 200);
  } catch (err) {
    console.error('GET /costs error:', err);
    return json<TravelCost[]>(
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
    if (!userId) return json<TravelCost>({ error: 'Unauthorized', status: 401 }, 401);

    const canWrite = await hasWriteAccess(supabaseAdmin, userId, params.id);
    if (!canWrite) return json<TravelCost>({ error: 'Forbidden', status: 403 }, 403);

    const payload: CreateTravelCostRequest = await request.json();

    if (!payload.title || payload.amount == null || !payload.cost_date) {
      return json<TravelCost>(
        { error: 'title, amount, cost_date are required', status: 400 },
        400
      );
    }

    const amountCheck = validateCostAmount(payload.amount);
    if (!amountCheck.valid) {
      return json<TravelCost>({ error: amountCheck.error, status: 400 }, 400);
    }

    if (payload.splits && payload.splits.length > 0) {
      const splitsCheck = validateCostSplits(payload.amount, payload.splits);
      if (!splitsCheck.valid) {
        return json<TravelCost>({ error: splitsCheck.error, status: 400 }, 400);
      }
    }

    // Find the payer's travel_members row to use as payer_id
    const { data: payerMember } = await supabaseAdmin
      .from('travel_members')
      .select('id')
      .eq('travel_id', params.id)
      .eq('user_id', userId)
      .maybeSingle();

    const payerId = payerMember?.id || userId;

    const { data: cost, error: costError } = await supabaseAdmin
      .from('travel_costs')
      .insert([
        {
          travel_id: params.id,
          payer_id: payerId,
          title: payload.title,
          amount: payload.amount,
          currency: payload.currency || 'INR',
          cost_type: payload.cost_type || 'other',
          payment_method: payload.payment_method || null,
          cost_date: payload.cost_date,
        },
      ])
      .select()
      .single();

    if (costError || !cost) {
      console.error('Insert cost error:', costError);
      return json<TravelCost>(
        { error: costError?.message || 'Failed to create cost', status: 500 },
        500
      );
    }

    if (payload.splits && payload.splits.length > 0) {
      const splitRows = payload.splits.map((s) => ({
        cost_id: cost.id,
        member_id: s.member_id,
        amount: s.amount,
      }));

      const { error: splitError } = await supabaseAdmin
        .from('travel_cost_splits')
        .insert(splitRows);

      if (splitError) {
        console.error('Insert splits error:', splitError);
        // Cost is already created; report partial failure
        return json<TravelCost>(
          { error: `Cost saved but splits failed: ${splitError.message}`, status: 500 },
          500
        );
      }
    }

    return json<TravelCost>({ data: cost as TravelCost, status: 201 }, 201);
  } catch (err) {
    console.error('POST /costs error:', err);
    return json<TravelCost>(
      { error: err instanceof Error ? err.message : 'Server error', status: 500 },
      500
    );
  }
}
