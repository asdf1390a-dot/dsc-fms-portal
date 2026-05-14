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

    const { data: documents, error } = await supabaseAdmin
      .from('travel_documents')
      .select('*')
      .eq('travel_id', params.id)
      .order('uploaded_at', { ascending: false });

    if (error) {
      return errorResponse('FETCH_FAILED', 'Failed to fetch documents', error, 500);
    }

    return successResponse(documents || [], 'Documents retrieved successfully');
  } catch (err) {
    console.error('GET /api/travels/[id]/documents error:', err);
    return errorResponse('SERVER_ERROR', 'Failed to retrieve documents', err, 500);
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
      return errorResponse('FORBIDDEN', 'You do not have permission to upload documents', null, 403);
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return errorResponse('INVALID_INPUT', 'No file provided');
    }

    if (file.size > 10 * 1024 * 1024) {
      return errorResponse('FILE_TOO_LARGE', 'File size exceeds 10MB limit');
    }

    const fileName = file.name;
    const filePath = `travels/${params.id}/documents/${Date.now()}_${fileName}`;

    const fileBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabaseAdmin.storage
      .from('travel-documents')
      .upload(filePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return errorResponse('UPLOAD_FAILED', 'Failed to upload file to storage', uploadError, 500);
    }

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('travel-documents')
      .getPublicUrl(filePath);

    const { data: document, error: dbError } = await supabaseAdmin
      .from('travel_documents')
      .insert({
        travel_id: params.id,
        file_name: fileName,
        file_path: filePath,
        file_size: file.size,
        file_type: file.type,
        document_type: 'other',
        uploaded_by: user.id,
        public_url: publicUrl,
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database insert error:', dbError);
      return errorResponse('DB_ERROR', 'Failed to save document metadata', dbError, 500);
    }

    return successResponse(document, 'Document uploaded successfully', 201);
  } catch (err) {
    console.error('POST /api/travels/[id]/documents error:', err);
    return errorResponse('SERVER_ERROR', 'Failed to upload document', err, 500);
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

    const body = await request.json();
    const { documentId } = body;

    if (!documentId) {
      return errorResponse('INVALID_INPUT', 'Missing documentId');
    }

    const { data: document } = await supabaseAdmin
      .from('travel_documents')
      .select('file_path, uploaded_by')
      .eq('id', documentId)
      .eq('travel_id', params.id)
      .single();

    if (!document || document.uploaded_by !== user.id) {
      return errorResponse('FORBIDDEN', 'You can only delete your own documents', null, 403);
    }

    const { error: deleteError } = await supabaseAdmin.storage
      .from('travel-documents')
      .remove([document.file_path]);

    if (deleteError) {
      console.error('Storage delete error:', deleteError);
      return errorResponse('DELETE_FAILED', 'Failed to delete file from storage', deleteError, 500);
    }

    const { error: dbError } = await supabaseAdmin
      .from('travel_documents')
      .delete()
      .eq('id', documentId)
      .eq('travel_id', params.id);

    if (dbError) {
      return errorResponse('DELETE_FAILED', 'Failed to delete document metadata', dbError, 500);
    }

    return successResponse(null, 'Document deleted successfully');
  } catch (err) {
    console.error('DELETE /api/travels/[id]/documents error:', err);
    return errorResponse('SERVER_ERROR', 'Failed to delete document', err, 500);
  }
}
