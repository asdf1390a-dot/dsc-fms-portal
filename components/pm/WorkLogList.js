// PM 작업일지 목록
const RESULT_META = {
  normal:   { label: '정상', bg: 'rgba(34,197,94,0.15)',  fg: '#86efac', border: 'rgba(34,197,94,0.5)' },
  ok:       { label: '정상', bg: 'rgba(34,197,94,0.15)',  fg: '#86efac', border: 'rgba(34,197,94,0.5)' },
  abnormal: { label: '이상', bg: 'rgba(239,68,68,0.15)',  fg: '#fca5a5', border: 'rgba(239,68,68,0.5)' },
  skipped:  { label: '건너뜀', bg: 'rgba(100,116,139,0.2)', fg: '#94a3b8', border: 'rgba(100,116,139,0.5)' },
  deferred: { label: '연기', bg: 'rgba(245,158,11,0.18)',  fg: '#fcd34d', border: 'rgba(245,158,11,0.5)' },
};

function fmt(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso.slice(0, 10);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function WorkLogList({ logs = [] }) {
  if (!logs || logs.length === 0) {
    return <div style={S.empty}>작업일지가 없습니다</div>;
  }
  return (
    <ul style={S.list}>
      {logs.map(l => {
        const meta = RESULT_META[l.result] || RESULT_META.normal;
        return (
          <li key={l.id} style={S.card}>
            <div style={S.row1}>
              <span style={S.date}>{fmt(l.completed_at || l.created_at)}</span>
              <span style={{
                ...S.badge, color: meta.fg, background: meta.bg, borderColor: meta.border,
              }}>{meta.label}</span>
            </div>
            <div style={S.worker}>👷 {l.worker_name || l.completed_by_name || '—'}</div>
            {l.notes && <div style={S.notes}>{l.notes}</div>}
          </li>
        );
      })}
    </ul>
  );
}

const S = {
  list: { listStyle: 'none', margin: 0, padding: 0 },
  card: { background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: 12, marginBottom: 8 },
  row1: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  date: { fontSize: 12, color: '#94a3b8', fontFamily: 'ui-monospace,Menlo,monospace' },
  badge: { fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 999, border: '1px solid' },
  worker: { fontSize: 13, color: '#f1f5f9', marginBottom: 4 },
  notes: { fontSize: 12, color: '#cbd5e1', whiteSpace: 'pre-wrap' },
  empty: { padding: 32, textAlign: 'center', color: '#64748b', fontSize: 13 },
};
