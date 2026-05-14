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

    const { data: rules, error } = await supabaseAdmin
      .from('travel_notification_rules')
      .select('*')
      .eq('travel_id', params.id)
      .order('created_at', { ascending: false });

    if (error) {
      return errorResponse('FETCH_FAILED', 'Failed to fetch notification rules', error, 500);
    }

    return successResponse(rules || [], 'Notification rules retrieved successfully');
  } catch (err) {
    console.error('GET /api/travels/[id]/notifications error:', err);
    return errorResponse('SERVER_ERROR', 'Failed to retrieve notification rules', err, 500);
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

    const { data: member } = await supabaseAdmin
      .from('travel_members')
      .select('role')
      .eq('travel_id', params.id)
      .eq('user_id', user.id)
      .single();

    if (!member || member.role !== 'organizer') {
      return errorResponse('FORBIDDEN', 'Only organizers can modify notification rules', null, 403);
    }

    const body = await request.json();
    const { ruleId, is_enabled } = body;

    if (!ruleId) {
      return errorResponse('INVALID_INPUT', 'Missing ruleId');
    }

    const { data: updated, error } = await supabaseAdmin
      .from('travel_notification_rules')
      .update({ is_enabled })
      .eq('id', ruleId)
      .eq('travel_id', params.id)
      .select()
      .single();

    if (error || !updated) {
      return errorResponse('UPDATE_FAILED', 'Failed to update notification rule', error, 500);
    }

    return successResponse(updated, 'Notification rule updated successfully');
  } catch (err) {
    console.error('PATCH /api/travels/[id]/notifications error:', err);
    return errorResponse('SERVER_ERROR', 'Failed to update notification rule', err, 500);
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

    const { data: member } = await supabaseAdmin
      .from('travel_members')
      .select('role')
      .eq('travel_id', params.id)
      .eq('user_id', user.id)
      .single();

    if (!member || member.role !== 'organizer') {
      return errorResponse('FORBIDDEN', 'Only organizers can delete notification rules', null, 403);
    }

    const body = await request.json();
    const { ruleId } = body;

    if (!ruleId) {
      return errorResponse('INVALID_INPUT', 'Missing ruleId');
    }

    const { error } = await supabaseAdmin
      .from('travel_notification_rules')
      .delete()
      .eq('id', ruleId)
      .eq('travel_id', params.id);

    if (error) {
      return errorResponse('DELETE_FAILED', 'Failed to delete notification rule', error, 500);
    }

    return successResponse(null, 'Notification rule deleted successfully');
  } catch (err) {
    console.error('DELETE /api/travels/[id]/notifications error:', err);
    return errorResponse('SERVER_ERROR', 'Failed to delete notification rule', err, 500);
  }
}
