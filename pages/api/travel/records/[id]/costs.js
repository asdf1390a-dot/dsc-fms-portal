// POST   /api/travel/records/:id/costs              — add a cost entry (optionally with splits)
// PATCH  /api/travel/records/:id/costs?cid=         — update cost
// DELETE /api/travel/records/:id/costs?cid=         — delete cost (cascades splits)
import { getUserFromRequest, userScopedClient } from '../../../../../lib/api-auth';

export default async function handler(req, res) {
  const { user, token } = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  const sb = userScopedClient(token);

  const { id, cid } = req.query;
  if (!id) return res.status(400).json({ error: 'travel id required' });

  if (req.method === 'POST') {
    const b = req.body || {};
    if (!b.cost_type || b.amount == null || !b.date) {
      return res.status(400).json({ error: 'cost_type, amount, date required' });
    }
    const payload = {
      travel_id: id,
      cost_type: String(b.cost_type),
      description: b.description || null,
      amount: Number(b.amount),
      currency: b.currency || 'INR',
      exchange_rate: b.exchange_rate ?? null,
      receipt_url: b.receipt_url || null,
      date: b.date,
      created_by: user.id,
    };
    const ins = await sb.from('travel_costs').insert(payload).select().single();
    if (ins.error) return res.status(500).json({ error: ins.error.message });

    // Optional even-split across participant_ids[]
    const participantIds = Array.isArray(b.participant_ids) ? b.participant_ids : [];
    if (participantIds.length > 0) {
      const share = Math.round((Number(b.amount) / participantIds.length) * 100) / 100;
      const splitRows = participantIds.map(pid => ({
        cost_id: ins.data.id,
        participant_id: pid,
        share_amount: share,
      }));
      const sp = await sb.from('travel_cost_splits').insert(splitRows);
      if (sp.error) {
        // Best-effort: cost was already created. Report partial success.
        return res.status(201).json({ item: ins.data, split_error: sp.error.message });
      }
    }

    return res.status(201).json({ item: ins.data });
  }

  if (req.method === 'PATCH') {
    if (!cid) return res.status(400).json({ error: 'cid required' });
    const b = req.body || {};
    const allowed = ['cost_type', 'description', 'amount', 'currency', 'exchange_rate', 'receipt_url', 'date', 'is_approved'];
    const patch = {};
    for (const k of allowed) if (k in b) patch[k] = b[k];
    if ('is_approved' in patch && patch.is_approved) {
      patch.approved_by = user.id;
      patch.approved_at = new Date().toISOString();
    }
    const { data, error } = await sb.from('travel_costs').update(patch).eq('id', cid).eq('travel_id', id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ item: data });
  }

  if (req.method === 'DELETE') {
    if (!cid) return res.status(400).json({ error: 'cid required' });
    const { error } = await sb.from('travel_costs').delete().eq('id', cid).eq('travel_id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(204).end();
  }

  res.setHeader('Allow', 'POST, PATCH, DELETE');
  return res.status(405).json({ error: 'method not allowed' });
}
