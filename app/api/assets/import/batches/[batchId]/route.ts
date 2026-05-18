import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

/**
 * GET /api/assets/import/batches/:batchId
 * Returns batch metadata + items (filterable by status).
 * Query params:
 *   - include_items=1 (default) — include items in response
 *   - item_status=success|error|pending — filter items
 *   - item_page, item_per_page — paginate items
 */
export async function GET(
  request: Request,
  { params }: { params: { batchId: string } }
): Promise<Response> {
  try {
    const { batchId } = params;
    const url = new URL(request.url);
    const includeItems = url.searchParams.get('include_items') !== '0';
    const itemStatus = url.searchParams.get('item_status');
    const itemPage = parseInt(url.searchParams.get('item_page') || '1');
    const itemPerPage = Math.min(
      parseInt(url.searchParams.get('item_per_page') || '50'),
      200
    );

    const { data: batch, error: batchErr } = await supabase
      .from('asset_import_batches')
      .select('*')
      .eq('id', batchId)
      .single();

    if (batchErr) {
      if (batchErr.code === 'PGRST116') {
        return Response.json(
          { success: false, error: { message: 'Batch not found' } },
          { status: 404 }
        );
      }
      return Response.json(
        { success: false, error: { message: batchErr.message } },
        { status: 500 }
      );
    }

    let items: any[] = [];
    let itemsTotal = 0;
    if (includeItems) {
      let q = supabase
        .from('asset_import_items')
        .select('*', { count: 'exact' })
        .eq('batch_id', batchId)
        .order('row_number', { ascending: true });
      if (itemStatus) q = q.eq('status', itemStatus);
      const offset = (itemPage - 1) * itemPerPage;
      q = q.range(offset, offset + itemPerPage - 1);
      const { data, count, error } = await q;
      if (error) {
        return Response.json(
          { success: false, error: { message: error.message } },
          { status: 500 }
        );
      }
      items = data || [];
      itemsTotal = count || 0;
    }

    return Response.json({
      success: true,
      data: {
        batch,
        items,
        items_total: itemsTotal,
        item_page: itemPage,
        item_per_page: itemPerPage,
      },
    });
  } catch (error) {
    console.error('batch detail error:', error);
    return Response.json(
      {
        success: false,
        error: { message: error instanceof Error ? error.message : 'Server error' },
      },
      { status: 500 }
    );
  }
}
