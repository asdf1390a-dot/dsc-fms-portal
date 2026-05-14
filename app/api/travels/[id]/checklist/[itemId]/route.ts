import { NextRequest } from 'next/server';
import { supabaseAdmin } from '../../../../../../lib/travel/supabase-client';
import { successResponse, errorResponse, getAuthToken } from '../../../../../../lib/travel/utils';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; itemId: string } }
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
      return errorResponse('FORBIDDEN', 'You do not have permission to update checklist items', null, 403);
    }

    const body = await request.json();
    const { data: updated, error } = await supabaseAdmin
      .from('travel_checklist_items')
      .update(body)
      .eq('id', params.itemId)
      .eq('travel_id', params.id)
      .select()
      .single();

    if (error || !updated) {
      return errorResponse('UPDATE_FAILED', 'Failed to update checklist item', error, 500);
    }

    return successResponse(updated, 'Checklist item updated successfully');
  } catch (err) {
    console.error('PATCH checklist item error:', err);
    return errorResponse('SERVER_ERROR', 'Failed to update checklist item', err, 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; itemId: string } }
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
      return errorResponse('FORBIDDEN', 'You do not have permission to delete checklist items', null, 403);
    }

    const { error } = await supabaseAdmin
      .from('travel_checklist_items')
      .delete()
      .eq('id', params.itemId)
      .eq('travel_id', params.id);

    if (error) {
      return errorResponse('DELETE_FAILED', 'Failed to delete checklist item', error, 500);
    }

    return successResponse(null, 'Checklist item deleted successfully');
  } catch (err) {
    console.error('DELETE checklist item error:', err);
    return errorResponse('SERVER_ERROR', 'Failed to delete checklist item', err, 500);
  }
}
