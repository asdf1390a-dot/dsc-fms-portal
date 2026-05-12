// /api/kpi/dashboard?month=YYYY-MM → kpi_dashboard_monthly rows
import { supabaseAdmin } from '../../../lib/supabase-admin';
import { requireUser } from '../../../lib/career-auth';
import { normMonth } from '../../../lib/kpi-auth';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  const { error: authErr } = await requireUser(req);
  if (authErr) return res.status(authErr.status).json(authErr.body);

  const month = normMonth(req.query.month);
  if (!month) return res.status(400).json({ error: 'month_required' });

  // categories baseline
  const { data: cats, error: cErr } = await supabaseAdmin
    .from('kpi_categories')
    .select('*')
    .eq('active', true)
    .order('sort_order', { ascending: true });
  if (cErr) return res.status(500).json({ error: cErr.message });

  // dashboard view rows for this month
  const { data: rows, error } = await supabaseAdmin
    .from('kpi_dashboard_monthly')
    .select('*')
    .eq('month', month);
  if (error) return res.status(500).json({ error: error.message });

  // monthly actuals (week_number is null) — may exist without target → merge
  const { data: actuals, error: aErr } = await supabaseAdmin
    .from('kpi_actuals')
    .select('category_id, actual_value, is_auto, source_note')
    .eq('target_month', month)
    .is('week_number', null);
  if (aErr) return res.status(500).json({ error: aErr.message });

  const rowMap = new Map((rows || []).map(r => [r.category_id, r]));
  const actMap = new Map((actuals || []).map(a => [a.category_id, a]));

  const items = (cats || []).map(c => {
    const r = rowMap.get(c.id);
    const a = actMap.get(c.id);
    return {
      category_id: c.id,
      group_name:  c.group_name,
      label:       c.label,
      unit:        c.unit,
      direction:   c.direction,
      is_auto:     c.is_auto,
      sort_order:  c.sort_order,
      month,
      target_value:     r?.target_value ?? null,
      actual_value:     r?.actual_value ?? a?.actual_value ?? null,
      achievement_rate: r?.achievement_rate ?? null,
      actual_is_auto:   r?.actual_is_auto ?? a?.is_auto ?? false,
      source_note:      r?.source_note ?? a?.source_note ?? null,
    };
  });

  return res.status(200).json({ month, items });
}
