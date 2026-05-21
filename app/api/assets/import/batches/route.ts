import { createClient } from '@supabase/supabase-js';
import { getUserIdFromToken, isTokenExpired } from '@/lib/api-auth';
import {
  VALID_BATCH_STATUSES,
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
 * GET /api/assets/import/batches
 * Lists import batches (most recent first), with pagination.
 *
 * Query params:
 *   - page (default 1)
 *   - per_page (default 20, max 100)
 *   - status (optional: pending|processing|completed|failed)
 */
export async function GET(request: Request): Promise<Response> {
  try {
    const { userId, error: authErr } = authenticate(request);
    if (!userId) {
      return Response.json(
        { success: false, error: { message: authErr || 'Unauthorized' } },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const page = normalizePage(url.searchParams.get('page'));
    const per_page = normalizePerPage(url.searchParams.get('per_page'), 20, 100);
    const status = url.searchParams.get('status');

    if (status && !VALID_BATCH_STATUSES.includes(status)) {
      return Response.json(
        {
          success: false,
          error: {
            message: `Invalid status filter. Allowed: ${VALID_BATCH_STATUSES.join(', ')}`,
          },
        },
        { status: 400 }
      );
    }

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
