// /api/dashboard/portfolio — list (?memberId, ?status) + create
// Table: portfolio_items (member_id, project_name, description, role,
//        start_date, end_date, status, image_url, skills_used[], impact)
import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { requireUser } from '../../../../lib/career-auth';

export type PortfolioItem = {
  id: string;
  member_id: string;
  project_name: string;
  description: string | null;
  role: string | null;
  start_date: string | null;
  end_date: string | null;
  status: 'in_progress' | 'completed' | 'on_hold' | 'planned' | string;
  image_url: string | null;
  skills_used: string[] | null;
  impact: string | null;
  created_at: string;
};

type ListResponse  = { items: PortfolioItem[] };
type ItemResponse  = { item: PortfolioItem };
type ErrorResponse = { error: string; details?: unknown };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ListResponse | ItemResponse | ErrorResponse>
) {
  if (req.method === 'GET') {
    const memberId = typeof req.query.memberId === 'string' ? req.query.memberId : undefined;
    const status   = typeof req.query.status   === 'string' ? req.query.status   : undefined;

    let q = supabaseAdmin
      .from('portfolio_items')
      .select('*')
      .order('created_at', { ascending: false });

    if (memberId) q = q.eq('member_id', memberId);
    if (status)   q = q.eq('status', status);

    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ items: (data || []) as PortfolioItem[] });
  }

  // Writes require auth (RLS: authenticated INSERT)
  const { user, error: authErr } = await requireUser(req);
  if (authErr) return res.status(authErr.status).json(authErr.body as ErrorResponse);

  if (req.method === 'POST') {
    const b = (req.body || {}) as Partial<PortfolioItem> & { project_name?: string };
    const projectName = b.project_name;
    const memberId    = b.member_id || user.id;

    if (!projectName) {
      return res.status(400).json({ error: 'project_name is required' });
    }

    const payload = {
      member_id:    memberId,
      project_name: projectName,
      description:  b.description ?? null,
      role:         b.role ?? null,
      start_date:   b.start_date ?? null,
      end_date:     b.end_date ?? null,
      status:       b.status ?? 'in_progress',
      image_url:    b.image_url ?? null,
      skills_used:  Array.isArray(b.skills_used) ? b.skills_used : null,
      impact:       b.impact ?? null,
    };

    const { data, error } = await supabaseAdmin
      .from('portfolio_items')
      .insert(payload)
      .select('*')
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ item: data as PortfolioItem });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'method_not_allowed' });
}
