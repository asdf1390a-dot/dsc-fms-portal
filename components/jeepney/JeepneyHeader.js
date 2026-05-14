import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState } from 'react';

// Top header for Jeepney Personal Portal.
// Shows logo + back button + hamburger menu (mobile) / inline nav (desktop).
// Props:
//   title       — page title shown in the center
//   backHref    — optional href for the back button (if omitted, no back btn)
//   backLabel   — label for back button (default "Back")
//   level       — 1 | 2 | 3 — controls accent color
export default function JeepneyHeader({ title, backHref, backLabel = 'Back', level = 1 }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const accent = level === 1 ? '#38bdf8' : level === 2 ? '#a78bfa' : '#f87171';

  return (
    <header style={S.header}>
      <div style={S.headerInner}>
        {backHref ? (
          <Link href={backHref} style={S.backBtn} aria-label={backLabel}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            <span style={S.backText}>{backLabel}</span>
          </Link>
        ) : (
          <div style={{ width: 80 }} />
        )}

        <h1 style={{ ...S.title, color: accent }}>{title}</h1>

        <button
          type="button"
          onClick={() => setMenuOpen(v => !v)}
          aria-label="Menu"
          aria-expanded={menuOpen}
          style={S.menuBtn}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      </div>

      {menuOpen && (
        <div style={S.dropdown} role="menu">
          <Link href="/jeepney-personal" style={S.menuItem} onClick={() => setMenuOpen(false)}>Personal History</Link>
          <Link href="/jeepney-personal/dsc-hub" style={S.menuItem} onClick={() => setMenuOpen(false)}>DSC HUB</Link>
          <Link href="/jeepney-personal/dsc-hub/fms" style={S.menuItemSub} onClick={() => setMenuOpen(false)}>  · DSC FMS</Link>
          <Link href="/jeepney-personal/dsc-hub/travel" style={S.menuItemSub} onClick={() => setMenuOpen(false)}>  · Travel Records</Link>
          <div style={S.menuDivider} />
          <Link href="/" style={S.menuItem} onClick={() => setMenuOpen(false)}>Legacy FMS Home</Link>
        </div>
      )}
    </header>
  );
}

const S = {
  header: {
    position: 'sticky', top: 0, zIndex: 40,
    background: '#0f172a',
    borderBottom: '1px solid #1f2937',
  },
  headerInner: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    height: 56, padding: '0 12px',
    maxWidth: 960, margin: '0 auto',
  },
  backBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    color: '#cbd5e1', textDecoration: 'none',
    minHeight: 44, minWidth: 44, padding: '0 8px',
    fontSize: 13, fontWeight: 600,
  },
  backText: { fontSize: 13 },
  title: {
    margin: 0, fontSize: 16, fontWeight: 700, letterSpacing: 0.3,
    textAlign: 'center', flex: 1,
  },
  menuBtn: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 44, height: 44,
    background: 'transparent', border: 'none', color: '#cbd5e1',
    cursor: 'pointer',
  },
  dropdown: {
    position: 'absolute', right: 8, top: 56,
    background: '#111827', border: '1px solid #1f2937', borderRadius: 8,
    minWidth: 220, padding: 6,
    boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
  },
  menuItem: {
    display: 'block', padding: '12px 14px', borderRadius: 6,
    color: '#e2e8f0', textDecoration: 'none', fontSize: 14, fontWeight: 600,
    minHeight: 44,
  },
  menuItemSub: {
    display: 'block', padding: '10px 14px', borderRadius: 6,
    color: '#94a3b8', textDecoration: 'none', fontSize: 13,
    minHeight: 40,
  },
  menuDivider: {
    height: 1, background: '#1f2937', margin: '6px 0',
  },
};
