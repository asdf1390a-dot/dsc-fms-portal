import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

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
 * POST /api/assets/import/execute
 * Body: { batch_id: string }
 * Inserts assets for each "pending" item in the batch. Skips "error" items.
 * Batches inserts in chunks of 100 to stay under timeouts.
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

    const { batch_id } = await request.json();
    if (!batch_id) {
      return Response.json(
        { success: false, error: { message: 'batch_id is required' } },
        { status: 400 }
      );
    }

    // Verify batch exists + status
    const { data: batch, error: batchErr } = await supabase
      .from('asset_import_batches')
      .select('id, status')
      .eq('id', batch_id)
      .single();
    if (batchErr || !batch) {
      return Response.json(
        { success: false, error: { message: 'Batch not found' } },
        { status: 404 }
      );
    }
    if (batch.status === 'completed') {
      return Response.json(
        { success: false, error: { message: 'Batch already completed' } },
        { status: 409 }
      );
    }

    await supabase
      .from('asset_import_batches')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', batch_id);

    // Fetch pending items
    const { data: items, error: itemsErr } = await supabase
      .from('asset_import_items')
      .select('id, row_number, raw_data')
      .eq('batch_id', batch_id)
      .eq('status', 'pending')
      .order('row_number', { ascending: true });

    if (itemsErr) {
      return Response.json(
        { success: false, error: { message: itemsErr.message } },
        { status: 500 }
      );
    }

    let success = 0;
    let failed = 0;
    const errorDetails: Array<{ row: number; error: string }> = [];

    // Process in chunks of 100
    const CHUNK = 100;
    for (let i = 0; i < (items?.length || 0); i += CHUNK) {
      const chunk = items!.slice(i, i + CHUNK);
      const inserts = chunk.map((it: any) => ({
        ...it.raw_data,
        created_by: user.id,
        updated_by: user.id,
      }));

      const { data: inserted, error: insErr } = await supabase
        .from('assets')
        .insert(inserts)
        .select('id, machine_asset_number');

      if (insErr) {
        // Fallback: try one-by-one to isolate failures
        for (const it of chunk) {
          const { data: one, error: oneErr } = await supabase
            .from('assets')
            .insert({
              ...it.raw_data,
              created_by: user.id,
              updated_by: user.id,
            })
            .select('id')
            .single();
          if (oneErr) {
            failed++;
            errorDetails.push({ row: it.row_number, error: oneErr.message });
            await supabase
              .from('asset_import_items')
              .update({
                status: 'error',
                validation_errors: [oneErr.message],
                processed_at: new Date().toISOString(),
              })
              .eq('id', it.id);
          } else {
            success++;
            await supabase
              .from('asset_import_items')
              .update({
                status: 'success',
                asset_id: one.id,
                action: 'create',
                processed_at: new Date().toISOString(),
              })
              .eq('id', it.id);
          }
        }
      } else {
        // Match inserts by machine_asset_number to update items
        const tagToId = new Map(
          (inserted || []).map((r: any) => [r.machine_asset_number, r.id])
        );
        for (const it of chunk) {
          const id = tagToId.get(it.raw_data.machine_asset_number);
          if (id) {
            success++;
            await supabase
              .from('asset_import_items')
              .update({
                status: 'success',
                asset_id: id,
                action: 'create',
                processed_at: new Date().toISOString(),
              })
              .eq('id', it.id);
          } else {
            failed++;
            errorDetails.push({ row: it.row_number, error: 'Insert returned no id' });
          }
        }
      }
    }

    await supabase
      .from('asset_import_batches')
      .update({
        status: 'completed',
        processed_count: success + failed,
        success_count: success,
        error_count: failed,
        import_result: { success, failed, errors: errorDetails.slice(0, 50) },
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq('id', batch_id);

    return Response.json({
      success: true,
      data: {
        batch_id,
        processed: success + failed,
        inserted: success,
        failed,
        errors: errorDetails.slice(0, 50),
      },
      message: 'Import complete',
    });
  } catch (error) {
    console.error('execute error:', error);
    return Response.json(
      {
        success: false,
        error: { message: error instanceof Error ? error.message : 'Server error' },
      },
      { status: 500 }
    );
  }
}
