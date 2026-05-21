import { createClient } from '@supabase/supabase-js';
import { parseExcelBuffer } from '@/lib/assets/import-parser';
import { getUserIdFromToken, isTokenExpired } from '@/lib/api-auth';
import {
  MAX_FILE_BYTES,
  isValidExcelFile,
  analyzeDuplicates,
} from '@/lib/assets/import-helpers';

export const runtime = 'nodejs';
export const maxDuration = 60;

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
 * POST /api/assets/import/preview
 * Accepts multipart/form-data with a "file" field (xlsx).
 * Returns parsed rows + validation summary. Creates a "pending" batch the
 * caller can later submit to /api/assets/import/execute.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const { userId, error: authErr } = authenticate(request);
    if (!userId) {
      return Response.json(
        { success: false, error: { message: authErr || 'Unauthorized' } },
        { status: 401 }
      );
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (e) {
      return Response.json(
        { success: false, error: { message: 'Invalid multipart/form-data body' } },
        { status: 400 }
      );
    }

    const file = formData.get('file') as File | null;
    if (!file) {
      return Response.json(
        { success: false, error: { message: 'file field is required' } },
        { status: 400 }
      );
    }
    if (file.size === 0) {
      return Response.json(
        { success: false, error: { message: 'File is empty' } },
        { status: 400 }
      );
    }
    if (file.size > MAX_FILE_BYTES) {
      return Response.json(
        { success: false, error: { message: `File too large (max ${MAX_FILE_BYTES / 1024 / 1024}MB)` } },
        { status: 400 }
      );
    }
    const fileCheck = isValidExcelFile({ name: file.name, type: file.type });
    if (!fileCheck.valid) {
      return Response.json(
        { success: false, error: { message: fileCheck.reason || 'Invalid file' } },
        { status: 400 }
      );
    }

    // Parse Excel
    let parsed;
    try {
      const arrayBuffer = await file.arrayBuffer();
      parsed = parseExcelBuffer(Buffer.from(arrayBuffer));
    } catch (e) {
      return Response.json(
        {
          success: false,
          error: {
            message: `Failed to parse Excel: ${e instanceof Error ? e.message : 'unknown'}`,
          },
        },
        { status: 400 }
      );
    }

    if (parsed.total_rows === 0) {
      return Response.json(
        { success: false, error: { message: 'Excel has no data rows' } },
        { status: 400 }
      );
    }

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

    // Detect duplicates (within file + against DB) and invalid class codes
    const dupAnalysis = analyzeDuplicates(parsed.rows, existingTags);
    const duplicate_tags = dupAnalysis.duplicate_in_db;
    const duplicate_in_file = dupAnalysis.duplicate_in_file;
    let invalid_class_codes = 0;
    for (const r of parsed.rows) {
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
        created_by: userId,
        updated_by: userId,
      })
      .select()
      .single();

    if (batchErr) {
      return Response.json(
        { success: false, error: { message: `Batch insert: ${batchErr.message}` } },
        { status: 500 }
      );
    }

    // Insert items in chunks to avoid payload limits
    if (parsed.rows.length > 0) {
      const items = parsed.rows.map((r) => ({
        batch_id: batch.id,
        row_number: r.row_number,
        status: r.errors.length === 0 ? 'pending' : 'error',
        raw_data: r.data,
        validation_errors: r.errors.length > 0 ? r.errors : null,
      }));

      const CHUNK = 500;
      for (let i = 0; i < items.length; i += CHUNK) {
        const slice = items.slice(i, i + CHUNK);
        const { error: itemsErr } = await supabase
          .from('asset_import_items')
          .insert(slice);
        if (itemsErr) {
          // Roll back the batch to keep things consistent
          await supabase.from('asset_import_batches').delete().eq('id', batch.id);
          return Response.json(
            { success: false, error: { message: `Items insert: ${itemsErr.message}` } },
            { status: 500 }
          );
        }
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
          duplicate_in_file,
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
