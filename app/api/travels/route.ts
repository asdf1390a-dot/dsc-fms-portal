import { NextRequest } from 'next/server';
import { supabaseAdmin } from '../../../lib/travel/supabase-client';
import { Travel, ApiResponse } from '../../../lib/travel/types';
import { successResponse, errorResponse, getAuthToken, validateDateRange } from '../../../lib/travel/utils';

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const token = getAuthToken(request);
    if (!token) return errorResponse('UNAUTHORIZED', 'Missing authorization token', null, 401);

    const { name, start_date, end_date, location, description } = await request.json();

    // Validation
    if (!name || !start_date || !end_date) {
      return errorResponse('INVALID_INPUT', 'Missing required fields: name, start_date, end_date');
    }

    if (!validateDateRange(start_date, end_date)) {
      return errorResponse('INVALID_DATE', 'End date must be after or equal to start date');
    }

    // Get user from token
    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return errorResponse('AUTH_ERROR', 'Failed to authenticate user', null, 401);
    }

    // Create travel
    const { data: travel, error: travelError } = await supabaseAdmin
      .from('travels')
      .insert({
        user_id: user.id,
        name,
        start_date,
        end_date,
        location,
        description,
        status: 'upcoming',
      })
      .select()
      .single();

    if (travelError) throw travelError;

    // Add creator as organizer member
    const { error: memberError } = await supabaseAdmin.from('travel_members').insert({
      travel_id: travel.id,
      user_id: user.id,
      role: 'organizer',
      permission: 'read_write',
    });

    if (memberError) throw memberError;

    // Create default notification rules
    const defaultRules = [
      { rule_type: 'days_before_departure', rule_config: { days: 7, channels: ['in_app', 'email'] } },
      { rule_type: 'days_before_departure', rule_config: { days: 1, channels: ['in_app', 'email'] } },
      { rule_type: 'days_before_departure', rule_config: { days: 0, hours: 24, channels: ['in_app', 'email'] } },
    ];

    await supabaseAdmin.from('travel_notification_rules').insert(
      defaultRules.map((rule) => ({
        travel_id: travel.id,
        ...rule,
        is_enabled: true,
      }))
    );

    return successResponse(travel, 'Travel created successfully', 201);
  } catch (err) {
    console.error('POST /api/travels error:', err);
    return errorResponse('SERVER_ERROR', 'Failed to create travel', err, 500);
  }
}

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const token = getAuthToken(request);
    if (!token) return errorResponse('UNAUTHORIZED', 'Missing authorization token', null, 401);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const sortBy = searchParams.get('sortBy') || 'start_date';
    const order = searchParams.get('order') || 'asc';

    // Get user from token
    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return errorResponse('AUTH_ERROR', 'Failed to authenticate user', null, 401);
    }

    // Query: travels where user is creator or member
    let query = supabaseAdmin
      .from('travels')
      .select(
        `
        *,
        travel_members(count),
        travel_costs(amount)
      `
      )
      .or(`user_id.eq.${user.id},travel_members.user_id.eq.${user.id}`);

    if (status) {
      query = query.eq('status', status);
    }

    query = query.order(sortBy, { ascending: order === 'asc' });

    const { data: travels, error } = await query;

    if (error) throw error;

    return successResponse(travels, 'Travels retrieved successfully');
  } catch (err) {
    console.error('GET /api/travels error:', err);
    return errorResponse('SERVER_ERROR', 'Failed to retrieve travels', err, 500);
  }
}
