import { supabaseAdmin } from '../../../lib/supabase-admin';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });
  const month = (req.query.month || '').toString();
  if (!/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ error: 'month must be YYYY-MM' });
  const target = `${month}-01`;

  // Fetch categories + targets + actuals separately so we can return a complete grid
  // (incl. categories without target/actual yet).
  const [{ data: cats, error: catErr }, { data: targets }, { data: actuals }] = await Promise.all([
    supabaseAdmin.from('kpi_categories').select('*').eq('is_active', true).order('sort_order'),
    supabaseAdmin.from('kpi_targets').select('*').eq('target_month', target),
    supabaseAdmin.from('kpi_actuals').select('*').eq('target_month', target).is('week_number', null),
  ]);
  if (catErr) return res.status(500).json({ error: catErr.message });

  const tMap = new Map((targets || []).map(t => [t.category_id, t]));
  const aMap = new Map((actuals || []).map(a => [a.category_id, a]));

  const items = (cats || []).map(c => {
    const t = tMap.get(c.id);
    const a = aMap.get(c.id);
    let achievement = null;
    if (t && a && t.target_value != null && a.actual_value != null) {
      if (Number(t.target_value) === 0) {
        // Special: target 0 (e.g. accidents). If actual=0 → achieved (100), else 0.
        achievement = Number(a.actual_value) === 0 ? 100 : 0;
      } else if (c.direction === 'up') {
        achievement = Math.round((Number(a.actual_value) / Number(t.target_value)) * 1000) / 10;
      } else {
        achievement = Math.round((Number(t.target_value) / Number(a.actual_value)) * 1000) / 10;
      }
    }
    return {
      category_id: c.id,
      group_name: c.group_name,
      name_ko: c.name_ko,
      name_en: c.name_en,
      unit: c.unit,
      direction: c.direction,
      is_auto: c.is_auto,
      sort_order: c.sort_order,
      target_id: t?.id || null,
      target_value: t?.target_value ?? null,
      actual_id: a?.id || null,
      actual_value: a?.actual_value ?? null,
      actual_is_auto: a?.is_auto ?? false,
      source_note: a?.source_note || null,
      achievement_rate: achievement,
    };
  });

  return res.json({ month: target, items });
}
