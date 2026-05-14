import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkWritePermission(userId: string, travelId: string): Promise<boolean> {
  const { data: travel } = await supabase
    .from('travels')
    .select('user_id')
    .eq('id', travelId)
    .single();
  if (travel?.user_id === userId) return true;
  const { data: member } = await supabase
    .from('travel_members')
    .select('permission')
    .eq('travel_id', travelId)
    .eq('user_id', userId)
    .single();
  return member?.permission === 'read_write';
}

interface RouteParams { params: { id: string } }

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { data, error } = await supabase
      .from('travel_documents')
      .select('*')
      .eq('travel_id', params.id)
      .order('uploaded_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ data, status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch documents', status: 500 }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId || !(await checkWritePermission(userId, params.id))) {
      return NextResponse.json({ error: 'Access denied', status: 403 }, { status: 403 });
    }
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const documentType = formData.get('document_type') || 'other';

    if (!file) {
      return NextResponse.json({ error: 'File is required', status: 400 }, { status: 400 });
    }

    const filePath = `travels/${params.id}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from('travel-documents')
      .upload(filePath, file);
    if (uploadError) throw uploadError;

    const { data: doc, error: dbError } = await supabase
      .from('travel_documents')
      .insert({
        travel_id: params.id,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        file_type: file.type,
        document_type: documentType,
        uploaded_by: userId,
      })
      .select()
      .single();
    if (dbError) throw dbError;
    return NextResponse.json({ data: doc, message: 'File uploaded', status: 201 }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Upload failed', status: 500 }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = request.headers.get('x-user-id');
    const docId = request.headers.get('x-doc-id');
    if (!userId || !docId || !(await checkWritePermission(userId, params.id))) {
      return NextResponse.json({ error: 'Access denied', status: 403 }, { status: 403 });
    }
    const { data: doc } = await supabase
      .from('travel_documents')
      .select('file_path')
      .eq('id', docId)
      .single();
    if (doc) {
      await supabase.storage.from('travel-documents').remove([doc.file_path]);
    }
    const { error } = await supabase
      .from('travel_documents')
      .delete()
      .eq('id', docId);
    if (error) throw error;
    return NextResponse.json({ message: 'File deleted', status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Delete failed', status: 500 }, { status: 500 });
  }
}
