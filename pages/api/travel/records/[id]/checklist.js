// POST   /api/travel/records/:id/checklist           — add checklist item
// PATCH  /api/travel/records/:id/checklist?iid=      — toggle/update item
// DELETE /api/travel/records/:id/checklist?iid=      — delete item
import { getUserFromRequest, userScopedClient } from '../../../../../lib/api-auth';

export default async function handler(req, res) {
  const { user, token } = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  const sb = userScopedClient(token);

  const { id, iid } = req.query;
  if (!id) return res.status(400).json({ error: 'travel id required' });

  if (req.method === 'POST') {
    const b = req.body || {};
    if (!b.title) return res.status(400).json({ error: 'title required' });
    const payload = {
      travel_id: id,
      title: String(b.title).trim(),
      category: b.category || 'general',
      priority: b.priority || 'medium',
      description: b.description || null,
      sort_order: b.sort_order ?? 0,
      created_by: user.id,
    };
    const { data, error } = await sb.from('travel_checklist_items').insert(payload).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ item: data });
  }

  if (req.method === 'PATCH') {
    if (!iid) return res.status(400).json({ error: 'iid required' });
    const b = req.body || {};
    const allowed = ['title', 'category', 'priority', 'description', 'is_done', 'sort_order'];
    const patch = {};
    for (const k of allowed) if (k in b) patch[k] = b[k];
    if ('is_done' in patch) patch.done_at = patch.is_done ? new Date().toISOString() : null;
    const { data, error } = await sb.from('travel_checklist_items').update(patch).eq('id', iid).eq('travel_id', id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ item: data });
  }

  if (req.method === 'DELETE') {
    if (!iid) return res.status(400).json({ error: 'iid required' });
    const { error } = await sb.from('travel_checklist_items').delete().eq('id', iid).eq('travel_id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(204).end();
  }

  res.setHeader('Allow', 'POST, PATCH, DELETE');
  return res.status(405).json({ error: 'method not allowed' });
}
