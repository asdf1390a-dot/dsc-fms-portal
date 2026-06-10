import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const MONTH_KEYS = [
  'january','february','march','april','may','june',
  'july','august','september','october','november','december'
] as const;

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const year = parseInt(url.searchParams.get('year') || '2026', 10);

    const { data, error } = await supabase
      .from('rm_monthly_costs')
      .select('*')
      .eq('year', year)
      .order('sort_order', { ascending: true })
      .order('category', { ascending: true });

    if (error) throw error;

    const rows = data || [];

    // Compute monthly totals
    const monthly_totals: Record<string, number> = {};
    for (const k of MONTH_KEYS) monthly_totals[k] = 0;
    let grand_total = 0;
    for (const r of rows) {
      for (const k of MONTH_KEYS) {
        const v = Number(r[k] || 0);
        monthly_totals[k] += v;
        grand_total += v;
      }
    }

    return Response.json({
      ok: true,
      year,
      rows,
      monthly_totals,
      grand_total,
      months: MONTH_KEYS,
    });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}

// POST: upsert a single row (create or update by id, or by year+category+item)
export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const { id, year = 2026, category, item = '', sort_order = 0, remarks, updated_by } = body || {};

    if (!category || typeof category !== 'string') {
      return Response.json({ ok: false, error: 'category required' }, { status: 400 });
    }

    const payload: Record<string, any> = {
      year, category, item, sort_order,
      remarks: remarks ?? null,
      updated_by: updated_by ?? null,
    };
    for (const k of MONTH_KEYS) {
      if (body[k] !== undefined && body[k] !== null && body[k] !== '') {
        const n = Number(body[k]);
        payload[k] = Number.isFinite(n) ? n : 0;
      }
    }

    let result;
    if (id) {
      result = await supabase.from('rm_monthly_costs').update(payload).eq('id', id).select().single();
    } else {
      result = await supabase
        .from('rm_monthly_costs')
        .upsert(payload, { onConflict: 'year,category,item' })
        .select()
        .single();
    }

    if (result.error) throw result.error;
    return Response.json({ ok: true, row: result.data });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}

// DELETE: remove a row by id (?id=123)
export async function DELETE(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) return Response.json({ ok: false, error: 'id required' }, { status: 400 });
    const { error } = await supabase.from('rm_monthly_costs').delete().eq('id', Number(id));
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
