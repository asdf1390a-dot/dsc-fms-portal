import { getUserFromRequest, userScopedClient } from '../../../lib/api-auth';
import { supabaseAdmin } from '../../../lib/supabase-admin';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const scheduleId = req.query.scheduleId;
    const planId = req.query.planId;
    let q = supabaseAdmin.from('pm_work_logs').select('*').order('created_at', { ascending: false });
    if (scheduleId) q = q.eq('schedule_id', scheduleId);
    if (planId) q = q.eq('plan_id', planId);
    const { data, error } = await q.limit(50);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ items: data || [] });
  }

  if (req.method === 'POST') {
    const { user, token } = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: 'unauthorized' });
    const sb = userScopedClient(token);
    const b = req.body || {};
    if (!b.schedule_id || !b.plan_id || !b.performed_by_name) {
      return res.status(400).json({ error: 'schedule_id, plan_id, performed_by_name required' });
    }
    const payload = {
      schedule_id: b.schedule_id,
      plan_id: b.plan_id,
      asset_id: b.asset_id || null,
      performed_by: user.id,
      performed_by_name: b.performed_by_name,
      actual_hours: b.actual_hours != null && b.actual_hours !== '' ? Number(b.actual_hours) : null,
      result: b.result || 'ok',
      findings: b.findings || null,
      action_taken: b.action_taken || null,
      notes: b.notes || null,
      checklist_result: b.checklist_result || [],
      started_at: b.started_at || null,
      ended_at: b.ended_at || null,
    };
    const { data: log, error } = await sb.from('pm_work_logs').insert(payload).select().single();
    if (error) return res.status(500).json({ error: error.message });

    // Optionally insert parts_used rows
    const parts = Array.isArray(b.parts) ? b.parts.filter(p => p && p.part_name) : [];
    if (parts.length > 0) {
      const partRows = parts.map(p => ({
        work_log_id: log.id,
        schedule_id: b.schedule_id,
        asset_id: b.asset_id || null,
        part_id: p.part_id || null,
        part_name: p.part_name,
        part_number: p.part_number || null,
        quantity: p.quantity != null && p.quantity !== '' ? Number(p.quantity) : 1,
        unit: p.unit || 'ea',
      }));
      await sb.from('pm_parts_used').insert(partRows);
    }

    // Update schedule status → completed
    if (b.result === 'ok' || b.result === 'abnormal') {
      await sb.from('pm_schedules').update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        completed_by: user.id,
        completed_by_name: b.performed_by_name,
        actual_hours: payload.actual_hours,
        notes: b.notes || null,
      }).eq('id', b.schedule_id);
    } else if (b.result === 'deferred') {
      // keep pending; record only
    }

    return res.json({ item: log });
  }

  return res.status(405).json({ error: 'method not allowed' });
}
