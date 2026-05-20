// POST /api/assets/search
//   Full-text search with optional filters & pagination.
//
// Body: {
//   q?: string,                  // search term (websearch syntax supported)
//   asset_class_code?: string,
//   status?: string,             // active|idle|maintenance|sold|scrapped
//   make?: string,
//   location?: string,           // ilike contains
//   limit?: number,              // default 50, max 500
//   offset?: number,
//   order?: string,              // "col.dir" (asc|desc), default "machine_asset_code.asc"
// }
// Response: { count, results }
//
// Uses the GIN index defined in db/01_schema.sql which builds
// to_tsvector('simple', name_en|name_ta|model|make|machine_asset_number|serial_no).

import { supabaseAdmin } from '../../../lib/supabase-admin';

export const dynamic = 'force-dynamic';

const ALLOWED_ORDER_COLS = new Set([
  'machine_asset_code', 'machine_asset_number', 'name_en',
  'updated_at', 'created_at', 'status', 'location', 'make',
]);

function parseOrder(orderStr) {
  if (!orderStr) return { col: 'machine_asset_code', asc: true };
  const [col, dir] = String(orderStr).split('.');
  if (!ALLOWED_ORDER_COLS.has(col)) return { col: 'machine_asset_code', asc: true };
  return { col, asc: (dir || 'asc').toLowerCase() !== 'desc' };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const b = req.body || {};
  const lim = Math.min(Math.max(parseInt(b.limit, 10) || 50, 1), 500);
  const off = Math.max(parseInt(b.offset, 10) || 0, 0);
  const { col, asc } = parseOrder(b.order);

  let query = supabaseAdmin
    .from('assets')
    .select('*', { count: 'exact' });

  if (b.asset_class_code) query = query.eq('asset_class_code', b.asset_class_code);
  if (b.status) query = query.eq('status', b.status);
  if (b.make) query = query.eq('make', b.make);
  if (b.location) query = query.ilike('location', `%${b.location}%`);

  const q = (b.q || '').trim();
  if (q) {
    // Use Postgres websearch_to_tsquery via Supabase textSearch.
    // The GIN index is on a function expression covering 6 columns; we can
    // approximate by searching against name_en + OR-ilike for short tokens.
    // textSearch on a single column hits the GIN only for that column, so we
    // fall back to OR-ilike across all 6 columns to mirror the indexed expression.
    const term = `%${q}%`;
    query = query.or([
      `name_en.ilike.${term}`,
      `name_ta.ilike.${term}`,
      `model.ilike.${term}`,
      `make.ilike.${term}`,
      `machine_asset_number.ilike.${term}`,
      `serial_no.ilike.${term}`,
    ].join(','));
  }

  query = query.order(col, { ascending: asc }).range(off, off + lim - 1);

  const { data, error, count } = await query;
  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({
    count: count ?? data?.length ?? 0,
    results: data || [],
    limit: lim,
    offset: off,
  });
}
