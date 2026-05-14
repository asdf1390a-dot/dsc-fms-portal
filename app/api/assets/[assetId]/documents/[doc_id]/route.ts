import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

// DELETE /api/assets/[assetId]/documents/[doc_id] — 파일 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: { assetId: string; doc_id: string } }
) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 문서 조회
    const { data: document, error: queryError } = await supabase
      .from('asset_documents')
      .select('*')
      .eq('id', params.doc_id)
      .eq('asset_id', params.assetId)
      .single();

    if (queryError || !document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // Storage에서 파일 삭제
    const storageUrl = document.file_url;
    if (storageUrl) {
      // 공개 URL에서 Storage 경로 추출
      const urlParts = storageUrl.split('/');
      const bucketIndex = urlParts.indexOf('dsc-fms-portal');
      if (bucketIndex !== -1) {
        const storagePath = urlParts.slice(bucketIndex + 1).join('/');

        const { error: deleteError } = await supabase.storage
          .from('dsc-fms-portal')
          .remove([storagePath]);

        if (deleteError) {
          console.error('Storage delete error:', deleteError);
          // Storage 삭제 실패해도 진행
        }
      }
    }

    // DB에서 문서 삭제
    const { error: dbError } = await supabase
      .from('asset_documents')
      .delete()
      .eq('id', params.doc_id);

    if (dbError) {
      return NextResponse.json(
        { error: 'Failed to delete document' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Server error' },
      { status: 500 }
    );
  }
}
