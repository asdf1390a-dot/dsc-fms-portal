import KpiProgressBar from './KpiProgressBar';
import Link from 'next/link';

function rateColor(rate, target, actual) {
  if (Number(target) === 0 && Number(actual) === 0) return '#86efac';
  if (rate == null) return '#94a3b8';
  if (rate >= 100) return '#86efac';
  if (rate >= 90) return '#fcd34d';
  return '#fca5a5';
}

function fmtNum(v, unit) {
  if (v == null) return '—';
  const n = Number(v);
  if (Number.isInteger(n)) return n.toLocaleString();
  return n.toFixed(1);
}

export default function KpiCard({ item }) {
  const { name_ko, name_en, unit, direction, is_auto, target_value, actual_value, achievement_rate, category_id } = item;
  const rate = achievement_rate;
  const c = rateColor(rate, target_value, actual_value);
  const isZeroAchieved = Number(target_value) === 0 && Number(actual_value) === 0;
  let badge = '';
  if (rate == null) badge = target_value == null ? '목표 미설정' : (actual_value == null ? '실적 미입력' : '');
  else if (isZeroAchieved) badge = 'ZERO 달성';
  else if (direction === 'down' && rate >= 100) badge = '달성';
  else badge = `${rate}%`;

  return (
    <div style={S.card}>
      <div style={S.topRow}>
        <div style={S.titleWrap}>
          <span style={S.titleKo}>{name_ko}</span>
          <span style={S.titleEn}>{name_en}</span>
        </div>
        {is_auto && <span style={S.autoBadge}>🔄 자동</span>}
      </div>

      <div style={S.row}>
        <span style={S.lbl}>목표</span>
        <span style={S.val}>
          {direction === 'down' && target_value != null ? '≤' : ''}{fmtNum(target_value, unit)}{target_value != null ? ` ${unit}` : ''}
        </span>
      </div>
      <div style={S.row}>
        <span style={S.lbl}>실적</span>
        <span style={{ ...S.val, color: c, fontWeight: 800 }}>
          {fmtNum(actual_value, unit)}{actual_value != null ? ` ${unit}` : ''}
        </span>
      </div>

      <KpiProgressBar rate={rate} direction={direction} target={target_value} actual={actual_value} />

      <div style={S.badgeRow}>
        <span style={{ ...S.badge, color: c }}>{badge}</span>
        <Link href={`/kpi/trend?category=${category_id}`} style={S.trendLink}>추세 →</Link>
      </div>
    </div>
  );
}

const S = {
  card: { background: '#1e293b', borderRadius: 12, padding: 14, border: '1px solid #1f2937', marginBottom: 10 },
  topRow: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 },
  titleWrap: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 },
  titleKo: { fontSize: 15, fontWeight: 700, color: '#f8fafc' },
  titleEn: { fontSize: 11, color: '#64748b', fontFamily: 'ui-monospace,Menlo,monospace' },
  autoBadge: { fontSize: 10, fontWeight: 800, color: '#fdba74', background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.4)', padding: '2px 6px', borderRadius: 6, whiteSpace: 'nowrap' },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 13, marginBottom: 4 },
  lbl: { color: '#64748b', fontWeight: 600 },
  val: { color: '#e2e8f0', fontFamily: 'ui-monospace,Menlo,monospace' },
  badgeRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  badge: { fontSize: 12, fontWeight: 800, fontFamily: 'ui-monospace,Menlo,monospace' },
  trendLink: { fontSize: 11, color: '#60a5fa', textDecoration: 'none', fontWeight: 600 },
};
