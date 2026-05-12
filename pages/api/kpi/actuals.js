// /api/kpi/actuals — GET (read) / POST (admin upsert)
import { supabaseAdmin } from '../../../lib/supabase-admin';
import { requireUser } from '../../../lib/career-auth';
import { requireAdmin, normMonth } from '../../../lib/kpi-auth';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { error: authErr } = await requireUser(req);
    if (authErr) return res.status(authErr.status).json(authErr.body);
    const month = normMonth(req.query.month);
    if (!month) return res.status(400).json({ error: 'month_required' });
    const { data, error } = await supabaseAdmin
      .from('kpi_actuals')
      .select('*')
      .eq('target_month', month);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ actuals: data || [] });
  }

  if (req.method === 'POST') {
    const { user, error: authErr } = await requireAdmin(req);
    if (authErr) return res.status(authErr.status).json(authErr.body);

    const b = req.body || {};
    const month = normMonth(b.target_month);
    const categoryId = String(b.category_id || '').trim();
    if (!month || !categoryId) {
      return res.status(400).json({ error: 'category_id and target_month required' });
    }
    if (b.actual_value == null || isNaN(Number(b.actual_value))) {
      return res.status(400).json({ error: 'actual_value required' });
    }
    const week = b.week_number == null || b.week_number === '' ? null : Number(b.week_number);

    // manual upsert (unique index uses coalesce(week_number,-1) — can't use onConflict)
    let existingQ = supabaseAdmin
      .from('kpi_actuals')
      .select('id')
      .eq('category_id', categoryId)
      .eq('target_month', month);
    existingQ = week == null ? existingQ.is('week_number', null) : existingQ.eq('week_number', week);
    const { data: exist, error: eErr } = await existingQ.maybeSingle();
    if (eErr) return res.status(500).json({ error: eErr.message });

    const payload = {
      category_id:  categoryId,
      target_month: month,
      week_number:  week,
      actual_value: Number(b.actual_value),
      is_auto:      !!b.is_auto,
      source_note:  b.source_note || null,
      created_by:   user.id,
    };

    if (exist?.id) {
      const { data, error } = await supabaseAdmin
        .from('kpi_actuals')
        .update(payload)
        .eq('id', exist.id)
        .select('*')
        .single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ actual: data });
    }
    const { data, error } = await supabaseAdmin
      .from('kpi_actuals')
      .insert(payload)
      .select('*')
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ actual: data });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'method_not_allowed' });
}
