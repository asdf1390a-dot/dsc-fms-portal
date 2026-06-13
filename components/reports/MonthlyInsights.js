// 실적추이분석(인사이트) — 자동 코멘트
import React from 'react';

export default function MonthlyInsights({ trends }) {
  const comments = buildComments(trends || []);
  return (
    <div style={S.box}>
      <div style={S.title}>실적추이분석</div>
      {comments.length === 0 ? (
        <div style={S.muted}>비교할 과거 데이터가 부족합니다.</div>
      ) : (
        <ul style={S.list}>
          {comments.map((c, i) => (
            <li key={i} style={{ ...S.item, color: c.tone === 'good' ? '#22c55e' : c.tone === 'bad' ? '#fca5a5' : '#cbd5e1' }}>
              {c.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function buildComments(trends) {
  const out = [];
  for (const t of trends) {
    if (t.momPct != null) {
      const dir = t.momPct > 0 ? '증가' : '감소';
      const tone = isGood(t.momDelta, t.better);
      out.push({
        text: `[${t.label}] 전월 대비 ${Math.abs(t.momPct).toFixed(1)}% ${dir} (${fmt(t.mom)} → ${fmt(t.current)})`,
        tone,
      });
    }
    if (t.yoyPct != null) {
      const dir = t.yoyPct > 0 ? '증가' : '감소';
      const tone = isGood(t.yoyDelta, t.better);
      out.push({
        text: `[${t.label}] 전년 동월 대비 ${Math.abs(t.yoyPct).toFixed(1)}% ${dir}`,
        tone,
      });
    }
  }
  return out;
}
function isGood(delta, better) {
  if (delta == null) return 'neutral';
  if (better === 'up')   return delta > 0 ? 'good' : delta < 0 ? 'bad' : 'neutral';
  if (better === 'down') return delta < 0 ? 'good' : delta > 0 ? 'bad' : 'neutral';
  return 'neutral';
}
function fmt(v) {
  if (v == null) return '—';
  if (Math.abs(v) >= 1000) return v.toLocaleString();
  return Number(v).toFixed(Math.abs(v) >= 100 ? 0 : 2);
}

const S = {
  box: { background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: 14 },
  title: { fontSize: 14, fontWeight: 800, marginBottom: 8 },
  list: { margin: 0, paddingLeft: 18 },
  item: { fontSize: 13, marginBottom: 4, lineHeight: 1.5 },
  muted: { fontSize: 13, color: '#64748b' },
};
