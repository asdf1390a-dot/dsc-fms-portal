// /api/career/profile — GET / POST / PATCH (self)
import { supabaseAdmin } from '../../../lib/supabase-admin';
import { requireUser } from '../../../lib/career-auth';

const ALLOWED = [
  'slug','display_name','headline','bio','avatar_url',
  'contact_email','linkedin_url','github_url','is_public',
];

function normalizeSlug(v) {
  return String(v || '').toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export default async function handler(req, res) {
  const { user, error: authErr } = await requireUser(req);
  if (authErr) return res.status(authErr.status).json(authErr.body);

  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('career_profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ profile: data || null });
  }

  if (req.method === 'POST') {
    const b = req.body || {};
    const slug = normalizeSlug(b.slug);
    if (!slug) return res.status(400).json({ error: 'slug required' });

    // dup check
    const { data: dup } = await supabaseAdmin
      .from('career_profiles')
      .select('user_id')
      .eq('slug', slug)
      .maybeSingle();
    if (dup && dup.user_id !== user.id) {
      return res.status(409).json({ error: 'slug_taken' });
    }

    const payload = {
      user_id:       user.id,
      slug,
      display_name:  b.display_name || null,
      headline:      b.headline || null,
      bio:           b.bio || null,
      avatar_url:    b.avatar_url || null,
      contact_email: b.contact_email || null,
      linkedin_url:  b.linkedin_url || null,
      github_url:    b.github_url || null,
      is_public:     !!b.is_public,
    };
    const { data, error } = await supabaseAdmin
      .from('career_profiles')
      .upsert(payload, { onConflict: 'user_id' })
      .select('*')
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ profile: data });
  }

  if (req.method === 'PATCH') {
    const b = req.body || {};
    const patch = {};
    for (const k of ALLOWED) if (k in b) patch[k] = b[k];
    if ('slug' in patch) {
      patch.slug = normalizeSlug(patch.slug);
      if (!patch.slug) return res.status(400).json({ error: 'invalid_slug' });
      const { data: dup } = await supabaseAdmin
        .from('career_profiles')
        .select('user_id')
        .eq('slug', patch.slug)
        .maybeSingle();
      if (dup && dup.user_id !== user.id) {
        return res.status(409).json({ error: 'slug_taken' });
      }
    }
    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: 'no_fields' });
    }
    const { data, error } = await supabaseAdmin
      .from('career_profiles')
      .update(patch)
      .eq('user_id', user.id)
      .select('*')
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ profile: data });
  }

  res.setHeader('Allow', 'GET, POST, PATCH');
  return res.status(405).json({ error: 'method_not_allowed' });
}
