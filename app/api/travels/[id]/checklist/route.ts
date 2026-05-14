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

    const { data: items, error } = await supabaseAdmin
      .from('travel_checklist_items')
      .select('*')
      .eq('travel_id', params.id)
      .order('created_at', { ascending: false });

    if (error) {
      return errorResponse('FETCH_FAILED', 'Failed to fetch checklist items', error, 500);
    }

    return successResponse(items || [], 'Checklist items retrieved successfully');
  } catch (err) {
    console.error('GET /api/travels/[id]/checklist error:', err);
    return errorResponse('SERVER_ERROR', 'Failed to retrieve checklist items', err, 500);
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
      return errorResponse('FORBIDDEN', 'You do not have permission to add checklist items', null, 403);
    }

    const body = await request.json();
    const { title, category, priority, notes } = body;

    if (!title) {
      return errorResponse('INVALID_INPUT', 'Missing required field: title');
    }

    const { data: item, error } = await supabaseAdmin
      .from('travel_checklist_items')
      .insert({
        travel_id: params.id,
        title,
        category: category || 'custom',
        priority: priority || 'medium',
        notes: notes || null,
        is_completed: false,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      return errorResponse('CREATE_FAILED', 'Failed to create checklist item', error, 500);
    }

    return successResponse(item, 'Checklist item created successfully', 201);
  } catch (err) {
    console.error('POST /api/travels/[id]/checklist error:', err);
    return errorResponse('SERVER_ERROR', 'Failed to create checklist item', err, 500);
  }
}
