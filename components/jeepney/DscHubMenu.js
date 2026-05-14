import Link from 'next/link';

// DscHubMenu — module grid for the DSC HUB dashboard (L2).
// Renders FMS + Travel module cards. Future modules added here.
export default function DscHubMenu() {
  return (
    <div style={S.grid}>
      <Link href="/jeepney-personal/dsc-hub/fms" style={S.card}>
        <div style={{ ...S.iconBox, background: '#1e3a8a' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 21V10l5 3V10l5 3V7l8-3v17H3z" />
            <path d="M9 17h2M14 17h2M19 17h0" />
          </svg>
        </div>
        <div style={S.cardBody}>
          <h3 style={S.cardTitle}>DSC FMS</h3>
          <p style={S.cardDesc}>Factory maintenance · BM · PM · Inventory · KPI · Reports</p>
        </div>
        <div style={S.arrow}>→</div>
      </Link>

      <Link href="/jeepney-personal/dsc-hub/travel" style={S.card}>
        <div style={{ ...S.iconBox, background: '#065f46' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 12l9-9 9 9-9 9z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </div>
        <div style={S.cardBody}>
          <h3 style={S.cardTitle}>Travel Records</h3>
          <p style={S.cardDesc}>Schedules · Costs · Route map (coming soon)</p>
        </div>
        <div style={S.arrow}>→</div>
      </Link>
    </div>
  );
}

const S = {
  grid: {
    display: 'grid', gap: 12,
    gridTemplateColumns: '1fr',
  },
  card: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: 14,
    background: '#111827',
    border: '1px solid #1f2937',
    borderRadius: 12,
    textDecoration: 'none', color: '#e2e8f0',
    minHeight: 88,
  },
  iconBox: {
    width: 56, height: 56, borderRadius: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  cardBody: { flex: 1, minWidth: 0 },
  cardTitle: { margin: 0, fontSize: 16, fontWeight: 700, color: '#f8fafc' },
  cardDesc: { margin: '4px 0 0', fontSize: 12, color: '#94a3b8', lineHeight: 1.4 },
  arrow: { color: '#475569', fontSize: 20, fontWeight: 700, marginLeft: 8 },
};
