// POST /api/photos/upload
// Authenticated upload to Supabase Storage bucket 'asset-photos'.
// Body (JSON): { asset_id, filename, content_type, data (base64 dataURL) }
// Auth: Bearer token (Supabase JWT) in Authorization header.
//
// Why server-side: Storage RLS for the bucket has no anon write policy yet
// (would need DDL to add). Service_role bypasses RLS while we still verify
// the caller via their Supabase session token.

import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../../lib/supabase-admin';

export const config = {
  api: { bodyParser: { sizeLimit: '50mb' } },
  maxDuration: 60,
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  // Auth: verify caller's Supabase JWT
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'missing_token' });

  const { data: who, error: whoErr } = await supabaseAdmin.auth.getUser(token);
  if (whoErr || !who?.user) return res.status(401).json({ error: 'invalid_token' });
  const userId = who.user.id;

  const { asset_id, filename, content_type, data } = req.body || {};
  if (!asset_id || !filename || !content_type || !data) {
    return res.status(400).json({ error: 'missing_fields' });
  }
  if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(content_type)) {
    return res.status(400).json({ error: 'unsupported_mime', got: content_type });
  }

  // data is "data:image/jpeg;base64,...."
  const m = /^data:[^;]+;base64,(.+)$/.exec(data);
  if (!m) return res.status(400).json({ error: 'bad_data_url' });
  const buf = Buffer.from(m[1], 'base64');
  if (buf.length > 10 * 1024 * 1024) return res.status(413).json({ error: 'too_large' });

  // Verify asset exists, get its tag for path readability
  const { data: asset, error: aErr } = await supabaseAdmin
    .from('assets')
    .select('id, machine_asset_number, photos')
    .eq('id', asset_id)
    .maybeSingle();
  if (aErr) return res.status(500).json({ error: aErr.message });
  if (!asset) return res.status(404).json({ error: 'asset_not_found' });

  // Build storage key: <asset_number>/<timestamp>-<safeFilename>
  const safeName = filename.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80);
  const ext = (filename.split('.').pop() || 'jpg').toLowerCase();
  const key = `${asset.machine_asset_number}/${Date.now()}-${safeName.endsWith(ext) ? safeName : `${safeName}.${ext}`}`;

  const { error: upErr } = await supabaseAdmin.storage
    .from('asset-photos')
    .upload(key, buf, { contentType: content_type, upsert: false });
  if (upErr) return res.status(500).json({ error: upErr.message });

  const { data: pub } = supabaseAdmin.storage.from('asset-photos').getPublicUrl(key);
  const photoUrl = pub.publicUrl;

  // Append URL to asset.photos and bump updated_by
  const newPhotos = [...(asset.photos || []), photoUrl];
  const { error: updErr } = await supabaseAdmin
    .from('assets')
    .update({ photos: newPhotos, updated_by: userId })
    .eq('id', asset.id);
  if (updErr) return res.status(500).json({ error: updErr.message });

  return res.status(200).json({ url: photoUrl, key, photos: newPhotos });
}
