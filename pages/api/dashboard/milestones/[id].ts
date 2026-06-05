// /api/dashboard/milestones/[id] — GET / PUT (PATCH) / DELETE
import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { requireUser } from '../../../../lib/career-auth';
import type { Milestone, MilestoneStatus } from './index';

const ALLOWED_FIELDS: (keyof Milestone)[] = [
  'project_id', 'title', 'description', 'target_date',
  'status', 'owner_id', 'completion_date',
];

const VALID_STATUS: MilestoneStatus[] = ['pending', 'in_progress', 'completed', 'blocked'];

type ItemResponse  = { item: Milestone };
type ErrorResponse = { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ItemResponse | ErrorResponse>
) {
  const id = typeof req.query.id === 'string' ? req.query.id : null;
  if (!id) return res.status(400).json({ error: 'id required' });

  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('milestones')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data)  return res.status(404).json({ error: 'not_found' });
    return res.status(200).json({ item: data as Milestone });
  }

  // Writes require auth
  const { error: authErr } = await requireUser(req);
  if (authErr) return res.status(authErr.status).json(authErr.body as ErrorResponse);

  if (req.method === 'PUT' || req.method === 'PATCH') {
    const b = (req.body || {}) as Partial<Milestone>;
    const patch: Record<string, unknown> = {};
    for (const k of ALLOWED_FIELDS) {
      if (k in b) patch[k] = b[k];
    }
    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: 'no_fields' });
    }
    if (patch.status && !VALID_STATUS.includes(patch.status as MilestoneStatus)) {
      return res.status(400).json({ error: 'invalid_status' });
    }

    // Auto-set completion_date when transitioning to completed
    if (patch.status === 'completed' && !('completion_date' in patch)) {
      patch.completion_date = new Date().toISOString().slice(0, 10);
    }

    const { data, error } = await supabaseAdmin
      .from('milestones')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();

    if (error) return res.status(500).json({ error: error.message });
    if (!data)  return res.status(404).json({ error: 'not_found' });
    return res.status(200).json({ item: data as Milestone });
  }

  if (req.method === 'DELETE') {
    const { error } = await supabaseAdmin
      .from('milestones')
      .delete()
      .eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(204).end();
  }

  res.setHeader('Allow', 'GET, PUT, PATCH, DELETE');
  return res.status(405).json({ error: 'method_not_allowed' });
}
