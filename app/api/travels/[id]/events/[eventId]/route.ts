import { NextRequest } from 'next/server';
import { supabaseAdmin } from '../../../../../../lib/travel/supabase-client';
import { successResponse, errorResponse, getAuthToken } from '../../../../../../lib/travel/utils';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; eventId: string } }
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
      return errorResponse('FORBIDDEN', 'You do not have permission to update events', null, 403);
    }

    const body = await request.json();
    const { data: updated, error } = await supabaseAdmin
      .from('travel_events')
      .update(body)
      .eq('id', params.eventId)
      .eq('travel_id', params.id)
      .select()
      .single();

    if (error || !updated) {
      return errorResponse('UPDATE_FAILED', 'Failed to update event', error, 500);
    }

    return successResponse(updated, 'Event updated successfully');
  } catch (err) {
    console.error('PATCH event error:', err);
    return errorResponse('SERVER_ERROR', 'Failed to update event', err, 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; eventId: string } }
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
      return errorResponse('FORBIDDEN', 'You do not have permission to delete events', null, 403);
    }

    const { error } = await supabaseAdmin
      .from('travel_events')
      .delete()
      .eq('id', params.eventId)
      .eq('travel_id', params.id);

    if (error) {
      return errorResponse('DELETE_FAILED', 'Failed to delete event', error, 500);
    }

    return successResponse(null, 'Event deleted successfully');
  } catch (err) {
    console.error('DELETE event error:', err);
    return errorResponse('SERVER_ERROR', 'Failed to delete event', err, 500);
  }
}
