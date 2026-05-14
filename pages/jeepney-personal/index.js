import Link from 'next/link';
import JeepneyLayout from '../../components/jeepney/JeepneyLayout';

// L1: Jeepney Personal Portal — landing.
// Provides entry to Personal History (Career) and DSC HUB.
export default function JeepneyPersonalHome() {
  return (
    <JeepneyLayout
      title="Jeepney Personal"
      level={1}
      crumbs={[{ label: 'Personal' }]}
    >
      <section style={S.hero}>
        <h2 style={S.heroTitle}>Jeepney Personal Portal</h2>
        <p style={S.heroSub}>Career timeline, operations hub and travel logs.</p>
      </section>

      <div style={S.grid}>
        <Link href="/career" style={S.card}>
          <div style={{ ...S.iconBox, background: '#312e81' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#a5b4fc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21a8 8 0 0 1 16 0" />
            </svg>
          </div>
          <div style={S.cardBody}>
            <h3 style={S.cardTitle}>Personal History</h3>
            <p style={S.cardDesc}>Companies · Projects · Achievements</p>
          </div>
          <div style={S.arrow}>→</div>
        </Link>

        <Link href="/jeepney-personal/backup-app" style={S.card}>
          <div style={{ ...S.iconBox, background: '#1e40af' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
          </div>
          <div style={S.cardBody}>
            <h3 style={S.cardTitle}>Backup Manager</h3>
            <p style={S.cardDesc}>Agent backups · Restore · History</p>
          </div>
          <div style={S.arrow}>→</div>
        </Link>

        <Link href="/jeepney-personal/dsc-hub" style={S.card}>
          <div style={{ ...S.iconBox, background: '#7c2d12' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fdba74" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          </div>
          <div style={S.cardBody}>
            <h3 style={S.cardTitle}>DSC HUB</h3>
            <p style={S.cardDesc}>FMS modules · Travel records · Future tools</p>
          </div>
          <div style={S.arrow}>→</div>
        </Link>
      </div>
    </JeepneyLayout>
  );
}

const S = {
  hero: {
    padding: '8px 4px 16px',
  },
  heroTitle: {
    margin: 0, fontSize: 22, fontWeight: 800, color: '#f8fafc',
  },
  heroSub: {
    margin: '6px 0 0', fontSize: 13, color: '#94a3b8',
  },
  grid: {
    display: 'grid', gap: 12, gridTemplateColumns: '1fr',
  },
  card: {
    display: 'flex', alignItems: 'center', gap: 12, padding: 14,
    background: '#111827', border: '1px solid #1f2937', borderRadius: 12,
    textDecoration: 'none', color: '#e2e8f0', minHeight: 88,
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
