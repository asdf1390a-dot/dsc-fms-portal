// pages/bm/stats.js
// BM KPI 통계 대시보드 — 월별 고장건수 / 평균 MTTR / 최다 고장 설비 Top5

import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import BottomNav from '../../components/BottomNav';

const PRESETS = [
  { key: 'this_month',  label: '이번 달' },
  { key: 'last_month',  label: '지난 달' },
  { key: 'last_3m',     label: '최근 3개월' },
];

function rangeFor(preset) {
  const now = new Date();
  if (preset === 'this_month') {
    const s = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start: s, end: now };
  }
  if (preset === 'last_month') {
    const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const e = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    return { start: s, end: e };
  }
  // last_3m
  const s = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  return { start: s, end: now };
}

function fmtRange({ start, end }) {
  const f = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `${f(start)} ~ ${f(end)}`;
}

export default function BMStatsPage() {
  const [preset, setPreset] = useState('this_month');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const range = useMemo(() => rangeFor(preset), [preset]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setError(null);
      try {
        const { data, error } = await supabase
          .from('bm_events')
          .select('id, asset_id, status, reported_at, resolved_at, downtime_start, downtime_end, downtime_minutes, severity, assets(machine_asset_number, name_en)')
          .gte('reported_at', range.start.toISOString())
          .lte('reported_at', range.end.toISOString())
          .order('reported_at', { ascending: false })
          .limit(5000);
        if (cancelled) return;
        if (error) throw error;
        setRows(data || []);
      } catch (e) {
        if (!cancelled) setError(e.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [range.start, range.end]);

  // MTTR 계산: bm_kpi 뷰와 동일 기준
  // coalesce(downtime_end, resolved_at) - coalesce(downtime_start, reported_at)
  function mttrMinutes(r) {
    const startIso = r.downtime_start || r.reported_at;
    const endIso = r.downtime_end || r.resolved_at;
    if (!startIso || !endIso) return null;
    const start = new Date(startIso).getTime();
    const end = new Date(endIso).getTime();
    if (isNaN(start) || isNaN(end) || end < start) return null;
    return Math.round((end - start) / 60000);
  }

  // 집계
  const summary = useMemo(() => {
    const total = rows.length;
    const resolved = rows.filter(r => r.status === 'resolved').length;
    const downtimes = rows
      .map(mttrMinutes)
      .filter(v => v != null);
    const avgMttr = downtimes.length
      ? Math.round(downtimes.reduce((a, b) => a + b, 0) / downtimes.length)
      : null;
    const open = rows.filter(r => r.status === 'open' || r.status === 'in_progress' || r.status === 'pending_parts').length;
    return { total, resolved, open, avgMttr };
  }, [rows]);

  const top5 = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      const key = r.asset_id || 'unknown';
      const cur = map.get(key) || {
        asset_id: r.asset_id,
        tag: r.assets?.machine_asset_number || '—',
        name: r.assets?.name_en || '',
        count: 0,
        totalDown: 0,
        downSamples: 0,
      };
      cur.count += 1;
      const m = mttrMinutes(r);
      if (m != null) {
        cur.totalDown += m;
        cur.downSamples += 1;
      }
      map.set(key, cur);
    }
    return Array.from(map.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map(x => ({
        ...x,
        avgDown: x.downSamples ? Math.round(x.totalDown / x.downSamples) : null,
      }));
  }, [rows]);

  return (
    <>
      <Head>
        <title>BM 통계 | DSC FMS</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#0f172a" />
      </Head>
      <main style={S.page}>
        <header style={S.header}>
          <Link href="/bm" style={S.backLink} aria-label="돌아가기">← BM</Link>
          <div style={S.headerTitleWrap}>
            <div style={S.headerTitle}>BM 통계</div>
            <div style={S.headerSubtitle}>{fmtRange(range)}</div>
          </div>
          <div style={{ width: 44 }} />
        </header>

        {/* 기간 선택 */}
        <div style={S.presetRow}>
          {PRESETS.map(p => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPreset(p.key)}
              style={{
                ...S.presetBtn,
                ...(preset === p.key ? S.presetBtnActive : null),
              }}
            >{p.label}</button>
          ))}
        </div>

        {error && <div style={S.errorBox}>{error}</div>}

        {/* KPI 카드 */}
        <div style={S.cardGrid}>
          <KpiCard label="총 고장" value={loading ? '…' : `${summary.total}건`} accent="#dc2626" />
          <KpiCard label="해결" value={loading ? '…' : `${summary.resolved}건`} accent="#22c55e" />
          <KpiCard label="진행 중" value={loading ? '…' : `${summary.open}건`} accent="#f97316" />
          <KpiCard
            label="평균 MTTR"
            value={loading ? '…' : (summary.avgMttr != null ? `${summary.avgMttr} 분` : '—')}
            accent="#2563eb"
          />
        </div>

        {/* Top5 설비 */}
        <section style={S.section}>
          <div style={S.sectionTitle}>최다 고장 설비 Top5</div>
          <div style={S.sectionBody}>
            {loading ? (
              <div style={S.empty}>불러오는 중…</div>
            ) : top5.length === 0 ? (
              <div style={S.empty}>데이터 없음</div>
            ) : (
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>자산</th>
                    <th style={{ ...S.th, textAlign: 'right' }}>건수</th>
                    <th style={{ ...S.th, textAlign: 'right' }}>평균 MTTR</th>
                  </tr>
                </thead>
                <tbody>
                  {top5.map((r, i) => (
                    <tr key={i} style={S.tr}>
                      <td style={S.td}>
                        <div style={S.assetTag}>{r.tag}</div>
                        {r.name && <div style={S.assetName}>{r.name}</div>}
                      </td>
                      <td style={{ ...S.td, textAlign: 'right', fontWeight: 700 }}>{r.count}</td>
                      <td style={{ ...S.td, textAlign: 'right', color: '#94a3b8' }}>
                        {r.avgDown != null ? `${r.avgDown} 분` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </main>
      <BottomNav />
    </>
  );
}

function KpiCard({ label, value, accent }) {
  return (
    <div style={{ ...S.kpiCard, borderTop: `3px solid ${accent}` }}>
      <div style={S.kpiLabel}>{label}</div>
      <div style={S.kpiValue}>{value}</div>
    </div>
  );
}

const S = {
  page: {
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans Tamil", "Noto Sans KR", sans-serif',
    background: '#0f172a', minHeight: '100vh', color: '#e2e8f0',
    paddingBottom: 'calc(60px + env(safe-area-inset-bottom, 0px) + 24px)',
    maxWidth: 480, margin: '0 auto',
  },
  header: {
    position: 'sticky', top: 0, zIndex: 20,
    background: '#0f172a', borderBottom: '1px solid #1f2937',
    padding: '10px 14px',
    display: 'flex', alignItems: 'center', gap: 10,
    boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
  },
  backLink: {
    color: '#94a3b8', textDecoration: 'none', fontSize: 14,
    minHeight: 44, minWidth: 44,
    display: 'inline-flex', alignItems: 'center', padding: '0 4px',
  },
  headerTitleWrap: { flex: 1, minWidth: 0, textAlign: 'center' },
  headerTitle: { fontSize: 15, fontWeight: 700, color: '#f8fafc' },
  headerSubtitle: {
    fontSize: 11, color: '#94a3b8', marginTop: 1,
    fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
  },
  presetRow: {
    display: 'flex', gap: 8, padding: '12px 14px 0',
  },
  presetBtn: {
    flex: 1, padding: '10px',
    background: '#0b1220', color: '#cbd5e1',
    border: '1px solid #334155', borderRadius: 8,
    fontSize: 13, fontWeight: 600, cursor: 'pointer', minHeight: 44,
  },
  presetBtnActive: {
    background: '#2563eb', color: '#fff', borderColor: '#2563eb',
  },
  errorBox: {
    margin: 14, padding: 14,
    background: 'rgba(220,38,38,0.15)', color: '#fca5a5',
    border: '1px solid rgba(220,38,38,0.4)',
    borderRadius: 10, fontSize: 14,
  },
  cardGrid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
    padding: 14,
  },
  kpiCard: {
    background: '#1e293b', borderRadius: 10,
    border: '1px solid #1f2937', padding: 14,
    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
  },
  kpiLabel: {
    fontSize: 11, color: '#94a3b8', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6,
  },
  kpiValue: { fontSize: 22, fontWeight: 800, color: '#f8fafc' },
  section: {
    background: '#1e293b', borderRadius: 12, margin: '4px 14px 10px',
    border: '1px solid #1f2937', overflow: 'hidden',
    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
  },
  sectionTitle: {
    padding: '10px 14px', fontSize: 11, fontWeight: 700,
    color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.6,
    background: '#0f172a', borderBottom: '1px solid #1f2937',
  },
  sectionBody: { padding: 6 },
  empty: { padding: 24, textAlign: 'center', color: '#64748b', fontSize: 13 },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    fontSize: 11, color: '#94a3b8', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: 0.5,
    padding: '8px 10px', textAlign: 'left',
    borderBottom: '1px solid #1f2937',
  },
  tr: { borderBottom: '1px solid rgba(31,41,55,0.5)' },
  td: { padding: '10px', fontSize: 13, color: '#e2e8f0', verticalAlign: 'top' },
  assetTag: {
    fontSize: 13, fontWeight: 700, color: '#f8fafc',
    fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
  },
  assetName: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
};
