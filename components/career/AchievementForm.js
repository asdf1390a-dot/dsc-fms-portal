import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { C, ACHIEVEMENT_TYPE_LABELS } from './careerStyles';

const TYPES = ['award','kpi_improvement','cost_reduction','process','certification','other'];

export default function AchievementForm({ companyId, initial, onSaved, onCancel }) {
  const editing = !!initial?.id;
  const [form, setForm] = useState({
    title:            initial?.title || '',
    detail:           initial?.detail || '',
    achieved_at:      initial?.achieved_at || '',
    achievement_type: initial?.achievement_type || 'improvement',
    metric_label:     initial?.metric_label || '',
    metric_before:    initial?.metric_before || '',
    metric_after:     initial?.metric_after || '',
    is_public:        !!initial?.is_public,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  function upd(k, v) { setForm(p => ({ ...p, [k]: v })); }

  async function getToken() {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token;
  }

  async function onSave(e) {
    e.preventDefault();
    if (!form.title.trim()) { setError('성과명은 필수입니다'); return; }
    setSubmitting(true); setError(null);
    try {
      const token = await getToken();
      if (!token) { setError('로그인이 필요합니다'); setSubmitting(false); return; }
      const payload = {
        company_id:       companyId,
        title:            form.title.trim(),
        detail:           form.detail.trim() || null,
        achieved_at:      form.achieved_at || null,
        achievement_type: form.achievement_type,
        metric_label:     form.metric_label.trim() || null,
        metric_before:    form.metric_before.trim() || null,
        metric_after:     form.metric_after.trim() || null,
        is_public:        !!form.is_public,
      };
      const url    = editing ? `/api/career/achievements/${initial.id}` : '/api/career/achievements';
      const method = editing ? 'PATCH' : 'POST';
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(json.error || `HTTP ${r.status}`);
      onSaved?.(json.achievement);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSave} style={C.card}>
      <Field label="성과명 *">
        <input type="text" value={form.title} onChange={(e) => upd('title', e.target.value)}
          required style={C.input} />
      </Field>

      <div style={{ display: 'flex', gap: 8 }}>
        <Field label="유형">
          <select value={form.achievement_type}
            onChange={(e) => upd('achievement_type', e.target.value)} style={C.input}>
            {TYPES.map(t => <option key={t} value={t}>{ACHIEVEMENT_TYPE_LABELS[t]}</option>)}
          </select>
        </Field>
        <Field label="달성일">
          <input type="date" value={form.achieved_at}
            onChange={(e) => upd('achieved_at', e.target.value)} style={C.input} />
        </Field>
      </div>

      <Field label="상세">
        <textarea rows={3} value={form.detail}
          onChange={(e) => upd('detail', e.target.value)} style={C.textarea} />
      </Field>

      <Field label="지표명">
        <input type="text" value={form.metric_label}
          onChange={(e) => upd('metric_label', e.target.value)}
          placeholder="예: 불량률" style={C.input} />
      </Field>

      <div style={{ display: 'flex', gap: 8 }}>
        <Field label="Before">
          <input type="text" value={form.metric_before}
            onChange={(e) => upd('metric_before', e.target.value)}
            placeholder="예: 3.2%" style={C.input} />
        </Field>
        <Field label="After">
          <input type="text" value={form.metric_after}
            onChange={(e) => upd('metric_after', e.target.value)}
            placeholder="예: 1.1%" style={C.input} />
        </Field>
      </div>

      <label style={S.checkLine}>
        <input type="checkbox" checked={form.is_public}
          onChange={(e) => upd('is_public', e.target.checked)} />
        <span>포트폴리오에 공개</span>
      </label>

      {error && <div style={C.errorBox}>{error}</div>}

      <div style={S.actionBar}>
        <button type="button" onClick={onCancel} style={C.secondaryBtn}>취소</button>
        <button type="submit" disabled={submitting} style={{ ...C.primaryBtn, flex: 2 }}>
          {submitting ? '저장 중…' : (editing ? '저장' : '추가')}
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ ...C.field, flex: 1 }}>
      <span style={C.fieldLabel}>{label}</span>
      {children}
    </label>
  );
}

const S = {
  checkLine: {
    display: 'flex', alignItems: 'center', gap: 8,
    fontSize: 14, color: '#cbd5e1', minHeight: 36,
    cursor: 'pointer', padding: '4px 0', marginBottom: 8,
  },
  actionBar: { display: 'flex', gap: 8 },
};
