// KpiCard — single KPI tile.
// props: { category, target, actual }
import KpiProgressBar from './KpiProgressBar';

function fmt(v, unit) {
  if (v == null) return '—';
  const n = Number(v);
  if (!isFinite(n)) return '—';
  const s = n % 1 === 0 ? n.toLocaleString() : n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return `${s} ${unit || ''}`.trim();
}

export default function KpiCard({ category, target, actual }) {
  if (!category) return null;
  const hasTarget = target != null;
  const hasActual = actual != null;

  return (
    <div style={S.card}>
      <div style={S.head}>
        <span style={S.label}>{category.label}</span>
        {category.is_auto && <span style={S.autoBadge}>🔄 자동</span>}
      </div>
      <div style={S.row}>
        <div style={S.col}>
          <div style={S.k}>목표</div>
          <div style={S.v}>{hasTarget ? fmt(target, category.unit) : <span style={S.muted}>목표 미설정</span>}</div>
        </div>
        <div style={S.col}>
          <div style={S.k}>실적</div>
          <div style={{ ...S.v, color: '#f8fafc' }}>{hasActual ? fmt(actual, category.unit) : '—'}</div>
        </div>
      </div>
      <div style={{ marginTop: 8 }}>
        <KpiProgressBar target={target} actual={actual} direction={category.direction} />
      </div>
    </div>
  );
}

const S = {
  card: { background: '#1e293b', borderRadius: 10, padding: 12, border: '1px solid #1f2937' },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  label: { fontSize: 13, fontWeight: 700, color: '#f1f5f9' },
  autoBadge: { fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 999, background: 'rgba(59,130,246,0.18)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.4)' },
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  col: { },
  k:   { fontSize: 10, fontWeight: 700, color: '#64748b', letterSpacing: 0.5, marginBottom: 2, textTransform: 'uppercase' },
  v:   { fontSize: 14, fontWeight: 700, color: '#cbd5e1', fontFamily: 'ui-monospace,Menlo,Consolas,monospace' },
  muted: { color: '#475569', fontWeight: 500, fontFamily: 'system-ui,sans-serif', fontSize: 12 },
};
