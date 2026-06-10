import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const MONTH_COLS = [
  'jan_amount','feb_amount','mar_amount','apr_amount',
  'may_amount','jun_amount','jul_amount','aug_amount',
  'sep_amount','oct_amount','nov_amount','dec_amount',
] as const;
type MonthCol = typeof MONTH_COLS[number];

const SHORT: Record<string, MonthCol> = {
  jan: 'jan_amount', feb: 'feb_amount', mar: 'mar_amount', apr: 'apr_amount',
  may: 'may_amount', jun: 'jun_amount', jul: 'jul_amount', aug: 'aug_amount',
  sep: 'sep_amount', oct: 'oct_amount', nov: 'nov_amount', dec: 'dec_amount',
};

function rowTotal(r: any): number {
  return MONTH_COLS.reduce((s, k) => s + Number(r[k] || 0), 0);
}

function shapeRow(r: any) {
  return {
    id: r.id,
    code: r.category_code,
    name: r.category_name,
    name_ko: r.category_name_ko,
    group: r.category_group,
    readonly: !!r.is_read_only,
    unit: r.unit || 'Rs',
    note: r.note || null,
    source: r.source || null,
    jan: Number(r.jan_amount || 0),
    feb: Number(r.feb_amount || 0),
    mar: Number(r.mar_amount || 0),
    apr: Number(r.apr_amount || 0),
    may: Number(r.may_amount || 0),
    jun: Number(r.jun_amount || 0),
    jul: Number(r.jul_amount || 0),
    aug: Number(r.aug_amount || 0),
    sep: Number(r.sep_amount || 0),
    oct: Number(r.oct_amount || 0),
    nov: Number(r.nov_amount || 0),
    dec: Number(r.dec_amount || 0),
    total: rowTotal(r),
  };
}

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const year = parseInt(url.searchParams.get('year') || '2026', 10);

    const { data, error } = await supabase
      .from('rm_expenses')
      .select('*')
      .eq('year', year)
      .order('sort_order', { ascending: true });
    if (error) throw error;

    const rows = (data || []).map(shapeRow);

    const groups: Record<string, any[]> = { 'R&M': [], '부자재': [], '전력': [], '기타': [] };
    for (const r of rows) {
      if (!groups[r.group]) groups[r.group] = [];
      groups[r.group].push(r);
    }

    const sumRsOnly = (arr: any[]) =>
      arr.filter(r => r.unit === 'Rs').reduce((s, r) => s + r.total, 0);

    const r_m_total      = sumRsOnly(groups['R&M']);
    const material_total = sumRsOnly(groups['부자재']);
    const power_total    = sumRsOnly(groups['전력']);
    const other_total    = sumRsOnly(groups['기타']);
    const tech_managed_total = r_m_total + material_total;
    const total_rs       = r_m_total + material_total + power_total + other_total;

    const monthly_totals: Record<string, number> = {};
    const monthly_tech_totals: Record<string, number> = {};
    for (const k of MONTH_COLS) { monthly_totals[k] = 0; monthly_tech_totals[k] = 0; }
    for (const r of rows) {
      if (r.unit !== 'Rs') continue;
      for (const short of Object.keys(SHORT)) {
        const longK = SHORT[short];
        monthly_totals[longK] += (r as any)[short];
        if (!r.readonly) monthly_tech_totals[longK] += (r as any)[short];
      }
    }

    return Response.json({
      success: true,
      ok: true,
      year,
      groups,
      summary: {
        total_rs,
        r_m_total,
        material_total,
        power_total,
        other_total,
        tech_managed_total,
      },
      monthly_totals,
      monthly_tech_totals,
    });
  } catch (e: any) {
    return Response.json({ success: false, ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}

// PATCH: update a single month cell on an editable row.
// Body: { id, month: 'jan'|'feb'|..., amount: number }
export async function PATCH(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const { id, month, amount } = body || {};
    if (!id) return Response.json({ ok: false, error: 'id required' }, { status: 400 });
    if (!month || !(month in SHORT)) {
      return Response.json({ ok: false, error: 'month must be jan..dec' }, { status: 400 });
    }
    const n = Number(amount);
    if (!Number.isFinite(n) || n < 0) {
      return Response.json({ ok: false, error: 'amount must be a non-negative number' }, { status: 400 });
    }

    // Guard: refuse if target row is read-only
    const { data: existing, error: selErr } = await supabase
      .from('rm_expenses').select('id, is_read_only').eq('id', id).single();
    if (selErr) throw selErr;
    if (!existing) return Response.json({ ok: false, error: 'row not found' }, { status: 404 });
    if (existing.is_read_only) {
      return Response.json({ ok: false, error: 'this category is read-only (전력·기타)' }, { status: 403 });
    }

    const col = SHORT[month];
    const { data, error } = await supabase
      .from('rm_expenses')
      .update({ [col]: Math.round(n) })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return Response.json({ ok: true, row: shapeRow(data) });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}

// POST kept for parity / future bulk insert use.
export async function POST(): Promise<Response> {
  return Response.json({ ok: false, error: 'POST not supported; use PATCH for cell updates' }, { status: 405 });
}
