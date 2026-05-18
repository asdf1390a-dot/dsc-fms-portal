import { createClient } from '@supabase/supabase-js';
import { ApiResponse } from '@/lib/assets/types';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
    },
  }
);

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const q = url.searchParams.get('q');

    let query = supabase
      .from('assets')
      .select('location', { count: 'exact' })
      .order('location');

    // 필터 적용 (선택사항)
    if (q) {
      query = query.ilike('location', `%${q}%`);
    }

    const { data: rows, error } = await query;

    if (error) {
      return Response.json(
        { success: false, error: { message: error.message } },
        { status: 500 }
      );
    }

    // 중복 제거 및 정렬
    const locations = Array.from(
      new Set((rows || []).map((row: any) => row.location).filter(Boolean))
    ).sort();

    return Response.json({
      success: true,
      data: locations,
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
