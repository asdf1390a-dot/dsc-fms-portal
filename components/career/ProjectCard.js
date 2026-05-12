import Link from 'next/link';
import { C, CATEGORY_LABELS, CATEGORY_COLORS, fmtPeriod } from './careerStyles';

export default function ProjectCard({ project, companyId }) {
  const cat = CATEGORY_COLORS[project.category] || CATEGORY_COLORS.other;
  const period = fmtPeriod(project.start_date, project.end_date, project.is_ongoing);
  return (
    <div style={S.card}>
      <div style={S.headerRow}>
        <span style={{ ...C.badge, background: cat.bg, color: cat.fg }}>
          {CATEGORY_LABELS[project.category] || project.category}
        </span>
        {project.is_featured && <span style={S.featured}>★ 대표</span>}
        {project.is_public && <span style={S.public}>공개</span>}
      </div>

      <div style={S.title}>{project.title}</div>
      {project.summary && <div style={S.summary}>{project.summary}</div>}

      {period && <div style={S.period}>{period}</div>}

      {project.tags?.length > 0 && (
        <div style={S.tags}>
          {project.tags.map(t => <span key={t} style={S.tag}>#{t}</span>)}
        </div>
      )}

      {project.kpi_value && (
        <div style={S.kpi}>
          <span style={S.kpiLabel}>{project.kpi_label || 'KPI'}</span>
          <span style={S.kpiVal}>{project.kpi_value}</span>
        </div>
      )}

      <Link href={`/career/${companyId}/projects/${project.id}`} style={S.editLink}>편집 →</Link>
    </div>
  );
}

const S = {
  card: { ...C.card },
  headerRow: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' },
  featured: {
    background: 'rgba(251,191,36,0.2)', color: '#fcd34d',
    fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
  },
  public: {
    background: 'rgba(34,197,94,0.2)', color: '#86efac',
    fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
  },
  title:   { fontSize: 15, fontWeight: 700, color: '#f8fafc', marginBottom: 4 },
  summary: { fontSize: 13, color: '#cbd5e1', lineHeight: 1.5, marginBottom: 8 },
  period:  { fontSize: 11, color: '#64748b', fontFamily: 'ui-monospace, Menlo, Consolas, monospace', marginBottom: 8 },
  tags:    { display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 },
  tag: {
    fontSize: 11, color: '#94a3b8', background: '#0f172a',
    padding: '2px 8px', borderRadius: 4, border: '1px solid #334155',
  },
  kpi: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '8px 10px', background: '#0f172a',
    border: '1px dashed #334155', borderRadius: 8, marginBottom: 10,
  },
  kpiLabel: { fontSize: 12, color: '#94a3b8' },
  kpiVal:   { fontSize: 14, color: '#fbbf24', fontWeight: 700,
              fontFamily: 'ui-monospace, Menlo, Consolas, monospace' },
  editLink: { display: 'inline-block', color: '#ef4444',
              fontSize: 13, fontWeight: 700, textDecoration: 'none' },
};
