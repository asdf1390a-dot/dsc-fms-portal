// POST /api/backup/notifications/[id]/read — mark a single notification as
// read for the authenticated user. Idempotent: if read_at is already set,
// the existing timestamp is returned unchanged.
//
// Auth: Bearer JWT (user). Ownership is verified before update.

import { supabaseAdmin } from '../../../../../lib/supabase-admin';
import { requireUser } from '../../../../../lib/career-auth';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  // Accept POST (per task spec) and PUT (per design doc) — same behavior.
  if (req.method !== 'POST' && req.method !== 'PUT') {
    res.setHeader('Allow', 'POST, PUT');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const { user, error: authErr } = await requireUser(req);
  if (authErr) return res.status(authErr.status).json(authErr.body);

  const id = String(req.query.id || '');
  if (!UUID_RE.test(id)) {
    return res.status(400).json({ error: 'invalid_request', details: ['id must be uuid'] });
  }

  try {
    // 1. Ownership check
    const { data: existing, error: selErr } = await supabaseAdmin
      .from('backup_notifications')
      .select('id, user_id, read_at')
      .eq('id', id)
      .maybeSingle();

    if (selErr) return res.status(500).json({ error: selErr.message });
    if (!existing || existing.user_id !== user.id) {
      return res.status(404).json({ error: 'not_found' });
    }

    // 2. Idempotent: already read
    if (existing.read_at) {
      return res.status(200).json({
        success: true,
        id: existing.id,
        read_at: existing.read_at,
        already_read: true,
      });
    }

    // 3. Update
    const now = new Date().toISOString();
    const { data: updated, error: upErr } = await supabaseAdmin
      .from('backup_notifications')
      .update({ read_at: now })
      .eq('id', id)
      .eq('user_id', user.id)
      .select('id, read_at')
      .single();

    if (upErr) return res.status(500).json({ error: upErr.message });

    return res.status(200).json({
      success: true,
      id: updated.id,
      read_at: updated.read_at,
    });
  } catch (e) {
    console.error('[notifications/:id/read] fatal', e);
    return res.status(500).json({ error: e?.message || 'internal_error' });
  }
}
