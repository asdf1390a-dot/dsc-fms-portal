// GET    /api/travel/records/:id       — fetch travel record + relations
// PUT    /api/travel/records/:id       — update record
// DELETE /api/travel/records/:id       — delete record (cascades)
import { getUserFromRequest, userScopedClient } from '../../../../lib/api-auth';

export default async function handler(req, res) {
  const { user, token } = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  const sb = userScopedClient(token);

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'id required' });

  if (req.method === 'GET') {
    const [rec, schedules, costs, routes, documents] = await Promise.all([
      sb.from('travel_records').select('*').eq('id', id).single(),
      sb.from('travel_schedules').select('*').eq('travel_id', id).order('date', { ascending: true }).order('sort_order', { ascending: true }),
      sb.from('travel_costs').select('*').eq('travel_id', id).order('date', { ascending: false }),
      sb.from('travel_routes').select('*').eq('travel_id', id).order('travel_date', { ascending: true }),
      sb.from('travel_documents').select('*').eq('travel_id', id).order('created_at', { ascending: false }),
    ]);

    if (rec.error) {
      if (rec.error.code === 'PGRST116') return res.status(404).json({ error: 'not found' });
      return res.status(500).json({ error: rec.error.message });
    }
    return res.status(200).json({
      item: rec.data,
      schedules: schedules.data || [],
      costs: costs.data || [],
      routes: routes.data || [],
      documents: documents.data || [],
    });
  }

  if (req.method === 'PUT') {
    const b = req.body || {};
    const allowed = ['title', 'description', 'start_date', 'end_date', 'country', 'status',
                     'total_distance_km', 'total_cost_inr', 'total_cost_krw', 'photos', 'documents'];
    const patch = { updated_by: user.id };
    for (const k of allowed) if (k in b) patch[k] = b[k];

    const { data, error } = await sb
      .from('travel_records')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ item: data });
  }

  if (req.method === 'DELETE') {
    const { error } = await sb.from('travel_records').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(204).end();
  }

  res.setHeader('Allow', 'GET, PUT, DELETE');
  return res.status(405).json({ error: 'method not allowed' });
}
