// POST /api/bm/breakdowns/[id]/resolve
// Transition: in_progress -> resolved
// Required body: { action_taken: 10-1000 chars }
// Optional: { resolved_at, root_cause }

import { authenticate, performTransition } from '../../../../../lib/bm-transition';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  const { user, error } = await authenticate(req);
  if (error) return res.status(error.status).json(error.body);

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'missing_id' });

  const result = await performTransition({
    id, targetStatus: 'resolved', body: req.body || {}, user,
  });
  return res.status(result.status).json(result.body);
}
