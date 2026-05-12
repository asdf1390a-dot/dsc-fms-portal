import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { C } from './careerStyles';

const EMPLOYMENT_TYPES = [
  { value: 'full_time',  label: '정규' },
  { value: 'part_time',  label: '파트' },
  { value: 'contract',   label: '계약' },
  { value: 'internship', label: '인턴' },
  { value: 'freelance',  label: '프리' },
];

export default function CompanyForm({ initial, onClose, onSaved }) {
  const editing = !!initial?.id;
  const [form, setForm] = useState({
    name:            initial?.name || '',
    country:         initial?.country || 'India',
    city:            initial?.city || '',
    industry:        initial?.industry || '',
    department:      initial?.department || '',
    title:           initial?.title || '',
    employment_type: initial?.employment_type || 'full_time',
    start_date:      initial?.start_date || '',
    end_date:        initial?.end_date || '',
    is_current:      !!initial?.is_current,
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
    if (!form.name.trim())       { setError('회사명은 필수입니다'); return; }
    if (!form.start_date)        { setError('입사일은 필수입니다'); return; }
    setSubmitting(true); setError(null);

    try {
      const token = await getToken();
      if (!token) { setError('로그인이 필요합니다'); setSubmitting(false); return; }
      const payload = {
        name:            form.name.trim(),
        country:         form.country || 'India',
        city:            form.city.trim() || null,
        industry:        form.industry.trim() || null,
        department:      form.department.trim() || null,
        title:           form.title.trim() || null,
        employment_type: form.employment_type,
        start_date:      form.start_date,
        end_date:        form.is_current ? null : (form.end_date || null),
        is_current:      !!form.is_current,
      };
      const url    = editing ? `/api/career/companies/${initial.id}` : '/api/career/companies';
      const method = editing ? 'PATCH' : 'POST';
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(json.error || `HTTP ${r.status}`);
      onSaved?.(json.company);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={S.backdrop} onClick={onClose}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()}>
        <div style={S.header}>
          <div style={S.title}>{editing ? '회사 편집' : '회사 추가'}</div>
          <button type="button" onClick={onClose} style={S.closeBtn} aria-label="Close">×</button>
        </div>

        <form onSubmit={onSave} style={S.form}>
          <Field label="회사명 *">
            <input type="text" value={form.name} onChange={(e) => upd('name', e.target.value)}
              required style={C.input} />
          </Field>

          <Row>
            <Field label="국가">
              <input type="text" value={form.country} onChange={(e) => upd('country', e.target.value)}
                style={C.input} />
            </Field>
            <Field label="도시">
              <input type="text" value={form.city} onChange={(e) => upd('city', e.target.value)}
                style={C.input} />
            </Field>
          </Row>

          <Field label="업종">
            <input type="text" value={form.industry} onChange={(e) => upd('industry', e.target.value)}
              placeholder="예: 자동차 부품" style={C.input} />
          </Field>

          <Row>
            <Field label="부서">
              <input type="text" value={form.department} onChange={(e) => upd('department', e.target.value)}
                style={C.input} />
            </Field>
            <Field label="직책">
              <input type="text" value={form.title} onChange={(e) => upd('title', e.target.value)}
                style={C.input} />
            </Field>
          </Row>

          <Field label="고용 형태">
            <div style={S.segGroup}>
              {EMPLOYMENT_TYPES.map(t => {
                const active = form.employment_type === t.value;
                return (
                  <button key={t.value} type="button"
                    onClick={() => upd('employment_type', t.value)}
                    style={{ ...S.segBtn, ...(active ? S.segBtnActive : null) }}>
                    {t.label}
                  </button>
                );
              })}
            </div>
          </Field>

          <Row>
            <Field label="입사일 *">
              <input type="date" value={form.start_date}
                onChange={(e) => upd('start_date', e.target.value)} required style={C.input} />
            </Field>
            <Field label="퇴사일">
              <input type="date" value={form.end_date}
                onChange={(e) => upd('end_date', e.target.value)}
                disabled={form.is_current} style={C.input} />
            </Field>
          </Row>

          <label style={S.checkLine}>
            <input type="checkbox" checked={form.is_current}
              onChange={(e) => upd('is_current', e.target.checked)} />
            <span>현재 재직중</span>
          </label>

          {error && <div style={C.errorBox}>{error}</div>}

          <div style={S.actionBar}>
            <button type="button" onClick={onClose} style={C.secondaryBtn}>취소</button>
            <button type="submit" disabled={submitting} style={{ ...C.primaryBtn, flex: 2 }}>
              {submitting ? '저장 중…' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
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

function Row({ children }) {
  return <div style={{ display: 'flex', gap: 8 }}>{children}</div>;
}

const S = {
  backdrop: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
    zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    padding: 0,
  },
  modal: {
    width: '100%', maxWidth: 480, maxHeight: '92vh',
    background: '#0f172a', border: '1px solid #1f2937',
    borderRadius: '16px 16px 0 0',
    display: 'flex', flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    padding: '14px 16px', borderBottom: '1px solid #1f2937',
    display: 'flex', alignItems: 'center', gap: 8,
  },
  title:    { flex: 1, fontSize: 16, fontWeight: 700, color: '#f8fafc' },
  closeBtn: {
    background: '#1e293b', color: '#cbd5e1', border: '1px solid #334155',
    width: 32, height: 32, borderRadius: 8, cursor: 'pointer',
    fontSize: 20, lineHeight: '20px',
  },
  form: { padding: 14, overflowY: 'auto', flex: 1 },
  segGroup: { display: 'flex', gap: 4 },
  segBtn: {
    flex: 1, padding: '10px 4px',
    background: '#0f172a', color: '#94a3b8',
    border: '1px solid #334155', borderRadius: 8,
    fontSize: 12, fontWeight: 600, cursor: 'pointer', minHeight: 40,
  },
  segBtnActive: { background: '#ef4444', color: '#fff', borderColor: '#ef4444' },
  checkLine: {
    display: 'flex', alignItems: 'center', gap: 8,
    fontSize: 14, color: '#cbd5e1', margin: '4px 0 12px',
    cursor: 'pointer', minHeight: 36,
  },
  actionBar: { display: 'flex', gap: 8, marginTop: 8 },
};
