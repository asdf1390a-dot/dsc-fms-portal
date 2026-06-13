// GET /api/assets/qr-validate?payload=...
//
// QR landing endpoint. Accepts a raw QR payload (either a URL whose last
// segment is the asset_id / machine_asset_number, or a bare
// machine_asset_number / qr_payload string) and resolves it to a minimal
// asset summary used by the mobile validate page.
//
// Lookup order (first hit wins):
//   1. payload == assets.qr_payload
//   2. payload == assets.machine_asset_number
//   3. payload contains a URL whose last non-empty path segment matches
//      assets.id (UUID) — used when the QR encodes
//      https://.../assets/<id>/qr-validate
//   4. last path segment matches assets.machine_asset_number
//
// Auth: required (Bearer token) — same as other asset endpoints.
//
// Responses:
//   200 — { asset_id, asset_name, machine_asset_number, serial_number,
//           location, status }
//   400 — missing payload
//   401 — missing/invalid JWT
//   404 — payload did not resolve to an asset
//   405 — non-GET
//   500 — database error

import { supabaseAdmin } from '../../../lib/supabase-admin';
import { requireUser } from '../../../lib/career-auth';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Extract the last non-empty path segment from a URL, or null if not URL-like.
function lastPathSegment(s) {
  if (typeof s !== 'string') return null;
  // Strip query/fragment.
  let str = s.split('#')[0].split('?')[0];
  // If string looks like a URL, normalize via URL parser.
  try {
    if (/^https?:\/\//i.test(str)) {
      const u = new URL(str);
      str = u.pathname;
    }
  } catch (_e) { /* fall through */ }
  const segs = str.split('/').map((x) => x.trim()).filter(Boolean);
  if (segs.length === 0) return null;
  // For the pattern /assets/<id>/qr-validate, the last segment is "qr-validate"
  // — we want the segment immediately after "assets". Otherwise the last seg.
  const assetsIdx = segs.indexOf('assets');
  if (assetsIdx >= 0 && segs[assetsIdx + 1]) return segs[assetsIdx + 1];
  return segs[segs.length - 1];
}

const SELECT_COLS =
  'id, name_en, machine_asset_number, serial_no, location, status';

function toSummary(row) {
  if (!row) return null;
  return {
    asset_id: row.id,
    asset_name: row.name_en,
    machine_asset_number: row.machine_asset_number,
    serial_number: row.serial_no,
    location: row.location,
    status: row.status,
  };
}

async function findByEq(col, val) {
  const { data, error } = await supabaseAdmin
    .from('assets')
    .select(SELECT_COLS)
    .eq(col, val)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const { error: authErr } = await requireUser(req);
  if (authErr) return res.status(authErr.status).json(authErr.body);

  const raw = req.query.payload;
  const payload = typeof raw === 'string' ? raw.trim() : '';
  if (!payload) {
    return res.status(400).json({ error: 'payload is required' });
  }

  try {
    // 1. exact qr_payload match
    let row = await findByEq('qr_payload', payload);

    // 2. exact machine_asset_number match
    if (!row) row = await findByEq('machine_asset_number', payload);

    // 3 + 4. URL-style payload — pull the relevant path segment and retry.
    if (!row) {
      const seg = lastPathSegment(payload);
      if (seg && seg !== payload) {
        if (UUID_RE.test(seg)) {
          row = await findByEq('id', seg);
        }
        if (!row) row = await findByEq('machine_asset_number', seg);
        if (!row) row = await findByEq('qr_payload', seg);
      }
    }

    if (!row) {
      return res.status(404).json({ error: 'asset_not_found' });
    }

    return res.status(200).json(toSummary(row));
  } catch (e) {
    console.error('[assets/qr-validate] fatal', e);
    return res.status(500).json({ error: e?.message || 'internal_error' });
  }
}
