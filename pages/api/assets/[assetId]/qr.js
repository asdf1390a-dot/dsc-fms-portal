// /api/assets/[assetId]/qr
//   GET    : generate QR code for asset's qr_payload
//   POST   : regenerate qr_payload (defaults to machine_asset_number unless body.payload provided)
//
// Query params (GET):
//   format = svg | png | dataurl   (default: svg)
//   size   = integer pixels (default 256, only used for png)
//
// Body (POST):
//   { payload?: string }   -- if omitted, resets to machine_asset_number
//
// Response (GET):
//   svg     -> image/svg+xml
//   png     -> image/png
//   dataurl -> { qr_payload, dataUrl }
//
// Response (POST):
//   { id, qr_payload, dataUrl }

import QRCode from 'qrcode';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { getUserFromRequest, userScopedClient } from '../../../../lib/api-auth';

export const dynamic = 'force-dynamic';

async function fetchAsset(id) {
  const { data, error } = await supabaseAdmin
    .from('assets')
    .select('id, machine_asset_code, machine_asset_number, qr_payload, name_en')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export default async function handler(req, res) {
  const { assetId } = req.query;
  const id = assetId;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'assetId required' });
  }

  if (req.method === 'GET') {
    const asset = await fetchAsset(id).catch(e => ({ _err: e.message }));
    if (asset?._err) return res.status(500).json({ error: asset._err });
    if (!asset) return res.status(404).json({ error: 'not_found' });

    const payload = asset.qr_payload || asset.machine_asset_number;
    if (!payload) return res.status(409).json({ error: 'no_payload' });

    const format = (req.query.format || 'svg').toString().toLowerCase();
    const size = Math.min(Math.max(parseInt(req.query.size, 10) || 256, 64), 2048);

    try {
      if (format === 'svg') {
        const svg = await QRCode.toString(payload, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
        res.setHeader('Content-Type', 'image/svg+xml');
        res.setHeader('Cache-Control', 'private, max-age=60');
        return res.status(200).send(svg);
      }
      if (format === 'png') {
        const buf = await QRCode.toBuffer(payload, { type: 'png', width: size, margin: 1, errorCorrectionLevel: 'M' });
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'private, max-age=60');
        return res.status(200).send(buf);
      }
      if (format === 'dataurl') {
        const dataUrl = await QRCode.toDataURL(payload, { margin: 1, width: size, errorCorrectionLevel: 'M' });
        return res.status(200).json({ qr_payload: payload, dataUrl });
      }
      return res.status(400).json({ error: 'unsupported_format', allowed: ['svg', 'png', 'dataurl'] });
    } catch (e) {
      return res.status(500).json({ error: 'qr_generation_failed', detail: e.message });
    }
  }

  if (req.method === 'POST') {
    const { user, token } = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: 'unauthorized' });

    const asset = await fetchAsset(id).catch(e => ({ _err: e.message }));
    if (asset?._err) return res.status(500).json({ error: asset._err });
    if (!asset) return res.status(404).json({ error: 'not_found' });

    const b = req.body || {};
    const newPayload = (b.payload && String(b.payload).trim())
      ? String(b.payload).trim()
      : asset.machine_asset_number;

    const sb = userScopedClient(token);
    const { data: after, error } = await sb
      .from('assets')
      .update({ qr_payload: newPayload, updated_by: user.id })
      .eq('id', id)
      .select('id, qr_payload')
      .single();
    if (error) return res.status(400).json({ code: error.code || 'UPDATE_ERROR', message: error.message });

    await supabaseAdmin.from('asset_audit').insert({
      asset_id: id,
      changed_by: user.id,
      action: 'update',
      diff: {
        before: { qr_payload: asset.qr_payload },
        after: { qr_payload: after.qr_payload },
        fields_changed: ['qr_payload'],
      },
    });

    let dataUrl = null;
    try {
      dataUrl = await QRCode.toDataURL(after.qr_payload, { margin: 1, width: 256, errorCorrectionLevel: 'M' });
    } catch (_) { /* ignore */ }

    return res.status(200).json({ id, qr_payload: after.qr_payload, dataUrl });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'method_not_allowed' });
}
