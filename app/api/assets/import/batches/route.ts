import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

/**
 * GET /api/assets/import/batches
 * Lists import batches (most recent first), with pagination.
 */
export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const per_page = Math.min(parseInt(url.searchParams.get('per_page') || '20'), 100);
    const status = url.searchParams.get('status');

    const offset = (page - 1) * per_page;

    let query = supabase
      .from('asset_import_batches')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    query = query.range(offset, offset + per_page - 1);

    const { data, count, error } = await query;
    if (error) {
      return Response.json(
        { success: false, error: { message: error.message } },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      data: data || [],
      total: count || 0,
      page,
      per_page,
      total_pages: count ? Math.ceil(count / per_page) : 0,
    });
  } catch (error) {
    console.error('batches list error:', error);
    return Response.json(
      {
        success: false,
        error: { message: error instanceof Error ? error.message : 'Server error' },
      },
      { status: 500 }
    );
  }
}
