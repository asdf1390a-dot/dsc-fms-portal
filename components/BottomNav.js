import Link from 'next/link';
import { useRouter } from 'next/router';

// Industrial bottom navigation. 5 slots, fixed to bottom, dark theme.
// Active route gets red accent. Respects iOS safe-area inset.
const ITEMS = [
  { href: '/',          label: 'Home',  match: (p) => p === '/',                                  icon: HomeIcon },
  { href: '/bm',        label: 'BM',    match: (p) => p === '/bm' || p.startsWith('/bm/'),         icon: WrenchIcon },
  { href: '/pm',        label: 'PM',    match: (p) => p === '/pm' || p.startsWith('/pm/'),         icon: ClipboardIcon },
  { href: '/disposals', label: '자산',  match: (p) => p === '/disposals' || p.startsWith('/disposals/'), icon: FactoryIcon },
  { href: '/kpi',       label: 'KPI',   match: (p) => p === '/kpi' || p.startsWith('/kpi/'),         icon: ChartIcon },
  { href: '/reports',   label: '경영실적', match: (p) => p === '/reports' || p.startsWith('/reports/'), icon: ChartBarIcon },
  { href: '/career',    label: '내정보', match: (p) => p === '/career' || p.startsWith('/career/'),  icon: UserIcon },
];

export default function BottomNav() {
  const router = useRouter();
  const path = router.pathname || '/';

  return (
    <nav style={S.bar} aria-label="Primary navigation">
      <div style={S.inner}>
        {ITEMS.map(item => {
          const active = item.match(path);
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} style={{
              ...S.item,
              color: active ? '#ef4444' : '#94a3b8',
            }}>
              <Icon active={active} />
              <span style={{
                ...S.label,
                color: active ? '#ef4444' : '#94a3b8',
                fontWeight: active ? 700 : 500,
              }}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

// ── Icons (inline SVG, currentColor) ────────────────────────────────
function HomeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 10l9-7 9 7v10a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2z" />
    </svg>
  );
}
function WrenchIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14.7 6.3a4 4 0 0 0 5 5l-9.6 9.6a2.1 2.1 0 0 1-3-3z" />
      <path d="M16 4l4 4" />
    </svg>
  );
}
function ClipboardIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="8" y="3" width="8" height="4" rx="1" />
      <path d="M16 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2" />
      <path d="M9 12h6M9 16h6" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
      <line x1="2" y1="20" x2="22" y2="20" />
    </svg>
  );
}
function FactoryIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 21V10l5 3V10l5 3V7l8-3v17H3z" />
      <path d="M9 17h2M14 17h2M19 17h0" />
    </svg>
  );
}

function ChartBarIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="12" width="4" height="9" rx="1" />
      <rect x="10" y="7" width="4" height="14" rx="1" />
      <rect x="17" y="3" width="4" height="18" rx="1" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}

const S = {
  bar: {
    position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 50,
    background: '#0f172a',
    borderTop: '1px solid #1f2937',
    paddingBottom: 'env(safe-area-inset-bottom, 0)',
    boxShadow: '0 -4px 12px rgba(0,0,0,0.4)',
  },
  inner: {
    display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
    height: 60, maxWidth: 480, margin: '0 auto',
  },
  item: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    gap: 3, textDecoration: 'none',
    minHeight: 44, fontSize: 10,
    transition: 'color 0.15s',
  },
  label: {
    fontSize: 10, letterSpacing: 0.2,
  },
};
