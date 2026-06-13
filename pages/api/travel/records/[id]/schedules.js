// POST   /api/travel/records/:id/schedules     — add a schedule entry
// PATCH  /api/travel/records/:id/schedules?sid=  — update entry
// DELETE /api/travel/records/:id/schedules?sid=  — delete entry
import { getUserFromRequest, userScopedClient } from '../../../../../lib/api-auth';

export default async function handler(req, res) {
  const { user, token } = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  const sb = userScopedClient(token);

  const { id, sid } = req.query;
  if (!id) return res.status(400).json({ error: 'travel id required' });

  if (req.method === 'POST') {
    const b = req.body || {};
    if (!b.event_name || !b.date || !b.location) {
      return res.status(400).json({ error: 'event_name, date, location required' });
    }
    const payload = {
      travel_id: id,
      date: b.date,
      event_name: String(b.event_name).trim(),
      location: String(b.location).trim(),
      description: b.description || null,
      start_time: b.start_time || null,
      end_time: b.end_time || null,
      latitude: b.latitude ?? null,
      longitude: b.longitude ?? null,
      sort_order: b.sort_order ?? 0,
    };
    const { data, error } = await sb.from('travel_schedules').insert(payload).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ item: data });
  }

  if (req.method === 'PATCH') {
    if (!sid) return res.status(400).json({ error: 'sid required' });
    const b = req.body || {};
    const allowed = ['date', 'event_name', 'location', 'description', 'start_time', 'end_time', 'latitude', 'longitude', 'sort_order'];
    const patch = {};
    for (const k of allowed) if (k in b) patch[k] = b[k];
    const { data, error } = await sb.from('travel_schedules').update(patch).eq('id', sid).eq('travel_id', id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ item: data });
  }

  if (req.method === 'DELETE') {
    if (!sid) return res.status(400).json({ error: 'sid required' });
    const { error } = await sb.from('travel_schedules').delete().eq('id', sid).eq('travel_id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(204).end();
  }

  res.setHeader('Allow', 'POST, PATCH, DELETE');
  return res.status(405).json({ error: 'method not allowed' });
}
