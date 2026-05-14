import Link from 'next/link';
import JeepneyLayout from '../../../../components/jeepney/JeepneyLayout';

// L3: DSC FMS module landing.
// This page links into the existing FMS routes (kept unchanged).
// Phase 5 will migrate the FMS routes under this namespace.
const FMS_MODULES = [
  { href: '/',          label: 'FMS Home',     desc: 'Asset master & dashboard' },
  { href: '/assets',    label: 'Assets',       desc: 'Asset list & detail' },
  { href: '/bm',        label: 'BM History',   desc: 'Breakdown maintenance log' },
  { href: '/pm',        label: 'PM Plan',      desc: 'Preventive maintenance schedule' },
  { href: '/wo',        label: 'Work Orders',  desc: 'Work order tracking' },
  { href: '/inventory', label: 'Inventory',    desc: 'Spare parts & stock' },
  { href: '/kpi',       label: 'KPI',          desc: 'KPI dashboards' },
  { href: '/reports',   label: 'Reports',      desc: 'Management reports' },
  { href: '/disposals', label: 'Disposals',    desc: 'Asset disposals' },
  { href: '/vendors',   label: 'Vendors',      desc: 'Vendor master' },
];

export default function FmsHome() {
  return (
    <JeepneyLayout
      title="DSC FMS"
      level={3}
      backHref="/jeepney-personal/dsc-hub"
      backLabel="DSC HUB"
      crumbs={[
        { label: 'Personal', href: '/jeepney-personal' },
        { label: 'DSC HUB', href: '/jeepney-personal/dsc-hub' },
        { label: 'FMS' },
      ]}
    >
      <p style={S.note}>
        Factory Maintenance System modules. Existing FMS routes remain under root paths
        and will be migrated into <code style={S.code}>/jeepney-personal/dsc-hub/fms/*</code> in Phase 5.
      </p>

      <div style={S.grid}>
        {FMS_MODULES.map(m => (
          <Link key={m.href} href={m.href} style={S.card}>
            <div style={S.cardBody}>
              <h3 style={S.cardTitle}>{m.label}</h3>
              <p style={S.cardDesc}>{m.desc}</p>
            </div>
            <div style={S.arrow}>→</div>
          </Link>
        ))}
      </div>
    </JeepneyLayout>
  );
}

const S = {
  note: {
    fontSize: 12, color: '#94a3b8', lineHeight: 1.5,
    margin: '0 0 16px', padding: '10px 12px',
    background: '#0f172a', border: '1px solid #1f2937', borderRadius: 8,
  },
  code: {
    background: '#1e293b', padding: '2px 6px', borderRadius: 4,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: 11, color: '#7dd3fc',
  },
  grid: {
    display: 'grid', gap: 10,
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
  },
  card: {
    display: 'flex', alignItems: 'center', gap: 10, padding: 14,
    background: '#111827', border: '1px solid #1f2937', borderRadius: 10,
    textDecoration: 'none', color: '#e2e8f0', minHeight: 72,
  },
  cardBody: { flex: 1, minWidth: 0 },
  cardTitle: { margin: 0, fontSize: 14, fontWeight: 700, color: '#f8fafc' },
  cardDesc: { margin: '2px 0 0', fontSize: 11, color: '#94a3b8' },
  arrow: { color: '#475569', fontSize: 18, fontWeight: 700 },
};
