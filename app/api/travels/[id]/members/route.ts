import { NextRequest } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/travel/supabase-client';
import { successResponse, errorResponse, getAuthToken, validateEmail } from '../../../../../lib/travel/utils';

export async function GET(request: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  try {
    const token = getAuthToken(request);
    if (!token) return errorResponse('UNAUTHORIZED', 'Missing authorization token', null, 401);

    const { id } = params;

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return errorResponse('AUTH_ERROR', 'Failed to authenticate user', null, 401);
    }

    // Check member access
    const { data: member } = await supabaseAdmin
      .from('travel_members')
      .select('*')
      .eq('travel_id', id)
      .eq('user_id', user.id)
      .single();

    if (!member) {
      return errorResponse('FORBIDDEN', 'You do not have access to this travel', null, 403);
    }

    const { data: members, error } = await supabaseAdmin
      .from('travel_members')
      .select('*')
      .eq('travel_id', id)
      .order('joined_at', { ascending: true });

    if (error) throw error;

    return successResponse(members, 'Members retrieved successfully');
  } catch (err) {
    console.error('GET /api/travels/[id]/members error:', err);
    return errorResponse('SERVER_ERROR', 'Failed to retrieve members', err, 500);
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  try {
    const token = getAuthToken(request);
    if (!token) return errorResponse('UNAUTHORIZED', 'Missing authorization token', null, 401);

    const { id } = params;
    const { email, role, permission } = await request.json();

    if (!email || !role || !permission) {
      return errorResponse('INVALID_INPUT', 'Missing required fields: email, role, permission');
    }

    if (!validateEmail(email)) {
      return errorResponse('INVALID_EMAIL', 'Invalid email address');
    }

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return errorResponse('AUTH_ERROR', 'Failed to authenticate user', null, 401);
    }

    // Check if user is organizer (has write permission)
    const { data: member } = await supabaseAdmin
      .from('travel_members')
      .select('permission, role')
      .eq('travel_id', id)
      .eq('user_id', user.id)
      .single();

    if (!member || member.permission !== 'read_write' || member.role !== 'organizer') {
      return errorResponse('FORBIDDEN', 'Only organizer can invite members', null, 403);
    }

    // Find user by email using admin API
    const { data, error: userSearchError } = await supabaseAdmin.auth.admin.listUsers();

    if (userSearchError) throw userSearchError;

    const existingUsers = data?.users || [];
    const invitedUser = existingUsers.find((u: any) => u.email === email);

    if (!invitedUser) {
      return errorResponse('USER_NOT_FOUND', 'User with this email does not exist');
    }

    // Check if already a member
    const { data: existingMember } = await supabaseAdmin
      .from('travel_members')
      .select('id')
      .eq('travel_id', id)
      .eq('user_id', invitedUser.id)
      .single();

    if (existingMember) {
      return errorResponse('ALREADY_MEMBER', 'User is already a member of this travel');
    }

    // Add member
    const { data: newMember, error } = await supabaseAdmin
      .from('travel_members')
      .insert({
        travel_id: id,
        user_id: invitedUser.id,
        role,
        permission,
      })
      .select()
      .single();

    if (error) throw error;

    return successResponse(newMember, 'Member added successfully', 201);
  } catch (err) {
    console.error('POST /api/travels/[id]/members error:', err);
    return errorResponse('SERVER_ERROR', 'Failed to add member', err, 500);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  try {
    const token = getAuthToken(request);
    if (!token) return errorResponse('UNAUTHORIZED', 'Missing authorization token', null, 401);

    const { id } = params;
    const { memberId, role, permission } = await request.json();

    if (!memberId) {
      return errorResponse('INVALID_INPUT', 'Missing required field: memberId');
    }

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return errorResponse('AUTH_ERROR', 'Failed to authenticate user', null, 401);
    }

    // Check if user is organizer
    const { data: currentMember } = await supabaseAdmin
      .from('travel_members')
      .select('permission, role')
      .eq('travel_id', id)
      .eq('user_id', user.id)
      .single();

    if (!currentMember || currentMember.permission !== 'read_write' || currentMember.role !== 'organizer') {
      return errorResponse('FORBIDDEN', 'Only organizer can update members', null, 403);
    }

    // Verify member exists in travel
    const { data: targetMember } = await supabaseAdmin
      .from('travel_members')
      .select('id')
      .eq('id', memberId)
      .eq('travel_id', id)
      .single();

    if (!targetMember) {
      return errorResponse('NOT_FOUND', 'Member not found', null, 404);
    }

    const updateData: Record<string, unknown> = {};
    if (role !== undefined) updateData.role = role;
    if (permission !== undefined) updateData.permission = permission;

    const { data: updated, error } = await supabaseAdmin
      .from('travel_members')
      .update(updateData)
      .eq('id', memberId)
      .eq('travel_id', id)
      .select()
      .single();

    if (error) throw error;

    return successResponse(updated, 'Member updated successfully');
  } catch (err) {
    console.error('PATCH /api/travels/[id]/members error:', err);
    return errorResponse('SERVER_ERROR', 'Failed to update member', err, 500);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  try {
    const token = getAuthToken(request);
    if (!token) return errorResponse('UNAUTHORIZED', 'Missing authorization token', null, 401);

    const { id } = params;
    const { memberId } = await request.json();

    if (!memberId) {
      return errorResponse('INVALID_INPUT', 'Missing required field: memberId');
    }

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return errorResponse('AUTH_ERROR', 'Failed to authenticate user', null, 401);
    }

    // Check if user is organizer
    const { data: currentMember } = await supabaseAdmin
      .from('travel_members')
      .select('permission, role')
      .eq('travel_id', id)
      .eq('user_id', user.id)
      .single();

    if (!currentMember || currentMember.permission !== 'read_write' || currentMember.role !== 'organizer') {
      return errorResponse('FORBIDDEN', 'Only organizer can remove members', null, 403);
    }

    // Verify member exists and is not the organizer
    const { data: targetMember } = await supabaseAdmin
      .from('travel_members')
      .select('id, role')
      .eq('id', memberId)
      .eq('travel_id', id)
      .single();

    if (!targetMember) {
      return errorResponse('NOT_FOUND', 'Member not found', null, 404);
    }

    if (targetMember.role === 'organizer') {
      return errorResponse('CANNOT_REMOVE_ORGANIZER', 'Cannot remove travel organizer');
    }

    const { error } = await supabaseAdmin
      .from('travel_members')
      .delete()
      .eq('id', memberId)
      .eq('travel_id', id);

    if (error) throw error;

    return successResponse({ memberId }, 'Member removed successfully');
  } catch (err) {
    console.error('DELETE /api/travels/[id]/members error:', err);
    return errorResponse('SERVER_ERROR', 'Failed to remove member', err, 500);
  }
}
