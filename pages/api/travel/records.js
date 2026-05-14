// GET  /api/travel/records       — list current user's travel records
// POST /api/travel/records       — create a new travel record
import { getUserFromRequest, userScopedClient } from '../../../lib/api-auth';

export default async function handler(req, res) {
  const { user, token } = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  const sb = userScopedClient(token);

  if (req.method === 'GET') {
    const { status, q, limit = 200 } = req.query;
    let query = sb
      .from('travel_records')
      .select('id, title, description, start_date, end_date, country, status, total_distance_km, total_cost_inr, total_cost_krw, created_at, updated_at')
      .order('start_date', { ascending: false })
      .limit(Math.min(Number(limit) || 200, 500));

    if (status && status !== 'all') query = query.eq('status', status);
    if (q) query = query.ilike('title', `%${q}%`);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ items: data || [] });
  }

  if (req.method === 'POST') {
    const b = req.body || {};
    if (!b.title || !b.start_date || !b.end_date) {
      return res.status(400).json({ error: 'title, start_date, end_date required' });
    }
    const payload = {
      user_id: user.id,
      title: String(b.title).trim(),
      description: b.description || null,
      start_date: b.start_date,
      end_date: b.end_date,
      country: b.country || 'India',
      status: b.status || 'planning',
      created_by: user.id,
      updated_by: user.id,
    };
    const { data, error } = await sb.from('travel_records').insert(payload).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ item: data });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'method not allowed' });
}
