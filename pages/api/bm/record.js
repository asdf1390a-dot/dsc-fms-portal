import { getUserFromRequest, userScopedClient } from '../../../lib/api-auth';
import { supabaseAdmin } from '../../../lib/supabase-admin';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { user, token } = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: 'unauthorized' });

    const sb = userScopedClient(token);
    const b = req.body || {};

    // Validate required fields
    if (!b.asset_id || !b.reported_at) {
      return res.status(400).json({ error: 'asset_id and reported_at required' });
    }

    const payload = {
      asset_id: b.asset_id,
      reported_at: b.reported_at,
      reporter_name: b.reporter_name || null,
      reported_by: user.id,
      severity: b.severity || 'normal',
      priority: b.priority || 'medium',
      symptom: b.symptom || null,
      symptom_ta: b.symptom_ta || null,
      cause_code: b.cause_code || null,
      cause: b.cause || null,
      status: 'open',
      downtime_start: b.downtime_start || null,
      downtime_end: null,
      work_hours: null,
      technician_id: b.technician_id || null,
      action_taken: b.action_taken || null,
      photos: Array.isArray(b.photos) ? b.photos : [],
    };

    const { data: record, error } = await sb
      .from('bm_events')
      .insert(payload)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ item: record });
  }

  return res.status(405).json({ error: 'method not allowed' });
}
