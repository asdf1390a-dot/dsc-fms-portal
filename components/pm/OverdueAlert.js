import Link from 'next/link';

export default function OverdueAlert({ count = 0, href = '/pm' }) {
  if (!count || count <= 0) return null;
  const body = (
    <div style={S.bar}>
      <span style={S.icon}>⚠️</span>
      <span style={S.text}>연체 <strong style={S.num}>{count}</strong>건 있습니다</span>
      {href && <span style={S.arrow}>→</span>}
    </div>
  );
  if (href) {
    return <Link href={href} style={S.link}>{body}</Link>;
  }
  return body;
}

const S = {
  link: { textDecoration: 'none', color: 'inherit', display: 'block' },
  bar: {
    display: 'flex', alignItems: 'center', gap: 10,
    background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.5)',
    color: '#fca5a5', borderRadius: 10, padding: '12px 14px', marginBottom: 12,
    fontSize: 13,
  },
  icon: { fontSize: 18 },
  text: { flex: 1 },
  num: { color: '#ef4444', fontSize: 16, marginRight: 2 },
  arrow: { color: '#fca5a5' },
};
