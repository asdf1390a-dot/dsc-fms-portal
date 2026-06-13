// /api/assets/[assetId]/scans
//   POST : log a QR scan event for an asset (audit trail).
//   GET  : list paginated scan history for an asset.
//
// Auth: required (Bearer token) for both methods.
//
// ---------- POST ----------
// Body (JSON):
//   qr_payload    string, required, non-empty
//   device_info?  string, optional. Defaults to req.headers['user-agent'].
//   location_gps? string, optional, format "lat,lon" (e.g. "12.9716,77.5946").
//
// Responses:
//   201 — { id, asset_id, qr_payload, scanned_at, scanned_by, device_info, location_gps }
//   400 — missing qr_payload or malformed location_gps
//   401 — missing/invalid JWT
//   404 — asset_id not found
//   500 — database error
//
// ---------- GET ----------
// Query Parameters:
//   limit?      integer 1..100, default 20
//   offset?     integer >=0,   default 0
//   from_date?  ISO date "YYYY-MM-DD" (scanned_at >= from_date 00:00:00 UTC)
//   to_date?    ISO date "YYYY-MM-DD" (scanned_at <= to_date 23:59:59 UTC)
//   scanned_by? UUID (filter by user)
//
// Responses:
//   200 — { data: [{ id, asset_id, qr_payload, scanned_at, scanned_by,
//                    scanned_by_email, device_info, location_gps }],
//           total, hasMore, limit, offset }
//   400 — invalid limit/offset/date format/UUID
//   401 — missing/invalid JWT
//   404 — asset_id not found
//   500 — database error
//
// ---------- 405 ---------- on any other method.

import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { requireUser } from '../../../../lib/career-auth';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// "lat,lon" where lat in [-90, 90], lon in [-180, 180].
function isValidLatLon(s) {
  if (typeof s !== 'string') return false;
  const parts = s.split(',');
  if (parts.length !== 2) return false;
  const lat = Number(parts[0].trim());
  const lon = Number(parts[1].trim());
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  if (lat < -90 || lat > 90) return false;
  if (lon < -180 || lon > 180) return false;
  return true;
}

function parseIntOrNull(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return NaN;
  return n;
}

async function assertAssetExists(assetId, res) {
  const { data: asset, error: lookupErr } = await supabaseAdmin
    .from('assets')
    .select('id')
    .eq('id', assetId)
    .maybeSingle();

  if (lookupErr) {
    console.error('[assets/[assetId]/scans] asset lookup', lookupErr);
    res.status(500).json({ error: lookupErr.message });
    return false;
  }
  if (!asset) {
    res.status(404).json({ error: 'asset_not_found' });
    return false;
  }
  return true;
}

async function handlePost(req, res, user) {
  const { assetId } = req.query;

  const body = req.body || {};
  const qr_payload = typeof body.qr_payload === 'string' ? body.qr_payload.trim() : '';
  if (!qr_payload) {
    return res.status(400).json({ error: 'qr_payload is required' });
  }

  const device_info =
    (typeof body.device_info === 'string' && body.device_info.trim())
      ? body.device_info.trim()
      : (req.headers['user-agent'] || null);

  let location_gps = null;
  if (body.location_gps !== undefined && body.location_gps !== null && body.location_gps !== '') {
    if (!isValidLatLon(body.location_gps)) {
      return res.status(400).json({ error: 'location_gps must be "lat,lon" format' });
    }
    location_gps = String(body.location_gps).trim();
  }

  if (!(await assertAssetExists(assetId, res))) return;

  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from('asset_qr_scans')
    .insert({
      asset_id: assetId,
      qr_payload,
      scanned_by: user.id,
      device_info,
      location_gps,
    })
    .select('id, asset_id, qr_payload, scanned_at, scanned_by, device_info, location_gps')
    .single();

  if (insertErr) {
    console.error('[assets/[assetId]/scans] insert', insertErr);
    return res.status(500).json({ error: insertErr.message });
  }

  return res.status(201).json(inserted);
}

