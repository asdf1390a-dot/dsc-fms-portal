// app/api/travels/[id]/documents/route.ts
// GET    — list documents (read access)
// POST   — upload document via multipart/form-data (write access)
// DELETE — delete document; doc id is passed via x-doc-id header (write access)

import { supabaseAdmin } from '@/lib/travel/supabase-client';
import {
  hasReadAccess,
  hasWriteAccess,
  validateFileUpload,
} from '@/lib/travel/service';
import type { TravelDocument, ApiResponse, ApiResponseList } from '@/types/travel';

const BUCKET = 'travel-documents';

function readUserId(request: Request): string | null {
  return request.headers.get('x-user-id');
}

function json<T>(body: ApiResponse<T> | ApiResponseList<T>, status: number): Response {
  return Response.json({ ...body, status }, { status });
}

function categorizeFromFileName(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.includes('visa')) return 'visa';
  if (lower.includes('passport')) return 'passport';
  if (lower.includes('board') || lower.includes('ticket') || lower.includes('flight')) {
    return 'flight_ticket';
  }
  if (lower.includes('hotel') || lower.includes('booking')) return 'hotel_booking';
  if (lower.includes('receipt') || lower.includes('invoice')) return 'receipt';
  return 'other';
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
): Promise<Response> {
  try {
    const userId = readUserId(request);
    if (!userId) return json<TravelDocument[]>({ error: 'Unauthorized', status: 401 }, 401);

    const canRead = await hasReadAccess(supabaseAdmin, userId, params.id);
    if (!canRead) return json<TravelDocument[]>({ error: 'Forbidden', status: 403 }, 403);

    const { data, error } = await supabaseAdmin
      .from('travel_documents')
      .select('*')
      .eq('travel_id', params.id)
      .order('uploaded_at', { ascending: false });

    if (error) {
      console.error('Fetch documents error:', error);
      return json<TravelDocument[]>({ error: error.message, status: 500 }, 500);
    }

    return json<TravelDocument[]>(
      { data: (data || []) as TravelDocument[], status: 200 },
      200
    );
  } catch (err) {
    console.error('GET /documents error:', err);
    return json<TravelDocument[]>(
      { error: err instanceof Error ? err.message : 'Server error', status: 500 },
      500
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
): Promise<Response> {
  try {
    const userId = readUserId(request);
    if (!userId) return json<TravelDocument>({ error: 'Unauthorized', status: 401 }, 401);

    const canWrite = await hasWriteAccess(supabaseAdmin, userId, params.id);
    if (!canWrite) return json<TravelDocument>({ error: 'Forbidden', status: 403 }, 403);

    const formData = await request.formData();
    const file = formData.get('file');
    const documentTypeRaw = formData.get('document_type');

    if (!(file instanceof File)) {
      return json<TravelDocument>({ error: 'file is required', status: 400 }, 400);
    }

    const check = validateFileUpload(file);
    if (!check.valid) {
      return json<TravelDocument>({ error: check.error || 'Invalid file', status: 400 }, 400);
    }

    const documentType =
      typeof documentTypeRaw === 'string' && documentTypeRaw.length > 0
        ? documentTypeRaw
        : categorizeFromFileName(file.name);

    const timestamp = Date.now();
    const safeName = sanitizeFileName(file.name);
    const filePath = `travels/${params.id}/documents/${timestamp}_${safeName}`;

    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(filePath, arrayBuffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });

    if (uploadErr) {
      console.error('Storage upload error:', uploadErr);
      return json<TravelDocument>(
        { error: `Upload failed: ${uploadErr.message}`, status: 500 },
        500
      );
    }

    const { data: row, error: insertErr } = await supabaseAdmin
      .from('travel_documents')
      .insert([
        {
          travel_id: params.id,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          file_type: file.type || 'application/octet-stream',
          document_type: documentType,
          uploaded_by: userId,
        },
      ])
      .select()
      .single();

    if (insertErr || !row) {
      // Roll back storage upload to avoid orphaned blobs
      await supabaseAdmin.storage.from(BUCKET).remove([filePath]).catch(() => {});
      console.error('Insert document row error:', insertErr);
      return json<TravelDocument>(
        { error: insertErr?.message || 'Failed to record document', status: 500 },
        500
      );
    }

    return json<TravelDocument>({ data: row as TravelDocument, status: 201 }, 201);
  } catch (err) {
    console.error('POST /documents error:', err);
    return json<TravelDocument>(
      { error: err instanceof Error ? err.message : 'Server error', status: 500 },
      500
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
): Promise<Response> {
  try {
    const userId = readUserId(request);
    if (!userId) return json<TravelDocument>({ error: 'Unauthorized', status: 401 }, 401);

    const canWrite = await hasWriteAccess(supabaseAdmin, userId, params.id);
    if (!canWrite) return json<TravelDocument>({ error: 'Forbidden', status: 403 }, 403);

    const docId = request.headers.get('x-doc-id');
    if (!docId) {
      return json<TravelDocument>({ error: 'x-doc-id header is required', status: 400 }, 400);
    }

    const { data: doc, error: fetchErr } = await supabaseAdmin
      .from('travel_documents')
      .select('id, file_path')
      .eq('id', docId)
      .eq('travel_id', params.id)
      .maybeSingle();

    if (fetchErr) {
      console.error('Fetch document error:', fetchErr);
      return json<TravelDocument>({ error: fetchErr.message, status: 500 }, 500);
    }
    if (!doc) {
      return json<TravelDocument>({ error: 'Document not found', status: 404 }, 404);
    }

    await supabaseAdmin.storage.from(BUCKET).remove([doc.file_path]).catch((e) => {
      console.error('Storage remove error (continuing to delete row):', e);
    });

    const { error: delErr } = await supabaseAdmin
      .from('travel_documents')
      .delete()
      .eq('id', doc.id)
      .eq('travel_id', params.id);

    if (delErr) {
      console.error('Delete document row error:', delErr);
      return json<TravelDocument>({ error: delErr.message, status: 500 }, 500);
    }

    return json<TravelDocument>({ message: 'Document deleted', status: 200 }, 200);
  } catch (err) {
    console.error('DELETE /documents error:', err);
    return json<TravelDocument>(
      { error: err instanceof Error ? err.message : 'Server error', status: 500 },
      500
    );
  }
}
