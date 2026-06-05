// /api/dashboard/portfolio/[id] — GET / PUT (PATCH) / DELETE
import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { requireUser } from '../../../../lib/career-auth';
import type { PortfolioItem } from './index';

const ALLOWED_FIELDS: (keyof PortfolioItem)[] = [
  'project_name', 'description', 'role', 'start_date', 'end_date',
  'status', 'image_url', 'skills_used', 'impact', 'member_id',
];

type ItemResponse  = { item: PortfolioItem };
type ErrorResponse = { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ItemResponse | ErrorResponse>
) {
  const id = typeof req.query.id === 'string' ? req.query.id : null;
  if (!id) return res.status(400).json({ error: 'id required' });

  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('portfolio_items')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data)  return res.status(404).json({ error: 'not_found' });
    return res.status(200).json({ item: data as PortfolioItem });
  }

  // Writes require auth
  const { error: authErr } = await requireUser(req);
  if (authErr) return res.status(authErr.status).json(authErr.body as ErrorResponse);

  if (req.method === 'PUT' || req.method === 'PATCH') {
    const b = (req.body || {}) as Partial<PortfolioItem>;
    const patch: Record<string, unknown> = {};
    for (const k of ALLOWED_FIELDS) {
      if (k in b) patch[k] = b[k];
    }
    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: 'no_fields' });
    }

    const { data, error } = await supabaseAdmin
      .from('portfolio_items')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();

    if (error) return res.status(500).json({ error: error.message });
    if (!data)  return res.status(404).json({ error: 'not_found' });
    return res.status(200).json({ item: data as PortfolioItem });
  }

  if (req.method === 'DELETE') {
    const { error } = await supabaseAdmin
      .from('portfolio_items')
      .delete()
      .eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(204).end();
  }

  res.setHeader('Allow', 'GET, PUT, PATCH, DELETE');
  return res.status(405).json({ error: 'method_not_allowed' });
}
