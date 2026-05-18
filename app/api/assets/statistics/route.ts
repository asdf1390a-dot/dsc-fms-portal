import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

/**
 * GET /api/assets/statistics
 * Returns: total, by_status, by_category, by_make (top 10), last_updated
 */
export async function GET(): Promise<Response> {
  try {
    // Total + status (single query, paginate-safe)
    const { count: total, error: totalErr } = await supabase
      .from('assets')
      .select('id', { count: 'exact', head: true });
    if (totalErr) {
      return Response.json(
        { success: false, error: { message: totalErr.message } },
        { status: 500 }
      );
    }

    // Pull lightweight rows for grouping. 506 assets — full scan is fine.
    const { data: rows, error: rowsErr } = await supabase
      .from('assets')
      .select('status, asset_class_code, make, updated_at');
    if (rowsErr) {
      return Response.json(
        { success: false, error: { message: rowsErr.message } },
        { status: 500 }
      );
    }

    const by_status: Record<string, number> = {};
    const by_class: Record<string, number> = {};
    const by_make: Record<string, number> = {};
    let last_updated = '';

    for (const r of rows || []) {
      const s = (r as any).status || 'unknown';
      by_status[s] = (by_status[s] || 0) + 1;

      const c = (r as any).asset_class_code || 'unknown';
      by_class[c] = (by_class[c] || 0) + 1;

      const m = (r as any).make;
      if (m) by_make[m] = (by_make[m] || 0) + 1;

      const u = (r as any).updated_at;
      if (u && u > last_updated) last_updated = u;
    }

    // Category = first 2 digits of asset_class_code (e.g., "01.001" → "01")
    const by_category: Record<string, number> = {};
    for (const [code, n] of Object.entries(by_class)) {
      const cat = code.split('.')[0] || 'unknown';
      by_category[cat] = (by_category[cat] || 0) + n;
    }

    // Top 10 makes
    const top_makes = Object.entries(by_make)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([make, count]) => ({ make, count }));

    return Response.json({
      success: true,
      data: {
        total_assets: total || 0,
        by_status,
        by_category,
        by_class,
        top_makes,
        last_updated: last_updated || null,
      },
    });
  } catch (error) {
    console.error('statistics error:', error);
    return Response.json(
      {
        success: false,
        error: { message: error instanceof Error ? error.message : 'Server error' },
      },
      { status: 500 }
    );
  }
}
