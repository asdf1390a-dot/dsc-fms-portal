// 월간 경영실적 — 상세 (CEO 전용)
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useAuth } from '../../../../lib/use-auth';
import BottomNav from '../../../../components/BottomNav';
import MonthlyKpiCards from '../../../../components/reports/MonthlyKpiCards';
import MonthlyTrendChart from '../../../../components/reports/MonthlyTrendChart';
import MonthlyInsights from '../../../../components/reports/MonthlyInsights';
import AccessLogTable from '../../../../components/reports/AccessLogTable';

export default function MonthlyPerformanceDetail() {
  const router = useRouter();
  const { year, month } = router.query;
  const { user, isAuthed } = useAuth();
  const role = user?.user_metadata?.role || user?.app_metadata?.role;
  const isCeo = role === 'ceo' || role === 'admin';

  const [data, setData] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [downloading, setDownloading] = useState(false);

  async function authedFetch(url, opts = {}) {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess?.session?.access_token;
    return fetch(url, {
      ...opts,
      headers: { ...(opts.headers || {}), Authorization: token ? `Bearer ${token}` : '' },
    });
  }

  async function load() {
    if (!year || !month) return;
    setLoading(true); setErr(null);
    try {
      const [r1, r2] = await Promise.all([
        authedFetch(`/api/reports/monthly-performance/${year}/${month}`),
        authedFetch(`/api/reports/monthly-performance/${year}/${month}/access-logs`),
      ]);
      const j1 = await r1.json();
      if (!r1.ok) throw new Error(j1.error || 'load failed');
      setData(j1);
      if (r2.ok) {
        const j2 = await r2.json();
        setLogs(j2.items || []);
      }
    } catch (e) {
      setErr(e.message);
    } finally { setLoading(false); }
  }
  useEffect(() => { if (isAuthed && isCeo) load(); }, [isAuthed, isCeo, year, month]);

  async function onDownload() {
    setDownloading(true);
    try {
      const res = await authedFetch(`/api/reports/monthly-performance/${year}/${month}/download`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'no file');
      window.open(json.url, '_blank');
    } catch (e) {
      alert('다운로드 실패: ' + e.message);
    } finally { setDownloading(false); }
  }

  if (!isAuthed) return <Gate text="로그인이 필요합니다." />;
  if (!isCeo)   return <Gate text="CEO 권한이 필요한 페이지입니다." />;

  const item = data?.item;
  const insights = data?.insights_live || item?.insights || {};
  const trends = insights.trends || [];
  const series = insights.series || [];

  return (
    <>
      <Head><title>{year}년 {month}월 경영실적 | DSC FMS</title></Head>
      <div style={S.page}>
        <div style={S.wrap}>
          <Link href="/reports/monthly-performance" style={S.back}>‹ 목록</Link>
          <h1 style={S.h1}>{year}년 {month}월 경영실적</h1>

          {loading && <div style={S.muted}>불러오는 중…</div>}
          {err && <div style={S.err}>에러: {err}</div>}

          {item && (
            <>
              <div style={S.metaRow}>
                <span style={item.is_auto ? S.tagAuto : S.tagManual}>
                  {item.is_auto ? '자동 생성' : '수동 생성'}
                </span>
                <span style={S.tagStatus}>{item.status}</span>
                <span style={S.metaTime}>생성 {fmtTime(item.generated_at)}</span>
                {item.source_file_path && (
                  <button onClick={onDownload} disabled={downloading} style={S.dlBtn}>
                    {downloading ? '...' : '원본 다운로드'}
                  </button>
                )}
              </div>

              <Section title="핵심 KPI">
                <MonthlyKpiCards trends={trends} />
              </Section>

              <Section title="추이">
                <div style={S.charts}>
                  <MonthlyTrendChart series={series} dataKey="production_qty" label="생산수량"  color="#3b82f6" />
                  <MonthlyTrendChart series={series} dataKey="oee"            label="OEE"      color="#22c55e" />
                  <MonthlyTrendChart series={series} dataKey="eff"            label="효율"     color="#eab308" />
                  <MonthlyTrendChart series={series} dataKey="customer_ppm"   label="고객PPM"  color="#ef4444" />
                </div>
              </Section>

              <Section title="분석">
                <MonthlyInsights trends={trends} />
              </Section>

              <Section title="감사 로그">
                <AccessLogTable items={logs} />
              </Section>
            </>
          )}
        </div>
        <BottomNav />
      </div>
    </>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginTop: 18 }}>
      <div style={S.sectionTitle}>{title}</div>
      {children}
    </div>
  );
}
function Gate({ text }) {
  return (
    <div style={{ ...S.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ padding: 24, color: '#fca5a5' }}>{text}</div>
    </div>
  );
}
function fmtTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const kst = new Date(d.getTime() + 9 * 3600 * 1000);
  return kst.toISOString().slice(0, 16).replace('T', ' ');
}

const S = {
  page: { minHeight: '100vh', background: '#0f172a', color: '#f1f5f9', paddingBottom: 80 },
  wrap: { maxWidth: 720, margin: '0 auto', padding: '14px 14px 0' },
  back: { color: '#94a3b8', textDecoration: 'none', fontSize: 13 },
  h1: { fontSize: 22, margin: '4px 0 10px', fontWeight: 800 },
  muted: { marginTop: 12, color: '#94a3b8' },
  err: { marginTop: 12, color: '#fca5a5' },
  metaRow: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 },
  tagAuto: { padding: '3px 8px', borderRadius: 999, fontSize: 11, background: 'rgba(34,197,94,0.18)', color: '#22c55e' },
  tagManual: { padding: '3px 8px', borderRadius: 999, fontSize: 11, background: 'rgba(59,130,246,0.18)', color: '#3b82f6' },
  tagStatus: { padding: '3px 8px', borderRadius: 999, fontSize: 11, background: '#33415588', color: '#cbd5e1' },
  metaTime: { fontSize: 11, color: '#64748b' },
  dlBtn: {
    marginLeft: 'auto', minHeight: 32, padding: '6px 12px',
    background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: 8,
    fontSize: 13, fontWeight: 700, cursor: 'pointer',
  },
  sectionTitle: { fontSize: 13, fontWeight: 700, color: '#94a3b8', margin: '8px 0' },
  charts: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px,1fr))', gap: 10 },
};
