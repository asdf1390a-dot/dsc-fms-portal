import { useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';
import { C, CATEGORY_LABELS, ymToDate, dateToYm } from './careerStyles';

const CATEGORIES = ['improvement','cost_reduction','quality','safety','digital','automation','other'];

export default function ProjectForm({ companyId, initial, onSaved }) {
  const router = useRouter();
  const editing = !!initial?.id;
  const [form, setForm] = useState({
    title:       initial?.title || '',
    category:    initial?.category || 'improvement',
    role:        initial?.role || '',
    start_ym:    dateToYm(initial?.start_date),
    end_ym:      dateToYm(initial?.end_date),
    is_ongoing:  !!initial?.is_ongoing,
    summary:     initial?.summary || '',
    description: initial?.description || '',
    kpi_label:   initial?.kpi_label || '',
    kpi_value:   initial?.kpi_value || '',
    kpi_detail:  initial?.kpi_detail || '',
    is_public:   !!initial?.is_public,
    is_featured: !!initial?.is_featured,
  });
  const [tags, setTags] = useState(initial?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  function upd(k, v) { setForm(p => ({ ...p, [k]: v })); }

  function addTag() {
    const t = tagInput.trim();
    if (!t) return;
    if (tags.includes(t)) { setTagInput(''); return; }
    setTags([...tags, t]);
    setTagInput('');
  }
  function removeTag(t) { setTags(tags.filter(x => x !== t)); }

  async function getToken() {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token;
  }

  async function onSave(e) {
    e.preventDefault();
    if (!form.title.trim()) { setError('프로젝트명은 필수입니다'); return; }
    setSubmitting(true); setError(null);
    try {
      const token = await getToken();
      if (!token) { setError('로그인이 필요합니다'); setSubmitting(false); return; }
      const payload = {
        company_id:  companyId,
        title:       form.title.trim(),
        category:    form.category,
        role:        form.role.trim() || null,
        start_date:  ymToDate(form.start_ym),
        end_date:    form.is_ongoing ? null : ymToDate(form.end_ym),
        is_ongoing:  !!form.is_ongoing,
        summary:     form.summary.trim() || null,
        description: form.description.trim() || null,
        tags,
        kpi_label:   form.kpi_label.trim() || null,
        kpi_value:   form.kpi_value.trim() || null,
        kpi_detail:  form.kpi_detail.trim() || null,
        is_public:   !!form.is_public,
        is_featured: !!form.is_featured,
      };
      const url    = editing ? `/api/career/projects/${initial.id}` : '/api/career/projects';
      const method = editing ? 'PATCH' : 'POST';
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(json.error || `HTTP ${r.status}`);
      onSaved?.(json.project);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function onDelete() {
    if (!editing) return;
    if (!confirm('정말 이 프로젝트를 삭제하시겠습니까?')) return;
    setSubmitting(true);
    try {
      const token = await getToken();
      const r = await fetch(`/api/career/projects/${initial.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok && r.status !== 204) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${r.status}`);
      }
      router.replace(`/career/${companyId}`);
    } catch (err) {
      setError(err.message || String(err));
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSave} style={{ padding: 0 }}>
      <section style={C.card}>
        <Field label="프로젝트명 *">
          <input type="text" value={form.title} onChange={(e) => upd('title', e.target.value)}
            required style={C.input} />
        </Field>

        <Field label="분류">
          <select value={form.category} onChange={(e) => upd('category', e.target.value)} style={C.input}>
            {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
          </select>
        </Field>

        <Field label="역할">
          <input type="text" value={form.role} onChange={(e) => upd('role', e.target.value)}
            placeholder="예: 프로젝트 리더 / 엔지니어" style={C.input} />
        </Field>

        <div style={{ display: 'flex', gap: 8 }}>
          <Field label="시작 (YYYY-MM)">
            <input type="month" value={form.start_ym} onChange={(e) => upd('start_ym', e.target.value)}
              style={C.input} />
          </Field>
          <Field label="종료 (YYYY-MM)">
            <input type="month" value={form.end_ym} onChange={(e) => upd('end_ym', e.target.value)}
              disabled={form.is_ongoing} style={C.input} />
          </Field>
        </div>

        <label style={S.checkLine}>
          <input type="checkbox" checked={form.is_ongoing}
            onChange={(e) => upd('is_ongoing', e.target.checked)} />
          <span>진행중</span>
        </label>
      </section>

      <section style={C.card}>
        <Field label="요약 (한 줄)">
          <input type="text" value={form.summary} onChange={(e) => upd('summary', e.target.value)}
            placeholder="예: 다이캐스팅 사이클타임 12% 단축" style={C.input} />
        </Field>

        <Field label="상세 설명">
          <textarea rows={5} value={form.description}
            onChange={(e) => upd('description', e.target.value)} style={C.textarea} />
        </Field>

        <Field label="태그 (Enter로 추가)">
          <div style={S.tagBar}>
            {tags.map(t => (
              <span key={t} style={S.tagChip}>
                #{t}
                <button type="button" onClick={() => removeTag(t)} style={S.tagDel}>×</button>
              </span>
            ))}
          </div>
          <input type="text" value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
            placeholder="태그 입력 후 Enter" style={C.input} />
        </Field>
      </section>

      <section style={C.card}>
        <div style={S.sectionTitle}>KPI / 성과 지표</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Field label="지표명">
            <input type="text" value={form.kpi_label} onChange={(e) => upd('kpi_label', e.target.value)}
              placeholder="예: 사이클타임" style={C.input} />
          </Field>
          <Field label="값">
            <input type="text" value={form.kpi_value} onChange={(e) => upd('kpi_value', e.target.value)}
              placeholder="예: -12%" style={C.input} />
          </Field>
        </div>
        <Field label="상세">
          <input type="text" value={form.kpi_detail} onChange={(e) => upd('kpi_detail', e.target.value)}
            placeholder="예: 45초 → 39.6초" style={C.input} />
        </Field>
      </section>

      <section style={C.card}>
        <label style={S.checkLine}>
          <input type="checkbox" checked={form.is_public}
            onChange={(e) => upd('is_public', e.target.checked)} />
          <span>포트폴리오에 공개</span>
        </label>
        <label style={S.checkLine}>
          <input type="checkbox" checked={form.is_featured}
            onChange={(e) => upd('is_featured', e.target.checked)} />
          <span>대표 프로젝트 (★)</span>
        </label>
      </section>

      {error && <div style={C.errorBox}>{error}</div>}

      <div style={S.actionBar}>
        <button type="button" onClick={() => router.push(`/career/${companyId}`)} style={C.secondaryBtn}>
          취소
        </button>
        <button type="submit" disabled={submitting} style={{ ...C.primaryBtn, flex: 2 }}>
          {submitting ? '저장 중…' : (editing ? '저장' : '추가')}
        </button>
      </div>

      {editing && (
        <button type="button" onClick={onDelete} disabled={submitting}
          style={{ ...C.dangerBtn, marginTop: 12 }}>
          삭제
        </button>
      )}
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
  sectionTitle: { fontSize: 13, fontWeight: 700, color: '#f8fafc', marginBottom: 10 },
  checkLine: {
    display: 'flex', alignItems: 'center', gap: 8,
    fontSize: 14, color: '#cbd5e1', minHeight: 36,
    cursor: 'pointer', padding: '4px 0',
  },
  tagBar: { display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 },
  tagChip: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    background: '#0f172a', color: '#cbd5e1', border: '1px solid #334155',
    padding: '4px 8px', borderRadius: 6, fontSize: 12,
  },
  tagDel: {
    background: 'transparent', color: '#94a3b8', border: 'none',
    fontSize: 14, cursor: 'pointer', lineHeight: 1,
  },
  actionBar: { display: 'flex', gap: 8, marginTop: 8 },
};
