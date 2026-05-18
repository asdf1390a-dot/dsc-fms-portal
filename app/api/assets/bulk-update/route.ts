import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const ALLOWED_FIELDS = ['status', 'location', 'remark', 'make'];
const VALID_STATUSES = ['active', 'idle', 'maintenance', 'sold', 'scrapped'];

async function authenticate(request: Request) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return { user: null, error: 'Missing token' };
  const userClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) return { user: null, error: 'Invalid token' };
  return { user, error: null };
}

/**
 * POST /api/assets/bulk-update
 * Body: { ids: string[], updates: { status?, location?, remark?, make? } }
 * Limit: max 500 ids per request
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const { user, error: authErr } = await authenticate(request);
    if (!user) {
      return Response.json(
        { success: false, error: { message: authErr || 'Unauthorized' } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { ids, updates } = body || {};

    if (!Array.isArray(ids) || ids.length === 0) {
      return Response.json(
        { success: false, error: { message: 'ids must be a non-empty array' } },
        { status: 400 }
      );
    }
    if (ids.length > 500) {
      return Response.json(
        { success: false, error: { message: 'Max 500 ids per request' } },
        { status: 400 }
      );
    }
    if (!updates || typeof updates !== 'object') {
      return Response.json(
        { success: false, error: { message: 'updates object required' } },
        { status: 400 }
      );
    }

    // Whitelist
    const update: Record<string, any> = { updated_by: user.id };
    for (const key of ALLOWED_FIELDS) {
      if (key in updates) update[key] = updates[key];
    }

    if (Object.keys(update).length === 1) {
      return Response.json(
        {
          success: false,
          error: {
            message: `No valid update fields. Allowed: ${ALLOWED_FIELDS.join(', ')}`,
          },
        },
        { status: 400 }
      );
    }

    if ('status' in update && !VALID_STATUSES.includes(update.status)) {
      return Response.json(
        { success: false, error: { message: 'Invalid status', field: 'status' } },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('assets')
      .update(update)
      .in('id', ids)
      .select('id');

    if (error) {
      return Response.json(
        { success: false, error: { message: error.message } },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      data: {
        requested: ids.length,
        updated: data?.length ?? 0,
        updated_ids: (data || []).map((r: any) => r.id),
      },
      message: 'Bulk update complete',
    });
  } catch (error) {
    console.error('bulk-update error:', error);
    return Response.json(
      {
        success: false,
        error: { message: error instanceof Error ? error.message : 'Server error' },
      },
      { status: 500 }
    );
  }
}
