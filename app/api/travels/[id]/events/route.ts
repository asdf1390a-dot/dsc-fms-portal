import { NextRequest } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/travel/supabase-client';
import { successResponse, errorResponse, getAuthToken, validateDateRange } from '../../../../../lib/travel/utils';

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

    const { data: events, error } = await supabaseAdmin
      .from('travel_events')
      .select('*')
      .eq('travel_id', params.id)
      .order('event_date', { ascending: true });

    if (error) {
      return errorResponse('FETCH_FAILED', 'Failed to fetch events', error, 500);
    }

    return successResponse(events || [], 'Events retrieved successfully');
  } catch (err) {
    console.error('GET /api/travels/[id]/events error:', err);
    return errorResponse('SERVER_ERROR', 'Failed to retrieve events', err, 500);
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
      return errorResponse('FORBIDDEN', 'You do not have permission to add events', null, 403);
    }

    const body = await request.json();
    const { title, event_type, event_date, event_time, location, description, details, status } = body;

    if (!title || !event_type || !event_date) {
      return errorResponse('INVALID_INPUT', 'Missing required fields: title, event_type, event_date');
    }

    const { data: event, error } = await supabaseAdmin
      .from('travel_events')
      .insert({
        travel_id: params.id,
        title,
        event_type,
        event_date,
        event_time: event_time || null,
        location: location || null,
        description: description || null,
        details: details || null,
        status: status || 'planned',
      })
      .select()
      .single();

    if (error) {
      return errorResponse('CREATE_FAILED', 'Failed to create event', error, 500);
    }

    return successResponse(event, 'Event created successfully', 201);
  } catch (err) {
    console.error('POST /api/travels/[id]/events error:', err);
    return errorResponse('SERVER_ERROR', 'Failed to create event', err, 500);
  }
}
