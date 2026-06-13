// POST   /api/travel/records/:id/participants            — add participant
// DELETE /api/travel/records/:id/participants?pid=       — remove participant
import { getUserFromRequest, userScopedClient } from '../../../../../lib/api-auth';

export default async function handler(req, res) {
  const { user, token } = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  const sb = userScopedClient(token);

  const { id, pid } = req.query;
  if (!id) return res.status(400).json({ error: 'travel id required' });

  if (req.method === 'POST') {
    const b = req.body || {};
    if (!b.display_name) return res.status(400).json({ error: 'display_name required' });
    const payload = {
      travel_id: id,
      display_name: String(b.display_name).trim(),
      employee_id: b.employee_id || null,
      user_id: b.user_id || null,
      role: b.role || 'member',
    };
    const { data, error } = await sb.from('travel_participants').insert(payload).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ item: data });
  }

  if (req.method === 'DELETE') {
    if (!pid) return res.status(400).json({ error: 'pid required' });
    const { error } = await sb.from('travel_participants').delete().eq('id', pid).eq('travel_id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(204).end();
  }

  res.setHeader('Allow', 'POST, DELETE');
  return res.status(405).json({ error: 'method not allowed' });
}
