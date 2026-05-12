// /api/career/profile/check-slug?slug=... — returns { available: bool }
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { requireUser } from '../../../../lib/career-auth';

function normalizeSlug(v) {
  return String(v || '').toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  const { user, error: authErr } = await requireUser(req);
  if (authErr) return res.status(authErr.status).json(authErr.body);

  const slug = normalizeSlug(req.query.slug);
  if (!slug) return res.status(200).json({ available: false, slug, reason: 'empty' });

  const { data, error } = await supabaseAdmin
    .from('career_profiles')
    .select('user_id')
    .eq('slug', slug)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });

  const available = !data || data.user_id === user.id;
  return res.status(200).json({ available, slug });
}
