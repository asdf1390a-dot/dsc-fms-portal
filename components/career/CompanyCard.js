import Link from 'next/link';
import { C, fmtPeriod } from './careerStyles';

export default function CompanyCard({ company }) {
  const period = fmtPeriod(company.start_date, company.end_date, company.is_current);
  return (
    <div style={S.card}>
      <div style={S.headerRow}>
        <div style={S.nameWrap}>
          <div style={S.name}>{company.name}</div>
          {company.city && <div style={S.sub}>{[company.city, company.country].filter(Boolean).join(', ')}</div>}
        </div>
        {company.is_current && <span style={S.currentBadge}>재직중</span>}
      </div>

      {(company.title || company.department) && (
        <div style={S.role}>
          {company.title}
          {company.title && company.department ? ' · ' : ''}
          {company.department}
        </div>
      )}

      {period && <div style={S.period}>{period}</div>}

      <div style={S.statsRow}>
        <span style={S.stat}>📁 {company.project_count ?? 0}</span>
        <span style={S.stat}>🏆 {company.achievement_count ?? 0}</span>
      </div>

      <Link href={`/career/${company.id}`} style={S.viewLink}>보기 →</Link>
    </div>
  );
}

const S = {
  card: {
    ...C.card,
    position: 'relative',
  },
  headerRow: { display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  nameWrap: { flex: 1, minWidth: 0 },
  name: { fontSize: 16, fontWeight: 700, color: '#f8fafc' },
  sub:  { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  currentBadge: {
    background: 'rgba(239,68,68,0.2)', color: '#fca5a5',
    fontSize: 11, fontWeight: 700,
    padding: '3px 8px', borderRadius: 6,
    border: '1px solid rgba(239,68,68,0.4)',
  },
  role:   { fontSize: 13, color: '#cbd5e1', marginBottom: 4 },
  period: { fontSize: 12, color: '#64748b', fontFamily: 'ui-monospace, Menlo, Consolas, monospace', marginBottom: 10 },
  statsRow: { display: 'flex', gap: 12, marginBottom: 10 },
  stat: { fontSize: 12, color: '#94a3b8' },
  viewLink: {
    display: 'inline-block', color: '#ef4444',
    fontSize: 13, fontWeight: 700, textDecoration: 'none',
  },
};
