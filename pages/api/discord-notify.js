// POST /api/discord-notify
// body: { type, title, fields }
// type: 'bm_created' | 'bm_resolved' | 'pm_completed'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return res.status(200).json({ skipped: true }); // silently skip if not configured

  const { type, title, fields = [] } = req.body;

  const colorMap = {
    bm_created:   0xef4444, // red
    bm_resolved:  0x22c55e, // green
    pm_completed: 0x3b82f6, // blue
  };

  const labelMap = {
    bm_created:   '🔴 BM 고장 신고',
    bm_resolved:  '✅ BM 수리 완료',
    pm_completed: '🔵 PM 완료',
  };

  const payload = {
    embeds: [{
      title: `${labelMap[type] ?? type}: ${title}`,
      color: colorMap[type] ?? 0x94a3b8,
      fields: fields.map(f => ({ name: f.name, value: String(f.value ?? '-'), inline: true })),
      footer: { text: 'DSC FMS Portal · Mannur Plant' },
      timestamp: new Date().toISOString(),
    }],
  };

  try {
    const r = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!r.ok) throw new Error(`Discord error: ${r.status}`);
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[discord-notify]', err);
    res.status(500).json({ error: err.message });
  }
}
