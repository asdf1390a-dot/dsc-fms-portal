import { getUserFromRequest, userScopedClient } from '../../../lib/api-auth';
import { supabaseAdmin } from '../../../lib/supabase-admin';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const active = req.query.active;
    let q = supabaseAdmin.from('vendors').select('*');
    if (active === '1' || active === 'true') q = q.eq('is_active', true);
    else if (active === '0' || active === 'false') q = q.eq('is_active', false);
    q = q.order('name');
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ items: data || [] });
  }

  if (req.method === 'POST') {
    const { user, token } = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: 'unauthorized' });
    const sb = userScopedClient(token);
    const b = req.body || {};
    if (!b.name) return res.status(400).json({ error: 'name required' });
    const { data, error } = await sb.from('vendors').insert({
      name: b.name,
      name_short: b.name_short || null,
      country: b.country || 'India',
      city: b.city || null,
      contact_name: b.contact_name || null,
      contact_phone: b.contact_phone || null,
      contact_email: b.contact_email || null,
      address: b.address || null,
      lead_time_days: b.lead_time_days != null && b.lead_time_days !== '' ? parseInt(b.lead_time_days, 10) : null,
      payment_terms: b.payment_terms || null,
      currency: b.currency || 'INR',
      is_active: b.is_active !== false,
      notes: b.notes || null,
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ item: data });
  }

  return res.status(405).json({ error: 'method not allowed' });
}
