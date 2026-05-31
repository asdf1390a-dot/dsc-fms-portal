// pages/breakdowns/new.tsx
// BM-P1 Phase 2 — wrapper page that mounts <BreakdownForm /> (M3.3).
// Auth-gated: unauthenticated users are sent to /login with a redirect param.

import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import BottomNav from '../../components/BottomNav';
import BreakdownForm from '../../components/bm/BreakdownForm';
import { useAuth } from '../../lib/use-auth';

export default function NewBreakdownPage() {
  const router = useRouter();
  const { isAuthed, loading, fullName, signOut } = useAuth();

  useEffect(() => {
    if (!loading && !isAuthed) {
      router.replace(`/login?redirect=${encodeURIComponent('/breakdowns/new')}`);
    }
  }, [loading, isAuthed, router]);

  return (
    <>
      <Head>
        <title>Report Breakdown</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div style={S.page}>
        <header style={S.header}>
          <div style={S.headerInner}>
            <Link href="/breakdowns" style={S.backLink} aria-label="Back to list">
              <span aria-hidden="true">←</span>
              <span>Back</span>
            </Link>
            <div style={S.title}>Report Breakdown</div>
            <div style={S.headerRight}>
              {isAuthed ? (
                <>
                  <span style={S.userChip} title={fullName || ''}>{shortName(fullName)}</span>
                  <button type="button" onClick={signOut} style={S.logoutBtn}>Logout</button>
                </>
              ) : null}
            </div>
          </div>
        </header>

        <main style={S.main}>
          {loading && <div style={S.notice}>Loading…</div>}
          {!loading && !isAuthed && (
            <div style={S.notice}>Redirecting to login…</div>
          )}
          {!loading && isAuthed && (
            <BreakdownForm />
          )}
        </main>

        <BottomNav />
      </div>
    </>
  );
}

function shortName(s: string | null | undefined): string {
  if (!s) return 'User';
  const t = String(s).trim();
  return t.length > 16 ? `${t.slice(0, 14)}…` : t;
}

const S: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#0f172a',
    color: '#e2e8f0',
    paddingBottom: 80,
    fontFamily: 'system-ui,-apple-system,Segoe UI,Roboto,sans-serif',
  },
  header: {
    position: 'sticky',
    top: 0,
    zIndex: 30,
    background: '#0f172a',
    borderBottom: '1px solid #1e293b',
  },
  headerInner: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 14px',
    maxWidth: 960,
    margin: '0 auto',
  },
  backLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    color: '#93c5fd',
    textDecoration: 'none',
    fontSize: 14,
    fontWeight: 600,
    minHeight: 44,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: 700,
    color: '#f1f5f9',
    textAlign: 'center',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  userChip: {
    fontSize: 12,
    color: '#cbd5e1',
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: 999,
    padding: '4px 10px',
  },
  logoutBtn: {
    background: 'transparent',
    color: '#94a3b8',
    border: '1px solid #334155',
    borderRadius: 8,
    fontSize: 12,
    padding: '6px 10px',
    cursor: 'pointer',
    minHeight: 32,
  },
  main: {
    maxWidth: 960,
    margin: '0 auto',
    padding: '14px',
  },
  notice: {
    padding: '20px',
    textAlign: 'center',
    color: '#94a3b8',
    background: '#111827',
    border: '1px solid #1f2937',
    borderRadius: 12,
  },
};
