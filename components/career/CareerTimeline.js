import CompanyCard from './CompanyCard';

// Group companies by start year (desc).
export default function CareerTimeline({ companies = [] }) {
  if (companies.length === 0) {
    return (
      <div style={S.empty}>
        등록된 회사가 없습니다.<br />
        아래 [+ 회사 추가] 버튼을 눌러 첫 회사를 등록하세요.
      </div>
    );
  }

  const grouped = {};
  for (const c of companies) {
    const yr = c.start_date ? String(c.start_date).slice(0, 4) : '미상';
    if (!grouped[yr]) grouped[yr] = [];
    grouped[yr].push(c);
  }
  const years = Object.keys(grouped).sort((a, b) => (a < b ? 1 : -1));

  return (
    <div style={S.wrap}>
      {years.map(yr => (
        <div key={yr} style={S.group}>
          <div style={S.yearLine}>
            <span style={S.year}>{yr}</span>
            <span style={S.line} />
          </div>
          {grouped[yr].map(co => <CompanyCard key={co.id} company={co} />)}
        </div>
      ))}
    </div>
  );
}

const S = {
  wrap:  { marginTop: 4 },
  group: { marginBottom: 8 },
  yearLine: {
    display: 'flex', alignItems: 'center', gap: 10,
    margin: '8px 0 10px',
  },
  year: {
    fontSize: 13, fontWeight: 700, color: '#ef4444',
    fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
  },
  line: { flex: 1, height: 1, background: '#1f2937' },
  empty: {
    padding: 32, textAlign: 'center', color: '#64748b',
    fontSize: 13, lineHeight: 1.6,
  },
};
