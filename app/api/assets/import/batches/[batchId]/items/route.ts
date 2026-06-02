import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

/**
 * GET /api/assets/import/batches/:batchId/items
 * Returns: import batch items (rows) with status and validation errors
 */
export async function GET(
  request: Request,
  { params }: { params: { batchId: string } }
): Promise<Response> {
  try {
    const { batchId } = params;
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const per_page = Math.min(parseInt(url.searchParams.get('per_page') || '50'), 500);
    const offset = (page - 1) * per_page;

    // Verify batch exists
    const { data: batch, error: batchErr } = await supabase
      .from('asset_import_batches')
      .select('id')
      .eq('id', batchId)
      .single();

    if (batchErr || !batch) {
      return Response.json(
        { success: false, error: { message: 'Batch not found' } },
        { status: 404 }
      );
    }

    // Get items for this batch
    const { data: items, count, error } = await supabase
      .from('asset_import_items')
      .select('*', { count: 'exact' })
      .eq('batch_id', batchId)
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
      data: items || [],
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
