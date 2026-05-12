import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { C, ACHIEVEMENT_TYPE_LABELS } from './careerStyles';
import AchievementForm from './AchievementForm';

export default function AchievementList({ achievements = [], companyId, onChanged }) {
  const [editingId, setEditingId] = useState(null);

  if (achievements.length === 0) {
    return <div style={C.empty}>등록된 성과가 없습니다.</div>;
  }

  // Group by year of achieved_at (desc), no-date items in '미상'.
  const grouped = {};
  for (const a of achievements) {
    const yr = a.achieved_at ? String(a.achieved_at).slice(0, 4) : '미상';
    if (!grouped[yr]) grouped[yr] = [];
    grouped[yr].push(a);
  }
  const years = Object.keys(grouped).sort((a, b) => (a < b ? 1 : -1));

  async function onDelete(id) {
    if (!confirm('이 성과를 삭제하시겠습니까?')) return;
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    const r = await fetch(`/api/career/achievements/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (r.ok || r.status === 204) onChanged?.();
  }

  return (
    <div>
      {years.map(yr => (
        <div key={yr} style={{ marginBottom: 12 }}>
          <div style={S.yearLine}>
            <span style={S.year}>{yr}</span>
            <span style={S.line} />
          </div>
          {grouped[yr].map(a => editingId === a.id ? (
            <AchievementForm key={a.id}
              companyId={companyId}
              initial={a}
              onSaved={() => { setEditingId(null); onChanged?.(); }}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <div key={a.id} style={C.card}>
              <div style={S.headerRow}>
                <span style={S.typeBadge}>{ACHIEVEMENT_TYPE_LABELS[a.achievement_type] || a.achievement_type}</span>
                {a.is_public && <span style={S.public}>공개</span>}
                {a.achieved_at && <span style={S.date}>{a.achieved_at}</span>}
              </div>
              <div style={S.title}>{a.title}</div>
              {a.detail && <div style={S.detail}>{a.detail}</div>}
              {(a.metric_before || a.metric_after) && (
                <div style={S.metric}>
                  <span style={S.metricLabel}>{a.metric_label || '지표'}</span>
                  <span style={S.metricVal}>
                    {a.metric_before || '?'} → <strong style={{ color: '#fbbf24' }}>{a.metric_after || '?'}</strong>
                  </span>
                </div>
              )}
              <div style={S.row}>
                <button type="button" onClick={() => setEditingId(a.id)} style={C.ghostBtn}>편집</button>
                <button type="button" onClick={() => onDelete(a.id)}
                  style={{ ...C.ghostBtn, color: '#fca5a5', borderColor: 'rgba(220,38,38,0.4)' }}>
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

const S = {
  yearLine: { display: 'flex', alignItems: 'center', gap: 10, margin: '8px 0 10px' },
  year:     { fontSize: 13, fontWeight: 700, color: '#ef4444',
              fontFamily: 'ui-monospace, Menlo, Consolas, monospace' },
  line:     { flex: 1, height: 1, background: '#1f2937' },
  headerRow:{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' },
  typeBadge: {
    background: 'rgba(168,85,247,0.2)', color: '#d8b4fe',
    fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
  },
  public: {
    background: 'rgba(34,197,94,0.2)', color: '#86efac',
    fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
  },
  date:   { fontSize: 11, color: '#64748b', marginLeft: 'auto',
            fontFamily: 'ui-monospace, Menlo, Consolas, monospace' },
  title:  { fontSize: 15, fontWeight: 700, color: '#f8fafc', marginBottom: 4 },
  detail: { fontSize: 13, color: '#cbd5e1', lineHeight: 1.5, marginBottom: 8 },
  metric: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '8px 10px', background: '#0f172a',
    border: '1px dashed #334155', borderRadius: 8, marginBottom: 8,
  },
  metricLabel: { fontSize: 12, color: '#94a3b8' },
  metricVal:   { fontSize: 13, color: '#cbd5e1',
                 fontFamily: 'ui-monospace, Menlo, Consolas, monospace' },
  row: { display: 'flex', gap: 6 },
};
