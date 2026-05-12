// components/bm/BMStatusBadge.js
// 공통 상태 pill — bm/index.js, bm/[id].js, bm/edit/[id].js, bm/stats.js 공통 사용

const STATUS_PILL = {
  open:          { bg: 'rgba(220,38,38,0.18)',  fg: '#fca5a5', border: 'rgba(220,38,38,0.6)',  label: 'OPEN' },
  in_progress:   { bg: 'rgba(249,115,22,0.18)', fg: '#fdba74', border: 'rgba(249,115,22,0.6)', label: 'IN PROGRESS' },
  pending_parts: { bg: 'rgba(234,179,8,0.18)',  fg: '#fde68a', border: 'rgba(234,179,8,0.6)',  label: 'WAIT PARTS' },
  resolved:      { bg: 'rgba(34,197,94,0.18)',  fg: '#86efac', border: 'rgba(34,197,94,0.6)',  label: 'RESOLVED' },
  wontfix:       { bg: 'rgba(100,116,139,0.2)', fg: '#cbd5e1', border: 'rgba(100,116,139,0.6)', label: "WON'T FIX" },
  cancelled:     { bg: 'rgba(100,116,139,0.2)', fg: '#94a3b8', border: 'rgba(100,116,139,0.6)', label: 'CANCELLED' },
};

export default function BMStatusBadge({ status, size = 'md' }) {
  const s = STATUS_PILL[status] || STATUS_PILL.open;
  const isSm = size === 'sm';
  return (
    <span
      style={{
        display: 'inline-block',
        padding: isSm ? '3px 8px' : '5px 12px',
        borderRadius: 999,
        fontSize: isSm ? 10 : 12,
        fontWeight: 800,
        letterSpacing: 0.5,
        background: s.bg,
        color: s.fg,
        border: `1px solid ${s.border}`,
        whiteSpace: 'nowrap',
      }}
    >
      {s.label}
    </span>
  );
}
