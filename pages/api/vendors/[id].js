import { getUserFromRequest, userScopedClient } from '../../../lib/api-auth';
import { supabaseAdmin } from '../../../lib/supabase-admin';

export default async function handler(req, res) {
  const { id } = req.query;

  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin.from('vendors').select('*').eq('id', id).maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'not found' });
    return res.json({ item: data });
  }

  const { user, token } = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  const sb = userScopedClient(token);

  if (req.method === 'PATCH') {
    const b = req.body || {};
    const patch = {};
    for (const k of ['name','name_short','country','city','contact_name','contact_phone','contact_email','address','payment_terms','currency','notes','is_active']) {
      if (k in b) patch[k] = b[k];
    }
    if ('lead_time_days' in b) {
      patch.lead_time_days = b.lead_time_days != null && b.lead_time_days !== '' ? parseInt(b.lead_time_days, 10) : null;
    }
    const { data, error } = await sb.from('vendors').update(patch).eq('id', id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ item: data });
  }

  if (req.method === 'DELETE') {
    // 연결된 부품 체크
    const { count } = await supabaseAdmin.from('spare_parts').select('id', { count: 'exact', head: true }).eq('vendor_id', id);
    if ((count ?? 0) > 0) {
      return res.status(400).json({ error: `${count}개 부품이 연결되어 있습니다. 먼저 부품의 공급업체를 변경하세요.` });
    }
    const { error } = await sb.from('vendors').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: 'method not allowed' });
}
