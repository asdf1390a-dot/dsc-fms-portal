// app/api/travels/[id]/costs/route.ts
// GET: 비용 목록 조회 / 정산 계산표
// POST: 비용 추가 (splits 자동 생성)

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import {
  TravelCost,
  ApiResponse,
  ApiResponseList,
} from '@/types/travel';
import { calculateSettlement, SettlementSummary } from '@/lib/travel/settlement';
import {
  hasWriteAccess,
  hasReadAccess,
  validateCostAmount,
  validateCostSplits,
} from '@/lib/travel/service';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface RouteParams {
  params: {
    id: string;
  };
}

export const dynamic = 'force-dynamic';

// GET: 비용 목록
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json(
        { error: 'User not authenticated', status: 401 },
        { status: 401 }
      );
    }

    const { id } = params;
    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get('endpoint');

    // Check read access
    const hasAccess = await hasReadAccess(supabase, userId, id);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Access denied', status: 403 },
        { status: 403 }
      );
    }

    // Settlement endpoint
    if (endpoint === 'settlement') {
      const summary = await calculateSettlement(supabase, id);
      const response: ApiResponse<SettlementSummary> = {
        data: summary,
        status: 200,
      };
      return NextResponse.json(response);
    }

    // Get costs with splits
    const { data: costs, error } = await supabase
      .from('travel_costs')
      .select(
        `
      id,
      travel_id,
      payer_id,
      title,
      amount,
      currency,
      cost_type,
      payment_method,
      cost_date,
      created_at,
      updated_at,
      splits:travel_cost_splits(*)
    `
      )
      .eq('travel_id', id)
      .order('cost_date', { ascending: false });

    if (error) throw error;

    const response: ApiResponseList<TravelCost> = {
      data: costs as TravelCost[],
      status: 200,
    };
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching costs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch costs', status: 500 },
      { status: 500 }
    );
  }
}

// POST: 비용 추가
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json(
        { error: 'User not authenticated', status: 401 },
        { status: 401 }
      );
    }

    const { id } = params;
    const body = await request.json();
    const { title, amount, currency = 'INR', cost_type, payment_method, cost_date, splits } = body;

    // Validate inputs
    if (!title || !cost_date) {
      return NextResponse.json(
        { error: 'title and cost_date are required', status: 400 },
        { status: 400 }
      );
    }

    if (!amount && amount !== 0) {
      return NextResponse.json(
        { error: 'amount is required', status: 400 },
        { status: 400 }
      );
    }

    const amountValidation = validateCostAmount(amount);
    if (!amountValidation.valid) {
      return NextResponse.json(
        { error: amountValidation.error, status: 400 },
        { status: 400 }
      );
    }

    if (splits) {
      const splitsValidation = validateCostSplits(amount, splits);
      if (!splitsValidation.valid) {
        return NextResponse.json(
          { error: splitsValidation.error, status: 400 },
          { status: 400 }
        );
      }
    }

    // Check write access
    const canWrite = await hasWriteAccess(supabase, userId, id);
    if (!canWrite) {
      return NextResponse.json(
        { error: 'You do not have write permission', status: 403 },
        { status: 403 }
      );
    }

    // Create cost
    const { data: cost, error: costError } = await supabase
      .from('travel_costs')
      .insert({
        travel_id: id,
        payer_id: userId,
        title,
        amount,
        currency,
        cost_type: cost_type || null,
        payment_method: payment_method || null,
        cost_date,
      })
      .select()
      .single();

    if (costError) throw costError;

    // Create splits if provided
    if (splits && splits.length > 0) {
      const splitRecords = splits.map((split: any) => ({
        cost_id: cost.id,
        member_id: split.member_id,
        amount: split.amount,
      }));

      const { error: splitsError } = await supabase
        .from('travel_cost_splits')
        .insert(splitRecords);

      if (splitsError) throw splitsError;

      // Fetch cost with splits
      const { data: costWithSplits } = await supabase
        .from('travel_costs')
        .select(
          `
        *,
        splits:travel_cost_splits(*)
      `
        )
        .eq('id', cost.id)
        .single();

      const response: ApiResponse<TravelCost> = {
        data: costWithSplits as TravelCost,
        message: 'Cost created successfully',
        status: 201,
      };
      return NextResponse.json(response, { status: 201 });
    }

    const response: ApiResponse<TravelCost> = {
      data: cost as TravelCost,
      message: 'Cost created successfully',
      status: 201,
    };
    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Error creating cost:', error);
    return NextResponse.json(
      { error: 'Failed to create cost', status: 500 },
      { status: 500 }
    );
  }
}
