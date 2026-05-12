// /api/career/companies — list + create
import { supabaseAdmin } from '../../../lib/supabase-admin';
import { requireUser } from '../../../lib/career-auth';

export default async function handler(req, res) {
  const { user, error: authErr } = await requireUser(req);
  if (authErr) return res.status(authErr.status).json(authErr.body);

  if (req.method === 'GET') {
    const { data: companies, error } = await supabaseAdmin
      .from('career_companies')
      .select('*')
      .eq('user_id', user.id)
      .order('start_date', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });

    // Counts per company (single round-trip each is fine for small N)
    const ids = companies.map(c => c.id);
    let projCounts = {};
    let achCounts = {};
    if (ids.length > 0) {
      const { data: projs } = await supabaseAdmin
        .from('career_projects')
        .select('company_id')
        .eq('user_id', user.id)
        .in('company_id', ids);
      const { data: achs } = await supabaseAdmin
        .from('career_achievements')
        .select('company_id')
        .eq('user_id', user.id)
        .in('company_id', ids);
      for (const r of projs || []) projCounts[r.company_id] = (projCounts[r.company_id] || 0) + 1;
      for (const r of achs  || []) achCounts[r.company_id]  = (achCounts[r.company_id]  || 0) + 1;
    }
    const enriched = companies.map(c => ({
      ...c,
      project_count:     projCounts[c.id] || 0,
      achievement_count: achCounts[c.id]  || 0,
    }));
    return res.status(200).json({ companies: enriched });
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    if (!body.name || !body.start_date) {
      return res.status(400).json({ error: 'name and start_date required' });
    }
    const payload = {
      user_id:         user.id,
      name:            body.name,
      name_short:      body.name_short || null,
      country:         body.country || 'India',
      city:            body.city || null,
      industry:        body.industry || null,
      logo_url:        body.logo_url || null,
      department:      body.department || null,
      title:           body.title || null,
      employment_type: body.employment_type || 'full_time',
      start_date:      body.start_date,
      end_date:        body.end_date || null,
      is_current:      !!body.is_current,
      is_public:       !!body.is_public,
      sort_order:      body.sort_order ?? 0,
    };
    const { data, error } = await supabaseAdmin
      .from('career_companies')
      .insert(payload)
      .select('*')
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ company: data });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'method_not_allowed' });
}
