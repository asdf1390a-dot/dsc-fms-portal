import { createClient } from '@supabase/supabase-js';
import { getUserIdFromToken, isTokenExpired } from '@/lib/api-auth';
import {
  VALID_ITEM_STATUSES,
  isValidUuid,
  normalizePage,
  normalizePerPage,
} from '@/lib/assets/import-helpers';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

function authenticate(request: Request) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return { userId: null, error: 'Missing token' };
  if (isTokenExpired(token)) return { userId: null, error: 'Token expired' };
  const userId = getUserIdFromToken(token);
  if (!userId) return { userId: null, error: 'Invalid token' };
  return { userId, error: null };
}

/**
 * GET /api/assets/import/batches/:batchId
 * Returns batch metadata + items (filterable by status).
 *
 * Path params:
 *   - batchId (uuid)
 *
 * Query params:
 *   - include_items=1 (default) — include items in response, 0 to omit
 *   - item_status=success|error|pending|validating|skipped — filter items
 *   - item_page (default 1)
 *   - item_per_page (default 50, max 200)
 */
export async function GET(
  request: Request,
  { params }: { params: { batchId: string } }
): Promise<Response> {
  try {
    const { userId, error: authErr } = authenticate(request);
    if (!userId) {
      return Response.json(
        { success: false, error: { message: authErr || 'Unauthorized' } },
        { status: 401 }
      );
    }

    const { batchId } = params;
    if (!isValidUuid(batchId)) {
      return Response.json(
        { success: false, error: { message: 'Invalid batchId (must be a UUID)' } },
        { status: 400 }
      );
    }

    const url = new URL(request.url);
    const includeItems = url.searchParams.get('include_items') !== '0';
    const itemStatus = url.searchParams.get('item_status');

    if (itemStatus && !VALID_ITEM_STATUSES.includes(itemStatus)) {
      return Response.json(
        {
          success: false,
          error: {
            message: `Invalid item_status filter. Allowed: ${VALID_ITEM_STATUSES.join(', ')}`,
          },
        },
        { status: 400 }
      );
    }

    const itemPageRaw = parseInt(url.searchParams.get('item_page') || '1');
    const itemPerPageRaw = parseInt(url.searchParams.get('item_per_page') || '50');
    const itemPage = Number.isFinite(itemPageRaw) && itemPageRaw > 0 ? itemPageRaw : 1;
    const itemPerPage = Math.min(
      Math.max(Number.isFinite(itemPerPageRaw) ? itemPerPageRaw : 50, 1),
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
        item_total_pages: itemsTotal ? Math.ceil(itemsTotal / itemPerPage) : 0,
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
