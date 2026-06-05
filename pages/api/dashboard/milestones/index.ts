// /api/dashboard/milestones — list (?projectId, ?status, ?ownerId) + create
// Table: milestones (project_id, title, description, target_date, status,
//                    owner_id, completion_date, created_at, updated_at)
import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { requireUser } from '../../../../lib/career-auth';

export type MilestoneStatus = 'pending' | 'in_progress' | 'completed' | 'blocked';

export type Milestone = {
  id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  target_date: string;
  status: MilestoneStatus;
  owner_id: string | null;
  completion_date: string | null;
  created_at: string;
  updated_at: string;
};

type ListResponse  = { items: Milestone[] };
type ItemResponse  = { item: Milestone };
type ErrorResponse = { error: string };

const VALID_STATUS: MilestoneStatus[] = ['pending', 'in_progress', 'completed', 'blocked'];

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ListResponse | ItemResponse | ErrorResponse>
) {
  if (req.method === 'GET') {
    const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : undefined;
    const status    = typeof req.query.status    === 'string' ? req.query.status    : undefined;
    const ownerId   = typeof req.query.ownerId   === 'string' ? req.query.ownerId   : undefined;

    let q = supabaseAdmin
      .from('milestones')
      .select('*')
      .order('target_date', { ascending: true });

    if (projectId) q = q.eq('project_id', projectId);
    if (status)    q = q.eq('status', status);
    if (ownerId)   q = q.eq('owner_id', ownerId);

    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ items: (data || []) as Milestone[] });
  }

  // Writes require auth (RLS: authenticated INSERT)
  const { user, error: authErr } = await requireUser(req);
  if (authErr) return res.status(authErr.status).json(authErr.body as ErrorResponse);

  if (req.method === 'POST') {
    const b = (req.body || {}) as Partial<Milestone>;
    if (!b.title)       return res.status(400).json({ error: 'title is required' });
    if (!b.target_date) return res.status(400).json({ error: 'target_date is required' });
    if (b.status && !VALID_STATUS.includes(b.status)) {
      return res.status(400).json({ error: 'invalid_status' });
    }

    const payload = {
      project_id:      b.project_id ?? null,
      title:           b.title,
      description:     b.description ?? null,
      target_date:     b.target_date,
      status:          b.status ?? 'pending',
      owner_id:        b.owner_id ?? user.id,
      completion_date: b.completion_date ?? null,
    };

    const { data, error } = await supabaseAdmin
      .from('milestones')
      .insert(payload)
      .select('*')
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ item: data as Milestone });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'method_not_allowed' });
}
