// 경영실적 목록 — 월별 카드 (최신순)
import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/use-auth';
import BottomNav from '../../components/BottomNav';

function isProdReady(p) {
  if (!p || typeof p !== 'object') return false;
  return ['actual_qty', 'actual_eff', 'actual_oee'].some((k) => p[k] !== undefined && p[k] !== '');
}
function isQualityReady(q) {
  if (!q || typeof q !== 'object') return false;
  return ['customer_ppm', 'inprocess_ppm', 'incoming_ppm', 'claim_cost'].some((k) => q[k] !== undefined && q[k] !== '');
}
function isWeeklyReady(w) {
  if (!Array.isArray(w)) return false;
  return w.some((t) => t && t.content && String(t.content).trim() !== '');
}

export default function ReportsIndex() {
  const { isAuthed } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true); setErr(null);
    try {
      const res = await fetch('/api/reports');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'load failed');
      setItems(json.items || []);
    } catch (e) {
      setErr(e.message);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function createCurrent() {
    if (!isAuthed) { alert('로그인이 필요합니다'); return; }
    setCreating(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      const now = new Date();
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ year: now.getFullYear(), month: now.getMonth() + 1 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'create failed');
      await load();
    } catch (e) {
      alert('에러: ' + e.message);
    } finally { setCreating(false); }
  }

  return (
    <>
      <Head><title>경영실적 | DSC FMS</title></Head>
      <div style={S.page}>
        <div style={S.wrap}>
          <h1 style={S.h1}>경영실적</h1>

          {/* 3개 독립 섹션 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
            <Link href="/reports/quality" style={S.sectionCard}>
              <div style={S.sectionIcon}>📊</div>
              <div>
                <div style={S.sectionTitle}>품질지수</div>
                <div style={S.sectionSub}>Korea Report 업로드 → Excel·PPT 자동 생성</div>
              </div>
              <div style={S.arrow}>›</div>
            </Link>
            <Link href="/reports/production" style={S.sectionCard}>
              <div style={S.sectionIcon}>🏭</div>
              <div>
                <div style={S.sectionTitle}>생산성</div>
                <div style={S.sectionSub}>생산현황 업로드 → 생산성집계·PPT 자동 생성</div>
              </div>
              <div style={S.arrow}>›</div>
            </Link>
            <Link href="/reports/weekly" style={S.sectionCard}>
              <div style={S.sectionIcon}>📋</div>
              <div>
                <div style={S.sectionTitle}>주간업무</div>
                <div style={S.sectionSub}>주차별 업무 내용 입력 및 관리</div>
              </div>
              <div style={S.arrow}>›</div>
            </Link>
          </div>

          {/* 구분선 */}
          <div style={{ borderTop: '1px solid #334155', marginBottom: 16 }} />
          <p style={S.sub}>월별 통합 보고</p>

          <button onClick={createCurrent} disabled={creating || !isAuthed} style={S.addBtn}>
            {creating ? '생성 중…' : '+ 새 월 추가 (이번 달)'}
          </button>
          {!isAuthed && <div style={S.warn}>로그인 후 작성 가능합니다.</div>}

          {loading && <div style={S.muted}>불러오는 중…</div>}
          {err && <div style={S.err}>에러: {err}</div>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
            {items.map((it) => {
              const prodOk = isProdReady(it.production);
              const qOk = isQualityReady(it.quality);
              const wOk = isWeeklyReady(it.weekly_tasks);
              const xlsxOk = !!it.file_status?.excel;
              const pptOk  = !!it.file_status?.ppt;
              return (
                <Link key={it.id} href={`/reports/${it.year}/${it.month}`} style={S.card}>
                  <div style={S.cardTop}>
                    <div style={S.cardTitle}>{it.year}년 {it.month}월</div>
                    <div style={S.arrow}>›</div>
                  </div>
                  <div style={S.badges}>
                    <Badge ok={prodOk}>생산성</Badge>
                    <Badge ok={qOk}>품질</Badge>
                    <Badge ok={wOk}>주간업무</Badge>
                  </div>
                  <div style={S.files}>
                    <span style={xlsxOk ? S.fileOn : S.fileOff}>2번(xlsx) {xlsxOk ? '생성됨' : '미생성'}</span>
                    <span style={pptOk ? S.fileOn : S.fileOff}>3번(ppt) {pptOk ? '요청됨' : '미생성'}</span>
                  </div>
                </Link>
              );
            })}
            {!loading && items.length === 0 && (
              <div style={S.empty}>아직 등록된 월별 보고가 없습니다.</div>
            )}
          </div>
        </div>
        <BottomNav />
      </div>
    </>
  );
}

function Badge({ ok, children }) {
  return (
    <span style={ok ? S.badgeOn : S.badgeOff}>
      {ok ? '✓ ' : '· '}{children}
    </span>
  );
}

const S = {
  page: { minHeight: '100vh', background: '#0f172a', color: '#f1f5f9', paddingBottom: 80 },
  wrap: { maxWidth: 480, margin: '0 auto', padding: '16px 14px 0' },
  h1: { fontSize: 22, margin: '4px 0 16px', fontWeight: 800 },
  sub: { fontSize: 13, color: '#94a3b8', margin: '0 0 12px' },
  sectionCard: {
    display: 'flex', alignItems: 'center', gap: 14, textDecoration: 'none', color: '#f1f5f9',
    background: '#1e293b', border: '1px solid #334155', borderRadius: 14, padding: '14px 16px',
  },
  sectionIcon: { fontSize: 28 },
  sectionTitle: { fontSize: 16, fontWeight: 700, marginBottom: 2 },
  sectionSub: { fontSize: 12, color: '#94a3b8' },
  addBtn: {
    width: '100%', padding: '12px 14px', background: '#3b82f6', color: '#fff',
    border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 700,
    minHeight: 44, cursor: 'pointer',
  },
  warn: { marginTop: 8, padding: '8px 10px', background: '#7f1d1d33', color: '#fca5a5', borderRadius: 8, fontSize: 13 },
  muted: { marginTop: 12, color: '#94a3b8' },
  err: { marginTop: 12, color: '#fca5a5' },
  card: {
    display: 'block', textDecoration: 'none', color: '#f1f5f9',
    background: '#1e293b', border: '1px solid #334155',
    borderRadius: 12, padding: 14,
  },
  cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 17, fontWeight: 700 },
  arrow: { fontSize: 22, color: '#64748b' },
  badges: { display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  badgeOn: {
    padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
    background: 'rgba(34,197,94,0.2)', color: '#22c55e',
  },
  badgeOff: {
    padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 500,
    background: '#33415588', color: '#94a3b8',
  },
  files: { marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 11 },
  fileOn: { color: '#22c55e' },
  fileOff: { color: '#64748b' },
  empty: { padding: 22, textAlign: 'center', color: '#64748b' },
};
