import { supabaseAdmin } from '../../../lib/supabase-admin';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });
  const categoryId = (req.query.category || '').toString();
  const months = Math.max(1, Math.min(24, parseInt(req.query.months || '6', 10) || 6));
  if (!categoryId) return res.status(400).json({ error: 'category required' });

  // Build month list ending current month.
  const list = [];
  const now = new Date();
  now.setDate(1);
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const p = n => String(n).padStart(2, '0');
    list.push(`${d.getFullYear()}-${p(d.getMonth() + 1)}-01`);
  }
  const fromMonth = list[0];
  const toMonth   = list[list.length - 1];

  const [{ data: targets }, { data: actuals }, { data: catRow }] = await Promise.all([
    supabaseAdmin.from('kpi_targets').select('target_month,target_value')
      .eq('category_id', categoryId).gte('target_month', fromMonth).lte('target_month', toMonth),
    supabaseAdmin.from('kpi_actuals').select('target_month,actual_value')
      .eq('category_id', categoryId).is('week_number', null)
      .gte('target_month', fromMonth).lte('target_month', toMonth),
    supabaseAdmin.from('kpi_categories').select('*').eq('id', categoryId).maybeSingle(),
  ]);

  const tMap = new Map((targets || []).map(r => [r.target_month, Number(r.target_value)]));
  const aMap = new Map((actuals || []).map(r => [r.target_month, Number(r.actual_value)]));
  const series = list.map(m => ({
    month_iso: m,
    month_label: m.slice(0, 7),
    target: tMap.has(m) ? tMap.get(m) : null,
    actual: aMap.has(m) ? aMap.get(m) : null,
  }));

  return res.json({ category: catRow || null, months: series });
}
