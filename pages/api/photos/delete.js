// POST /api/photos/delete
// Body: { asset_id, url }
// Auth: Bearer token. Removes one photo from the asset's photos array
// and (best-effort) the underlying Storage object.

import { supabaseAdmin } from '../../../lib/supabase-admin';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'missing_token' });
  const { data: who, error: whoErr } = await supabaseAdmin.auth.getUser(token);
  if (whoErr || !who?.user) return res.status(401).json({ error: 'invalid_token' });

  const { asset_id, url } = req.body || {};
  if (!asset_id || !url) return res.status(400).json({ error: 'missing_fields' });

  const { data: asset, error: aErr } = await supabaseAdmin
    .from('assets').select('id, photos').eq('id', asset_id).maybeSingle();
  if (aErr) return res.status(500).json({ error: aErr.message });
  if (!asset) return res.status(404).json({ error: 'asset_not_found' });

  const remaining = (asset.photos || []).filter(p => p !== url);

  // Best-effort delete from storage (parse key from public URL)
  const match = /\/storage\/v1\/object\/public\/asset-photos\/(.+)$/.exec(url);
  if (match) {
    await supabaseAdmin.storage.from('asset-photos').remove([match[1]]).catch(() => {});
  }

  const { error: updErr } = await supabaseAdmin
    .from('assets').update({ photos: remaining, updated_by: who.user.id })
    .eq('id', asset.id);
  if (updErr) return res.status(500).json({ error: updErr.message });

  return res.status(200).json({ photos: remaining });
}
