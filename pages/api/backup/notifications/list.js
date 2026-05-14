// GET /api/backup/notifications/list — paginated list of backup notifications
// for the authenticated user.
//
// Query:
//   type?   one of success | failure | quota_warning | quota_exceeded | deletion_scheduled
//   unread? '1' to return only notifications where read_at IS NULL
//   limit?  1..200 (default 20)   — matches metrics/daily pagination default
//   offset? >=0    (default 0)
//
// Order: created_at desc (latest first — per sort-order rule for event logs).
//
// Auth: Bearer JWT (user).

import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { requireUser } from '../../../../lib/career-auth';

const VALID_TYPES = new Set([
  'success',
  'failure',
  'quota_warning',
  'quota_exceeded',
  'deletion_scheduled',
]);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const { user, error: authErr } = await requireUser(req);
  if (authErr) return res.status(authErr.status).json(authErr.body);

  const { type, unread } = req.query;
  let limit = Number(req.query.limit ?? 20);
  let offset = Number(req.query.offset ?? 0);
  const errors = [];

  if (type && !VALID_TYPES.has(String(type))) {
    errors.push(`type must be one of ${[...VALID_TYPES].join(', ')}`);
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
    errors.push('limit must be integer 1..200');
  }
  if (!Number.isInteger(offset) || offset < 0) {
    errors.push('offset must be non-negative integer');
  }
  if (errors.length) {
    return res.status(400).json({ error: 'invalid_request', details: errors });
  }

  try {
    let q = supabaseAdmin
      .from('backup_notifications')
      .select(
        'id, backup_id, notification_type, message, notification_channel, sent_at, read_at, created_at',
        { count: 'exact' },
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (type) q = q.eq('notification_type', type);
    if (String(unread || '') === '1') q = q.is('read_at', null);

    const { data, error, count } = await q;
    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({
      success: true,
      user_id: user.id,
      total: count ?? null,
      limit,
      offset,
      notifications: data || [],
    });
  } catch (e) {
    console.error('[notifications/list] fatal', e);
    return res.status(500).json({ error: e?.message || 'internal_error' });
  }
}
