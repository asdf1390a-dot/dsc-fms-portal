// PM 이행률 프로그레스바
// done/total 비율을 색상으로 표시: 90%↑ green, 70%↑ yellow, 미만 red
export default function PMComplianceBar({ done = 0, total = 0, height = 10, showLabel = true }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const color = pct >= 90 ? '#22c55e' : pct >= 70 ? '#f59e0b' : '#ef4444';
  return (
    <div style={{ width: '100%' }}>
      <div style={{
        width: '100%', height, background: '#0b1220', border: '1px solid #334155',
        borderRadius: 999, overflow: 'hidden',
      }}>
        <div style={{
          width: `${Math.min(100, pct)}%`, height: '100%', background: color,
          transition: 'width 240ms ease',
        }} />
      </div>
      {showLabel && (
        <div style={{
          display: 'flex', justifyContent: 'space-between', marginTop: 6,
          fontSize: 12, color: '#94a3b8',
        }}>
          <span>{done}/{total} 완료</span>
          <span style={{ color, fontWeight: 700 }}>{pct}%</span>
        </div>
      )}
    </div>
  );
}
