// KPI 달성률 프로그레스 바
// - direction='up' → actual/target*100
// - direction='down' → target/actual*100
// - target=0 AND actual=0 → "ZERO 달성" (녹색)
export default function KpiProgressBar({ target, actual, direction = 'up' }) {
  let rate = null;
  let zeroAchieved = false;

  if (target != null && actual != null) {
    const t = Number(target);
    const a = Number(actual);
    if (t === 0 && a === 0) {
      rate = 100;
      zeroAchieved = true;
    } else if (direction === 'up' && t !== 0) {
      rate = (a * 100) / t;
    } else if (direction === 'down' && a !== 0) {
      rate = (t * 100) / a;
    } else if (direction === 'down' && t === 0 && a > 0) {
      rate = 0;
    }
  }

  const color =
    rate == null ? '#475569'
    : rate >= 100 ? '#22c55e'
    : rate >= 90  ? '#eab308'
    : '#ef4444';

  const width = rate == null ? 0 : Math.max(0, Math.min(100, rate));
  const display = rate == null ? '—' : `${rate.toFixed(1)}%`;

  return (
    <div style={S.wrap}>
      <div style={S.head}>
        <span style={{ ...S.rate, color }}>
          {zeroAchieved ? 'ZERO 달성' : display}
        </span>
      </div>
      <div style={S.track}>
        <div style={{ ...S.fill, width: `${width}%`, background: color }} />
      </div>
    </div>
  );
}

const S = {
  wrap: { width: '100%' },
  head: { display: 'flex', justifyContent: 'flex-end', marginBottom: 4 },
  rate: { fontSize: 12, fontWeight: 800, fontFamily: 'ui-monospace,Menlo,Consolas,monospace' },
  track: { height: 6, borderRadius: 999, background: '#0f172a', overflow: 'hidden' },
  fill:  { height: '100%', borderRadius: 999, transition: 'width 0.4s ease' },
};
