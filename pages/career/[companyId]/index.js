import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../lib/use-auth';
import BottomNav from '../../../components/BottomNav';
import ProjectCard from '../../../components/career/ProjectCard';
import AchievementList from '../../../components/career/AchievementList';
import AchievementForm from '../../../components/career/AchievementForm';
import CompanyForm from '../../../components/career/CompanyForm';
import PublicToggle from '../../../components/career/PublicToggle';
import { C, fmtPeriod } from '../../../components/career/careerStyles';

const TABS = [
  { key: 'projects',     label: '프로젝트' },
  { key: 'achievements', label: '성과' },
  { key: 'info',         label: '정보' },
];

export default function CompanyDetailPage() {
  const router = useRouter();
  const { companyId } = router.query;
  const { isAuthed, loading: authLoading } = useAuth();

  const [tab, setTab] = useState('projects');
  const [company, setCompany] = useState(null);
  const [projects, setProjects] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingCompany, setEditingCompany] = useState(false);
  const [addingAch, setAddingAch] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthed) {
      router.replace(`/login?next=${encodeURIComponent(`/career/${companyId || ''}`)}`);
    }
  }, [authLoading, isAuthed, router, companyId]);

  const getToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token;
  }, []);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true); setError(null);
    try {
      const token = await getToken();
      const hdr = { Authorization: `Bearer ${token}` };
      const [cR, pR, aR] = await Promise.all([
        fetch(`/api/career/companies/${companyId}`, { headers: hdr }),
        fetch(`/api/career/projects?companyId=${companyId}`, { headers: hdr }),
        fetch(`/api/career/achievements?companyId=${companyId}`, { headers: hdr }),
      ]);
      const cJ = await cR.json().catch(() => ({}));
      const pJ = await pR.json().catch(() => ({}));
      const aJ = await aR.json().catch(() => ({}));
      if (!cR.ok) throw new Error(cJ.error || `HTTP ${cR.status}`);
      setCompany(cJ.company);
      setProjects(pJ.projects || []);
      setAchievements(aJ.achievements || []);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [companyId, getToken]);

  useEffect(() => {
    if (isAuthed && companyId) load();
  }, [isAuthed, companyId, load]);

  async function onDeleteCompany() {
    if (!confirm('이 회사와 모든 프로젝트/성과를 삭제합니다. 진행할까요?')) return;
    const token = await getToken();
    const r = await fetch(`/api/career/companies/${companyId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (r.ok || r.status === 204) router.replace('/career');
  }

  return (
    <>
      <Head>
        <title>{company?.name || '회사'} | 커리어</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#0f172a" />
      </Head>
      <main style={C.page}>
        <header style={C.header}>
          <Link href="/career" style={C.backLink}>← 커리어</Link>
          <h1 style={C.title}>{company?.name || '…'}</h1>
          <div style={{ width: 44 }} />
        </header>

        {authLoading || loading ? (
          <div style={C.loading}>…</div>
        ) : !company ? (
          <div style={C.body}>
            <div style={C.errorBox}>{error || '회사를 찾을 수 없습니다'}</div>
          </div>
        ) : (
          <div style={C.body}>
            {/* Tabs */}
            <div style={S.tabBar}>
              {TABS.map(t => (
                <button key={t.key} type="button" onClick={() => setTab(t.key)}
                  style={{ ...S.tabBtn, ...(tab === t.key ? S.tabBtnActive : null) }}>
                  {t.label}
                </button>
              ))}
            </div>

            {error && <div style={C.errorBox}>{error}</div>}

            {tab === 'projects' && (
              <>
                {projects.length === 0 ? (
                  <div style={C.empty}>등록된 프로젝트가 없습니다.</div>
                ) : projects.map(p => (
                  <ProjectCard key={p.id} project={p} companyId={companyId} />
                ))}
                <Link href={`/career/${companyId}/projects/new`} style={{
                  ...C.primaryBtn, display: 'block', textAlign: 'center',
                  textDecoration: 'none', marginTop: 12,
                }}>
                  + 프로젝트 추가
                </Link>
              </>
            )}

            {tab === 'achievements' && (
              <>
                {addingAch ? (
                  <AchievementForm
                    companyId={companyId}
                    onSaved={() => { setAddingAch(false); load(); }}
                    onCancel={() => setAddingAch(false)}
                  />
                ) : (
                  <button type="button" onClick={() => setAddingAch(true)}
                    style={{ ...C.primaryBtn, marginBottom: 12 }}>
                    + 성과 추가
                  </button>
                )}
                <AchievementList
                  achievements={achievements}
                  companyId={companyId}
                  onChanged={load}
                />
              </>
            )}

            {tab === 'info' && (
              <>
                <section style={C.card}>
                  <InfoRow label="회사명" value={company.name} />
                  <InfoRow label="국가/도시" value={[company.country, company.city].filter(Boolean).join(' / ')} />
                  <InfoRow label="업종" value={company.industry} />
                  <InfoRow label="부서" value={company.department} />
                  <InfoRow label="직책" value={company.title} />
                  <InfoRow label="고용 형태" value={company.employment_type} />
                  <InfoRow label="재직 기간"
                    value={fmtPeriod(company.start_date, company.end_date, company.is_current)} />
                  <InfoRow label="재직중" value={company.is_current ? '예' : '아니오'} />
                </section>

                <section style={C.card}>
                  <div style={S.label}>포트폴리오 공개</div>
                  <PublicToggle
                    endpoint={`/api/career/companies/${companyId}`}
                    value={company.is_public}
                    onChanged={(v) => setCompany(c => ({ ...c, is_public: v }))}
                  />
                </section>

                <button type="button" onClick={() => setEditingCompany(true)}
                  style={{ ...C.secondaryBtn, marginBottom: 8 }}>
                  편집
                </button>
                <button type="button" onClick={onDeleteCompany} style={C.dangerBtn}>
                  삭제
                </button>
              </>
            )}
          </div>
        )}

        {editingCompany && (
          <CompanyForm
            initial={company}
            onClose={() => setEditingCompany(false)}
            onSaved={() => { setEditingCompany(false); load(); }}
          />
        )}
      </main>
      <BottomNav />
    </>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={S.infoRow}>
      <div style={S.infoLabel}>{label}</div>
      <div style={S.infoValue}>{value || '—'}</div>
    </div>
  );
}

const S = {
  tabBar: {
    display: 'flex', gap: 4, marginBottom: 12,
    background: '#1e293b', padding: 4, borderRadius: 10,
    border: '1px solid #334155',
  },
  tabBtn: {
    flex: 1, padding: '10px 8px',
    background: 'transparent', color: '#94a3b8',
    border: 'none', borderRadius: 6,
    fontSize: 13, fontWeight: 600, cursor: 'pointer', minHeight: 40,
  },
  tabBtnActive: { background: '#ef4444', color: '#fff' },
  label: { fontSize: 12, color: '#94a3b8', fontWeight: 600, marginBottom: 8, letterSpacing: 0.3 },
  infoRow: {
    display: 'flex', gap: 8, padding: '8px 0',
    borderBottom: '1px solid #1f2937',
  },
  infoLabel: { width: 92, fontSize: 12, color: '#94a3b8', fontWeight: 600 },
  infoValue: { flex: 1, fontSize: 13, color: '#e2e8f0' },
};
