// 월간 KPI 카드 그리드 — 현재값 + MoM/YoY 델타
import React from 'react';

export default function MonthlyKpiCards({ trends }) {
  if (!trends?.length) return <div style={S.empty}>표시할 KPI가 없습니다.</div>;
  return (
    <div style={S.grid}>
      {trends.map((t) => <Card key={t.key} t={t} />)}
    </div>
  );
}

function Card({ t }) {
  const goodMom = isGood(t.momDelta, t.better);
  const goodYoy = isGood(t.yoyDelta, t.better);
  return (
    <div style={S.card}>
      <div style={S.label}>{t.label}</div>
      <div style={S.value}>{fmt(t.current)}</div>
      <div style={S.deltas}>
        <Delta tone={goodMom} pct={t.momPct} label="전월" />
        <Delta tone={goodYoy} pct={t.yoyPct} label="전년" />
      </div>
    </div>
  );
}

function Delta({ tone, pct, label }) {
  if (pct == null) return <span style={S.dim}>{label} —</span>;
  const sign = pct > 0 ? '+' : '';
  const color = tone === 'good' ? '#22c55e' : tone === 'bad' ? '#ef4444' : '#94a3b8';
  return <span style={{ color, fontSize: 12 }}>{label} {sign}{pct.toFixed(1)}%</span>;
}

function fmt(v) {
  if (v == null) return '—';
  if (Math.abs(v) >= 1000) return v.toLocaleString();
  return Number(v).toFixed(Math.abs(v) >= 100 ? 0 : 2);
}

function isGood(delta, better) {
  if (delta == null) return 'neutral';
  if (better === 'up')   return delta > 0 ? 'good' : delta < 0 ? 'bad' : 'neutral';
  if (better === 'down') return delta < 0 ? 'good' : delta > 0 ? 'bad' : 'neutral';
  return 'neutral';
}

const S = {
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 },
  card: { background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: 12 },
  label: { fontSize: 12, color: '#94a3b8' },
  value: { fontSize: 22, fontWeight: 800, margin: '4px 0' },
  deltas: { display: 'flex', flexDirection: 'column', gap: 2 },
  dim: { fontSize: 12, color: '#64748b' },
  empty: { padding: 16, textAlign: 'center', color: '#64748b' },
};
