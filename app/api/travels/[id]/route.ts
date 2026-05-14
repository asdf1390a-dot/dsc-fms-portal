import { NextRequest } from 'next/server';
import { supabaseAdmin } from '../../../../lib/travel/supabase-client';
import { successResponse, errorResponse, getAuthToken } from '../../../../lib/travel/utils';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = getAuthToken(request);
    if (!token) return errorResponse('UNAUTHORIZED', 'Missing authorization token', null, 401);

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) return errorResponse('AUTH_ERROR', 'Failed to authenticate user', null, 401);

    const { data: travel, error } = await supabaseAdmin
      .from('travels')
      .select(`
        *,
        travel_members(*),
        travel_events(*),
        travel_costs(*),
        travel_checklist_items(*),
        travel_documents(*),
        travel_notification_rules(*)
      `)
      .eq('id', params.id)
      .single();

    if (error || !travel) {
      return errorResponse('NOT_FOUND', 'Travel not found', error, 404);
    }

    const { data: members } = await supabaseAdmin
      .from('travel_members')
      .select('user_id')
      .eq('travel_id', travel.id);

    const isMember = travel.user_id === user.id || members?.some(m => m.user_id === user.id);
    if (!isMember) {
      return errorResponse('FORBIDDEN', 'You do not have access to this travel', null, 403);
    }

    return successResponse(travel, 'Travel retrieved successfully');
  } catch (err) {
    console.error('GET /api/travels/[id] error:', err);
    return errorResponse('SERVER_ERROR', 'Failed to retrieve travel', err, 500);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = getAuthToken(request);
    if (!token) return errorResponse('UNAUTHORIZED', 'Missing authorization token', null, 401);

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) return errorResponse('AUTH_ERROR', 'Failed to authenticate user', null, 401);

    const { data: travel } = await supabaseAdmin
      .from('travels')
      .select('user_id')
      .eq('id', params.id)
      .single();

    if (!travel || travel.user_id !== user.id) {
      return errorResponse('FORBIDDEN', 'Only the travel creator can update this travel', null, 403);
    }

    const body = await request.json();
    const { name, location, start_date, end_date, description, status } = body;

    const { data: updated, error } = await supabaseAdmin
      .from('travels')
      .update({
        ...(name && { name }),
        ...(location && { location }),
        ...(start_date && { start_date }),
        ...(end_date && { end_date }),
        ...(description && { description }),
        ...(status && { status }),
      })
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      return errorResponse('UPDATE_FAILED', 'Failed to update travel', error, 500);
    }

    return successResponse(updated, 'Travel updated successfully');
  } catch (err) {
    console.error('PATCH /api/travels/[id] error:', err);
    return errorResponse('SERVER_ERROR', 'Failed to update travel', err, 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = getAuthToken(request);
    if (!token) return errorResponse('UNAUTHORIZED', 'Missing authorization token', null, 401);

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) return errorResponse('AUTH_ERROR', 'Failed to authenticate user', null, 401);

    const { data: travel } = await supabaseAdmin
      .from('travels')
      .select('user_id')
      .eq('id', params.id)
      .single();

    if (!travel || travel.user_id !== user.id) {
      return errorResponse('FORBIDDEN', 'Only the travel creator can delete this travel', null, 403);
    }

    const { error } = await supabaseAdmin
      .from('travels')
      .delete()
      .eq('id', params.id);

    if (error) {
      return errorResponse('DELETE_FAILED', 'Failed to delete travel', error, 500);
    }

    return successResponse(null, 'Travel deleted successfully');
  } catch (err) {
    console.error('DELETE /api/travels/[id] error:', err);
    return errorResponse('SERVER_ERROR', 'Failed to delete travel', err, 500);
  }
}
