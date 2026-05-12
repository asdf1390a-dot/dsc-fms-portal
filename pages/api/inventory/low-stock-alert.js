import { getUserFromRequest } from '../../../lib/api-auth';
import { supabaseAdmin } from '../../../lib/supabase-admin';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  const { user } = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'unauthorized' });

  const { data: rows, error } = await supabaseAdmin.from('v_low_stock').select('*');
  if (error) return res.status(500).json({ error: error.message });
  if (!rows || rows.length === 0) return res.json({ ok: true, count: 0, message: '재고부족 항목 없음' });

  const webhook = process.env.DISCORD_WEBHOOK_URL;
  if (!webhook) return res.status(503).json({ error: 'DISCORD_WEBHOOK_URL not configured' });

  const dateStr = new Date().toISOString().slice(0, 10);
  const lines = rows.slice(0, 20).map(r => {
    const vendorPart = r.vendor_name ? `\n  공급: ${r.vendor_name}${r.lead_time_days ? ` · 납기 ${r.lead_time_days}일` : ''}` : '';
    return `• ${r.name_ko}${r.part_number ? ` (${r.part_number})` : ''}\n  현재 ${r.quantity}${r.unit||''} / 최소 ${r.min_quantity}${r.unit||''} → 부족 ${r.shortage}${vendorPart}${r.location ? `\n  위치: ${r.location}` : ''}`;
  }).join('\n\n');

  const content = `⚠ DSC FMS 재고부족 알림 (${rows.length}품목) — ${dateStr}\n\n${lines}\n\n조회: https://dsc-fms-portal.vercel.app/inventory/dashboard`;

  try {
    const r = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    if (!r.ok) throw new Error(`webhook returned ${r.status}`);
  } catch (e) {
    return res.status(500).json({ error: 'discord webhook failed: ' + e.message });
  }

  // 알림 기록
  const ids = rows.map(r => r.id);
  await supabaseAdmin.from('spare_parts').update({ low_stock_notified_at: new Date().toISOString() }).in('id', ids);

  return res.json({ ok: true, count: rows.length });
}
