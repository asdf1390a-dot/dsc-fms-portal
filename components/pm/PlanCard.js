import Link from 'next/link';
import PMComplianceBar from './PMComplianceBar';

const FREQ_LABEL = {
  daily: '매일', weekly: '주간', biweekly: '격주', monthly: '월간',
  quarterly: '분기', biannual: '반기', annual: '연간',
};

export default function PlanCard({ plan }) {
  if (!plan) return null;
  const {
    plan_id, id, title, asset_number, asset_name,
    frequency_days, frequency_label, next_scheduled_date,
    this_month_done = 0, this_month_total = 0, is_active = true,
  } = plan;
  const pid = plan_id || id;
  const freq = FREQ_LABEL[frequency_label] || frequency_label || `${frequency_days || ''}일`;

  return (
    <Link href={`/pm/plans/${pid}`} style={S.link}>
      <div style={S.card}>
        <div style={S.head}>
          <span style={{ ...S.dot, background: is_active ? '#22c55e' : '#64748b' }} />
          <span style={S.title}>{title}</span>
        </div>
        <div style={S.asset}>
          {asset_number || '—'}{asset_name ? ` · ${asset_name}` : ''}
        </div>
        <div style={S.meta}>
          <span>🔄 {freq}</span>
          {next_scheduled_date && <span style={S.next}>다음 {next_scheduled_date}</span>}
        </div>
        <div style={{ marginTop: 10 }}>
          <PMComplianceBar done={this_month_done} total={this_month_total} />
        </div>
      </div>
    </Link>
  );
}

const S = {
  link: { textDecoration: 'none', color: 'inherit', display: 'block' },
  card: { background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: 14, marginBottom: 10 },
  head: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 },
  dot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  title: { fontSize: 15, fontWeight: 700, color: '#f1f5f9' },
  asset: { fontSize: 12, color: '#94a3b8', marginBottom: 6, fontFamily: 'ui-monospace,Menlo,monospace' },
  meta: { display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#cbd5e1' },
  next: { color: '#94a3b8', fontFamily: 'ui-monospace,Menlo,monospace' },
};
