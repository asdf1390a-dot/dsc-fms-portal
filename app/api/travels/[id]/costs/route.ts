import { NextRequest } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/travel/supabase-client';
import { successResponse, errorResponse, getAuthToken } from '../../../../../lib/travel/utils';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = getAuthToken(request);
    if (!token) return errorResponse('UNAUTHORIZED', 'Missing authorization token', null, 401);

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) return errorResponse('AUTH_ERROR', 'Failed to authenticate user', null, 401);

    const { data: members } = await supabaseAdmin
      .from('travel_members')
      .select('user_id')
      .eq('travel_id', params.id);

    const { data: travel } = await supabaseAdmin
      .from('travels')
      .select('user_id')
      .eq('id', params.id)
      .single();

    const isMember = travel?.user_id === user.id || members?.some(m => m.user_id === user.id);
    if (!isMember) {
      return errorResponse('FORBIDDEN', 'You do not have access to this travel', null, 403);
    }

    const { data: costs, error } = await supabaseAdmin
      .from('travel_costs')
      .select('*')
      .eq('travel_id', params.id)
      .order('cost_date', { ascending: false });

    if (error) {
      return errorResponse('FETCH_FAILED', 'Failed to fetch costs', error, 500);
    }

    return successResponse(costs || [], 'Costs retrieved successfully');
  } catch (err) {
    console.error('GET /api/travels/[id]/costs error:', err);
    return errorResponse('SERVER_ERROR', 'Failed to retrieve costs', err, 500);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = getAuthToken(request);
    if (!token) return errorResponse('UNAUTHORIZED', 'Missing authorization token', null, 401);

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) return errorResponse('AUTH_ERROR', 'Failed to authenticate user', null, 401);

    const { data: member } = await supabaseAdmin
      .from('travel_members')
      .select('permission')
      .eq('travel_id', params.id)
      .eq('user_id', user.id)
      .single();

    if (!member || member.permission !== 'read_write') {
      return errorResponse('FORBIDDEN', 'You do not have permission to add costs', null, 403);
    }

    const body = await request.json();
    const { title, amount, currency, cost_type, payment_method, cost_date } = body;

    if (!title || !amount || !cost_type || !cost_date) {
      return errorResponse('INVALID_INPUT', 'Missing required fields: title, amount, cost_type, cost_date');
    }

    if (amount < 0) {
      return errorResponse('INVALID_INPUT', 'Amount must be non-negative');
    }

    const { data: cost, error } = await supabaseAdmin
      .from('travel_costs')
      .insert({
        travel_id: params.id,
        payer_id: user.id,
        title,
        amount,
        currency: currency || 'INR',
        cost_type,
        payment_method: payment_method || 'card',
        cost_date,
      })
      .select()
      .single();

    if (error) {
      return errorResponse('CREATE_FAILED', 'Failed to create cost', error, 500);
    }

    return successResponse(cost, 'Cost created successfully', 201);
  } catch (err) {
    console.error('POST /api/travels/[id]/costs error:', err);
    return errorResponse('SERVER_ERROR', 'Failed to create cost', err, 500);
  }
}