async function handleGet(req, res) {
  const { assetId } = req.query;

  // Parse + validate query params.
  const rawLimit = parseIntOrNull(req.query.limit);
  if (rawLimit !== null && Number.isNaN(rawLimit)) {
    return res.status(400).json({ error: 'limit must be an integer' });
  }
  const rawOffset = parseIntOrNull(req.query.offset);
  if (rawOffset !== null && Number.isNaN(rawOffset)) {
    return res.status(400).json({ error: 'offset must be an integer' });
  }
  const limit = Math.min(Math.max(rawLimit ?? 20, 1), 100);
  const offset = Math.max(rawOffset ?? 0, 0);

  const from_date = req.query.from_date ? String(req.query.from_date) : null;
  const to_date = req.query.to_date ? String(req.query.to_date) : null;
  if (from_date && !DATE_RE.test(from_date)) {
    return res.status(400).json({ error: 'from_date must be YYYY-MM-DD' });
  }
  if (to_date && !DATE_RE.test(to_date)) {
    return res.status(400).json({ error: 'to_date must be YYYY-MM-DD' });
  }

  const scanned_by = req.query.scanned_by ? String(req.query.scanned_by) : null;
  if (scanned_by && !UUID_RE.test(scanned_by)) {
    return res.status(400).json({ error: 'scanned_by must be a UUID' });
  }

  const fromTs = from_date ? `${from_date}T00:00:00Z` : null;
  const toTs = to_date ? `${to_date}T23:59:59Z` : null;

  if (!(await assertAssetExists(assetId, res))) return;

  // Build the base filter. Use a HEAD count query for total, and a range query for the page.
  function applyFilters(q) {
    q = q.eq('asset_id', assetId);
    if (fromTs) q = q.gte('scanned_at', fromTs);
    if (toTs) q = q.lte('scanned_at', toTs);
    if (scanned_by) q = q.eq('scanned_by', scanned_by);
    return q;
  }

  try {
    const countQuery = applyFilters(
      supabaseAdmin.from('asset_qr_scans').select('id', { count: 'exact', head: true })
    );
    const { count, error: countErr } = await countQuery;
    if (countErr) {
      console.error('[assets/[assetId]/scans] count', countErr);
      return res.status(500).json({ error: countErr.message });
    }

    const pageQuery = applyFilters(
      supabaseAdmin
        .from('asset_qr_scans')
        .select('id, asset_id, qr_payload, scanned_at, scanned_by, device_info, location_gps')
    )
      .order('scanned_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: results, error: pageErr } = await pageQuery;
    if (pageErr) {
      console.error('[assets/[assetId]/scans] page', pageErr);
      return res.status(500).json({ error: pageErr.message });
    }

    // Resolve scanned_by_email via auth.admin.getUserById for each distinct user.
    // Supabase JS cannot join auth.users directly; we batch-lookup uniques.
    const rows = results || [];
    const uniqueUserIds = Array.from(
      new Set(rows.map((r) => r.scanned_by).filter(Boolean))
    );
    const emailById = new Map();
    await Promise.all(
      uniqueUserIds.map(async (uid) => {
        try {
          const { data: u, error: uErr } =
            await supabaseAdmin.auth.admin.getUserById(uid);
          if (!uErr && u?.user?.email) emailById.set(uid, u.user.email);
        } catch (_e) { /* swallow — email is best-effort */ }
      })
    );

    const data = rows.map((r) => ({
      ...r,
      scanned_by_email: r.scanned_by ? emailById.get(r.scanned_by) || null : null,
    }));

    const total = count ?? 0;
    const hasMore = offset + data.length < total;

    return res.status(200).json({
      data,
      total,
      hasMore,
      limit,
      offset,
    });
  } catch (e) {
    console.error('[assets/[assetId]/scans] GET fatal', e);
    return res.status(500).json({ error: e?.message || 'internal_error' });
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const { user, error: authErr } = await requireUser(req);
  if (authErr) return res.status(authErr.status).json(authErr.body);

  const { assetId } = req.query;
  if (!assetId || typeof assetId !== 'string') {
    return res.status(400).json({ error: 'assetId is required' });
  }

  try {
    if (req.method === 'POST') return await handlePost(req, res, user);
    return await handleGet(req, res);
  } catch (e) {
    console.error('[assets/[assetId]/scans] fatal', e);
    return res.status(500).json({ error: e?.message || 'internal_error' });
  }
}
