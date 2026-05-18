import { createClient } from '@supabase/supabase-js';
import { parseExcelBuffer } from '@/lib/assets/import-parser';

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
 * POST /api/assets/import/preview
 * Accepts multipart/form-data with a "file" field (xlsx).
 * Returns parsed rows + validation summary. Does NOT write to DB.
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

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return Response.json(
        { success: false, error: { message: 'file is required' } },
        { status: 400 }
      );
    }
    if (file.size > 5 * 1024 * 1024) {
      return Response.json(
        { success: false, error: { message: 'File too large (max 5MB)' } },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const parsed = parseExcelBuffer(Buffer.from(arrayBuffer));

    // Cross-check DB: duplicate machine_asset_number + valid asset_class_code
    const tags = parsed.rows
      .map((r) => r.data.machine_asset_number)
      .filter(Boolean) as string[];
    const classes = Array.from(
      new Set(parsed.rows.map((r) => r.data.asset_class_code).filter(Boolean))
    ) as string[];

    let existingTags = new Set<string>();
    if (tags.length > 0) {
      const { data: dup } = await supabase
        .from('assets')
        .select('machine_asset_number')
        .in('machine_asset_number', tags);
      existingTags = new Set((dup || []).map((r: any) => r.machine_asset_number));
    }

    let validClasses = new Set<string>();
    if (classes.length > 0) {
      const { data: cls } = await supabase
        .from('asset_classes')
        .select('code')
        .in('code', classes);
      validClasses = new Set((cls || []).map((r: any) => r.code));
    }

    let duplicate_tags = 0;
    let invalid_class_codes = 0;

    for (const r of parsed.rows) {
      if (r.data.machine_asset_number && existingTags.has(r.data.machine_asset_number)) {
        r.errors.push(`Duplicate machine_asset_number: ${r.data.machine_asset_number}`);
        duplicate_tags++;
      }
      if (r.data.asset_class_code && !validClasses.has(r.data.asset_class_code)) {
        r.errors.push(`Unknown asset_class_code: ${r.data.asset_class_code}`);
        invalid_class_codes++;
      }
    }

    const ready_to_import = parsed.rows.filter((r) => r.errors.length === 0).length;
    const has_errors = parsed.rows.length - ready_to_import;

    // Persist as a "pending" batch + items so execute can refer to it
    const { data: batch, error: batchErr } = await supabase
      .from('asset_import_batches')
      .insert({
        batch_name: file.name || `Import ${new Date().toISOString()}`,
        file_name: file.name,
        file_size_bytes: file.size,
        status: 'pending',
        total_rows: parsed.total_rows,
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single();

    if (batchErr) {
      return Response.json(
        { success: false, error: { message: `Batch insert: ${batchErr.message}` } },
        { status: 500 }
      );
    }

    // Insert items
    if (parsed.rows.length > 0) {
      const items = parsed.rows.map((r) => ({
        batch_id: batch.id,
        row_number: r.row_number,
        status: r.errors.length === 0 ? 'pending' : 'error',
        raw_data: r.data,
        validation_errors: r.errors.length > 0 ? r.errors : null,
      }));
      const { error: itemsErr } = await supabase
        .from('asset_import_items')
        .insert(items);
      if (itemsErr) {
        return Response.json(
          { success: false, error: { message: `Items insert: ${itemsErr.message}` } },
          { status: 500 }
        );
      }
    }

    return Response.json({
      success: true,
      data: {
        batch_id: batch.id,
        file_name: file.name,
        total_rows: parsed.total_rows,
        valid_rows: ready_to_import,
        invalid_rows: has_errors,
        global_errors: parsed.global_errors,
        validation_summary: {
          ready_to_import,
          has_errors,
          duplicate_tags,
          invalid_class_codes,
        },
        preview: parsed.rows.slice(0, 20).map((r) => ({
          row_number: r.row_number,
          data: r.data,
          errors: r.errors,
        })),
      },
    });
  } catch (error) {
    console.error('preview error:', error);
    return Response.json(
      {
        success: false,
        error: { message: error instanceof Error ? error.message : 'Server error' },
      },
      { status: 500 }
    );
  }
}
