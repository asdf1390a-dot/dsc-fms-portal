import { createClient } from '@supabase/supabase-js';
import { ApiResponse } from '@/lib/assets/types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
    },
  }
);

interface AuditLog {
  id: string;
  table_name: string;
  operation: string;
  changed_by: string;
  changed_at: string;
  old_values: Record<string, any>;
  new_values: Record<string, any>;
  change_description: string;
}

export async function GET(
  request: Request,
  { params }: { params: { assetId: string } }
): Promise<Response> {
  try {
    const { assetId } = params;
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const per_page = Math.min(parseInt(url.searchParams.get('per_page') || '50'), 100);

    const offset = (page - 1) * per_page;

    // asset_audit 테이블에서 자산의 감시 로그 조회
    const { data: auditLogs, count, error } = await supabase
      .from('asset_audit')
      .select('*', { count: 'exact' })
      .eq('asset_id', assetId)
      .order('changed_at', { ascending: false })
      .range(offset, offset + per_page - 1);

    if (error) {
      return Response.json(
        { success: false, error: { message: error.message } },
        { status: 500 }
      );
    }

    const total_pages = count ? Math.ceil(count / per_page) : 0;

    return Response.json({
      success: true,
      data: auditLogs as AuditLog[],
      total: count || 0,
      page,
      per_page,
      total_pages,
    });
  } catch (error) {
    console.error('API error:', error);
    return Response.json(
      {
        success: false,
        error: { message: error instanceof Error ? error.message : 'Server error' },
      },
      { status: 500 }
    );
  }
}
