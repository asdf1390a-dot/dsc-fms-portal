// POST /api/bm/resolve
// BM 수리 완료 처리 — 원자적 업데이트 (status=resolved, resolved_at, downtime_end)
// 호출자의 Supabase JWT를 verify하여 user 정보를 함께 기록.

import { supabaseAdmin } from '../../../lib/supabase-admin';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  // Auth
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'missing_token' });

  const { data: who, error: whoErr } = await supabaseAdmin.auth.getUser(token);
  if (whoErr || !who?.user) return res.status(401).json({ error: 'invalid_token' });
  const user = who.user;
  const fullName =
    user.user_metadata?.full_name ||
    user.email ||
    null;

  const { id, resolver_name, action_taken, resolved_at } = req.body || {};
  if (!id) return res.status(400).json({ error: 'missing_id' });

  // 기존 이벤트 조회 (존재 확인)
  const { data: existing, error: getErr } = await supabaseAdmin
    .from('bm_events')
    .select('id, status')
    .eq('id', id)
    .maybeSingle();
  if (getErr) return res.status(500).json({ error: getErr.message });
  if (!existing) return res.status(404).json({ error: 'not_found' });
  if (existing.status === 'resolved') {
    return res.status(409).json({ error: 'already_resolved' });
  }

  const nowIso = resolved_at || new Date().toISOString();
  const patch = {
    status: 'resolved',
    resolved_at: nowIso,
    downtime_end: nowIso,
    resolved_by: user.id,
    resolver_name: resolver_name || fullName,
  };
  if (action_taken !== undefined) patch.action_taken = action_taken;

  const { data: updated, error: upErr } = await supabaseAdmin
    .from('bm_events')
    .update(patch)
    .eq('id', id)
    .select('*, assets(machine_asset_number, name_en)')
    .single();
  if (upErr) return res.status(500).json({ error: upErr.message });

  return res.status(200).json({ success: true, event: updated });
}
