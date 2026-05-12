// KPI 달성률 프로그레스 바.
// direction: 'up' or 'down'. 색상은 rate 기반으로 자동.
export default function KpiProgressBar({ rate, direction, target, actual }) {
  if (rate == null) {
    return (
      <div style={{ ...S.track }}>
        <div style={{ ...S.fill, width: '0%', background: '#334155' }} />
      </div>
    );
  }
  const isZeroAchieved = Number(target) === 0 && Number(actual) === 0;
  let color;
  if (isZeroAchieved) color = '#22c55e';
  else if (rate >= 100) color = '#22c55e';
  else if (rate >= 90) color = '#eab308';
  else color = '#ef4444';
  const w = Math.max(2, Math.min(100, rate));
  return (
    <div style={S.track}>
      <div style={{ ...S.fill, width: `${w}%`, background: color }} />
    </div>
  );
}

const S = {
  track: { height: 8, borderRadius: 999, background: '#0b1220', overflow: 'hidden', marginTop: 6 },
  fill:  { height: '100%', borderRadius: 999, transition: 'width 0.4s ease' },
};
