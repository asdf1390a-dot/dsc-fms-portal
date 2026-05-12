import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/use-auth';
import BottomNav from '../../components/BottomNav';
import CareerSummaryCard from '../../components/career/CareerSummaryCard';
import CareerTimeline from '../../components/career/CareerTimeline';
import CompanyForm from '../../components/career/CompanyForm';
import { C } from '../../components/career/careerStyles';

export default function CareerDashboard() {
  const router = useRouter();
  const { isAuthed, loading: authLoading, fullName } = useAuth();

  const [profileChecked, setProfileChecked] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCompanyForm, setShowCompanyForm] = useState(false);

  // unauth -> /login
  useEffect(() => {
    if (!authLoading && !isAuthed) {
      router.replace(`/login?next=${encodeURIComponent('/career')}`);
    }
  }, [authLoading, isAuthed, router]);

  // profile check -> /career/setup if missing
  useEffect(() => {
    if (!isAuthed) return;
    let cancel = false;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data?.session?.access_token;
        const r = await fetch('/api/career/profile', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const j = await r.json().catch(() => ({}));
        if (cancel) return;
        if (!j.profile) {
          router.replace('/career/setup');
          return;
        }
        setProfileChecked(true);
      } catch {
        setProfileChecked(true);
      }
    })();
    return () => { cancel = true; };
  }, [isAuthed, router]);

  const loadCompanies = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      const r = await fetch('/api/career/companies', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setCompanies(j.companies || []);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (profileChecked) loadCompanies();
  }, [profileChecked, loadCompanies]);

  const totalProjects = companies.reduce((s, c) => s + (c.project_count || 0), 0);
  const totalAch      = companies.reduce((s, c) => s + (c.achievement_count || 0), 0);

  return (
    <>
      <Head>
        <title>커리어 | DSC FMS</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#0f172a" />
      </Head>
      <main style={C.page}>
        <header style={C.header}>
          <div style={{ width: 44 }} />
          <h1 style={C.title}>커리어</h1>
          <Link href="/career/setup" style={C.backLink}>설정</Link>
        </header>

        {authLoading || !profileChecked || loading ? (
          <div style={C.loading}>…</div>
        ) : (
          <div style={C.body}>
            {fullName && <div style={S.greet}>안녕하세요, <strong style={{ color: '#f8fafc' }}>{fullName}</strong>님</div>}

            <CareerSummaryCard
              companies={companies}
              projectCount={totalProjects}
              achievementCount={totalAch}
            />

            <CareerTimeline companies={companies} />

            {error && <div style={C.errorBox}>{error}</div>}

            <button type="button" onClick={() => setShowCompanyForm(true)}
              style={{ ...C.primaryBtn, marginTop: 12 }}>
              + 회사 추가
            </button>

            <Link href="/career/setup" style={S.settingsLink}>
              포트폴리오 설정 →
            </Link>
          </div>
        )}

        {showCompanyForm && (
          <CompanyForm
            onClose={() => setShowCompanyForm(false)}
            onSaved={() => { setShowCompanyForm(false); loadCompanies(); }}
          />
        )}
      </main>
      <BottomNav />
    </>
  );
}

const S = {
  greet: { fontSize: 13, color: '#94a3b8', margin: '4px 0 12px' },
  settingsLink: {
    display: 'block', textAlign: 'center',
    color: '#94a3b8', textDecoration: 'none',
    fontSize: 13, fontWeight: 600,
    marginTop: 16, padding: '12px',
  },
};
