import { C, calcYears } from './careerStyles';

export default function CareerSummaryCard({ companies = [], projectCount = 0, achievementCount = 0 }) {
  const earliest = companies
    .map(c => c.start_date)
    .filter(Boolean)
    .sort()[0];
  const years = calcYears(earliest);

  return (
    <div style={S.wrap}>
      <Cell num={years} suffix="년" label="총 경력" />
      <Cell num={companies.length}     label="회사" />
      <Cell num={projectCount}         label="프로젝트" />
      <Cell num={achievementCount}     label="성과" />
    </div>
  );
}

function Cell({ num, suffix, label }) {
  return (
    <div style={S.cell}>
      <div style={S.num}>
        {num}
        {suffix && <span style={S.suffix}>{suffix}</span>}
      </div>
      <div style={S.label}>{label}</div>
    </div>
  );
}

const S = {
  wrap: {
    ...C.card,
    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8,
    padding: 16,
  },
  cell: { textAlign: 'center' },
  num: { fontSize: 22, fontWeight: 800, color: '#f8fafc', lineHeight: 1.1 },
  suffix: { fontSize: 12, fontWeight: 600, color: '#94a3b8', marginLeft: 2 },
  label: { fontSize: 11, color: '#94a3b8', marginTop: 4, fontWeight: 600 },
};
