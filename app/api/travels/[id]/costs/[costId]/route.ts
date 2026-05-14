import { NextRequest } from 'next/server';
import { supabaseAdmin } from '../../../../../../lib/travel/supabase-client';
import { successResponse, errorResponse, getAuthToken } from '../../../../../../lib/travel/utils';

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; costId: string } }
) {
  try {
    const token = getAuthToken(request);
    if (!token) return errorResponse('UNAUTHORIZED', 'Missing authorization token', null, 401);

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) return errorResponse('AUTH_ERROR', 'Failed to authenticate user', null, 401);

    const { data: cost } = await supabaseAdmin
      .from('travel_costs')
      .select('payer_id')
      .eq('id', params.costId)
      .eq('travel_id', params.id)
      .single();

    if (!cost || cost.payer_id !== user.id) {
      return errorResponse('FORBIDDEN', 'You can only delete your own costs', null, 403);
    }

    const { error } = await supabaseAdmin
      .from('travel_costs')
      .delete()
      .eq('id', params.costId)
      .eq('travel_id', params.id);

    if (error) {
      return errorResponse('DELETE_FAILED', 'Failed to delete cost', error, 500);
    }

    return successResponse(null, 'Cost deleted successfully');
  } catch (err) {
    console.error('DELETE cost error:', err);
    return errorResponse('SERVER_ERROR', 'Failed to delete cost', err, 500);
  }
}
