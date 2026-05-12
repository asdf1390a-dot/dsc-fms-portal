// Shared inline styles for career module (dark theme, mobile-first).
export const C = {
  page: {
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans KR", sans-serif',
    background: '#0f172a', minHeight: '100vh', color: '#e2e8f0',
    paddingBottom: 'calc(60px + env(safe-area-inset-bottom, 0px) + 24px)',
    maxWidth: 480, margin: '0 auto',
  },
  header: {
    position: 'sticky', top: 0, zIndex: 20,
    background: '#0f172a', borderBottom: '1px solid #1f2937',
    padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10,
  },
  backLink: {
    color: '#94a3b8', textDecoration: 'none', fontSize: 14, minHeight: 44,
    display: 'inline-flex', alignItems: 'center', padding: '0 4px',
  },
  title: { flex: 1, fontSize: 17, fontWeight: 700, margin: 0, color: '#f8fafc', textAlign: 'center' },
  body: { padding: '12px 14px 16px' },

  card: {
    background: '#1e293b', border: '1px solid #334155', borderRadius: 12,
    padding: 14, marginBottom: 12,
  },

  field: { display: 'block', marginBottom: 12 },
  fieldLabel: {
    display: 'block', fontSize: 12, color: '#94a3b8',
    fontWeight: 600, marginBottom: 6, letterSpacing: 0.3,
  },
  input: {
    width: '100%', padding: '11px 12px',
    background: '#0f172a', color: '#f1f5f9',
    border: '1px solid #334155', borderRadius: 8,
    fontSize: 16, outline: 'none', boxSizing: 'border-box', minHeight: 44,
  },
  textarea: {
    width: '100%', padding: '11px 12px',
    background: '#0f172a', color: '#f1f5f9',
    border: '1px solid #334155', borderRadius: 8,
    fontSize: 16, outline: 'none', boxSizing: 'border-box',
    fontFamily: 'inherit', resize: 'vertical',
  },

  primaryBtn: {
    width: '100%', padding: '14px', background: '#ef4444', color: '#fff',
    border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700,
    cursor: 'pointer', minHeight: 48,
    boxShadow: '0 4px 12px rgba(239,68,68,0.4)',
  },
  secondaryBtn: {
    width: '100%', padding: '12px', background: '#334155', color: '#cbd5e1',
    border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600,
    cursor: 'pointer', minHeight: 44,
  },
  dangerBtn: {
    width: '100%', padding: '12px', background: 'rgba(220,38,38,0.15)',
    color: '#fca5a5', border: '1px solid rgba(220,38,38,0.4)',
    borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer', minHeight: 44,
  },
  ghostBtn: {
    padding: '8px 12px', background: 'transparent', color: '#94a3b8',
    border: '1px solid #334155', borderRadius: 8, fontSize: 13,
    cursor: 'pointer', minHeight: 36,
  },

  badge: {
    display: 'inline-block', padding: '3px 8px', borderRadius: 6,
    fontSize: 11, fontWeight: 600, letterSpacing: 0.3,
  },

  errorBox: {
    margin: '12px 0', padding: 12,
    background: 'rgba(220,38,38,0.15)', color: '#fca5a5',
    border: '1px solid rgba(220,38,38,0.4)', borderRadius: 10, fontSize: 13,
  },

  loading: { padding: 48, textAlign: 'center', color: '#64748b' },
  empty:   { padding: 32, textAlign: 'center', color: '#64748b', fontSize: 13 },
};

export const CATEGORY_LABELS = {
  improvement:    '개선',
  cost_reduction: '원가절감',
  quality:        '품질',
  safety:         '안전',
  digital:        '디지털',
  automation:     '자동화',
  other:          '기타',
};

export const CATEGORY_COLORS = {
  improvement:    { bg: 'rgba(59,130,246,0.2)',  fg: '#93c5fd' },
  cost_reduction: { bg: 'rgba(16,185,129,0.2)',  fg: '#6ee7b7' },
  quality:        { bg: 'rgba(168,85,247,0.2)',  fg: '#d8b4fe' },
  safety:         { bg: 'rgba(245,158,11,0.2)',  fg: '#fcd34d' },
  digital:        { bg: 'rgba(6,182,212,0.2)',   fg: '#67e8f9' },
  automation:     { bg: 'rgba(236,72,153,0.2)',  fg: '#f9a8d4' },
  other:          { bg: 'rgba(148,163,184,0.2)', fg: '#cbd5e1' },
};

export const ACHIEVEMENT_TYPE_LABELS = {
  award:           '수상',
  kpi_improvement: 'KPI 개선',
  cost_reduction:  '원가절감',
  process:         '프로세스',
  certification:   '자격',
  other:           '기타',
};

export function normalizeSlug(v) {
  return String(v || '').toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function ymToDate(ym) {
  // "2026-05" -> "2026-05-01"
  if (!ym) return null;
  if (/^\d{4}-\d{2}$/.test(ym)) return `${ym}-01`;
  return ym;
}

export function dateToYm(d) {
  if (!d) return '';
  return String(d).slice(0, 7);
}

export function fmtPeriod(start, end, ongoing) {
  const s = dateToYm(start);
  const e = ongoing ? '현재' : dateToYm(end) || '현재';
  return s ? `${s} ~ ${e}` : '';
}

export function calcYears(startDate) {
  if (!startDate) return 0;
  const ms = Date.now() - new Date(startDate).getTime();
  if (isNaN(ms) || ms < 0) return 0;
  return Math.floor(ms / (1000 * 60 * 60 * 24 * 365));
}
