import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const STATUSES = ['active', 'idle', 'maintenance', 'sold', 'scrapped'];

export default function AssetForm({ initial, onSave, onCancel, mode }) {
  const [classes, setClasses] = useState([]);
  const [form, setForm] = useState({
    asset_class_code: '',
    machine_asset_code: '',
    machine_asset_number: '',
    serial_no: '',
    name_en: '',
    name_ta: '',
    model: '',
    make: '',
    year_of_manufacture: '',
    location: '',
    status: 'active',
    remark: '',
    extra: {},
    ...(initial || {}),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    supabase.from('asset_classes')
      .select('code, category_code, name_en')
      .order('code')
      .then(({ data }) => setClasses(data || []));
  }, []);

  function set(key, val) {
    setForm(f => ({ ...f, [key]: val }));
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload = {
        ...form,
        year_of_manufacture: form.year_of_manufacture ? parseInt(form.year_of_manufacture, 10) : null,
        serial_no: form.serial_no || null,
        name_ta: form.name_ta || null,
        model: form.model || null,
        make: form.make || null,
        location: form.location || null,
        remark: form.remark || null,
        extra: form.extra || {},
      };
      // Remove fields that DB sets
      delete payload.id;
      delete payload.created_at;
      delete payload.updated_at;
      delete payload.created_by;
      delete payload.updated_by;
      delete payload.qr_payload;
      delete payload.photos;

      await onSave(payload);
    } catch (err) {
      setError(err.message || String(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={S.form}>
      <Section title="Identity">
        <Field label="Asset Tag (Number) *" required>
          <input style={S.input} value={form.machine_asset_number}
            onChange={e => set('machine_asset_number', e.target.value)}
            placeholder="DCMI-UTL-PSF-99" required />
        </Field>
        <Field label="Asset Code">
          <input style={S.input} value={form.machine_asset_code}
            onChange={e => set('machine_asset_code', e.target.value)}
            placeholder="01.001.999" />
        </Field>
        <Field label="Asset Class *" required>
          <select style={S.input} value={form.asset_class_code}
            onChange={e => set('asset_class_code', e.target.value)} required>
            <option value="">— select —</option>
            {classes.map(c => (
              <option key={c.code} value={c.code}>
                {c.code} · {c.name_en}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Serial No">
          <input style={S.input} value={form.serial_no}
            onChange={e => set('serial_no', e.target.value)} />
        </Field>
      </Section>

      <Section title="Name">
        <Field label="Name (English) *" required>
          <input style={S.input} value={form.name_en}
            onChange={e => set('name_en', e.target.value)} required />
        </Field>
        <Field label="Name (Tamil)">
          <input style={S.input} value={form.name_ta}
            onChange={e => set('name_ta', e.target.value)}
            placeholder="(optional)" />
        </Field>
      </Section>

      <Section title="Specs">
        <Field label="Model">
          <input style={S.input} value={form.model}
            onChange={e => set('model', e.target.value)} />
        </Field>
        <Field label="Make">
          <input style={S.input} value={form.make}
            onChange={e => set('make', e.target.value)} />
        </Field>
        <Field label="Year">
          <input style={S.input} type="number" value={form.year_of_manufacture}
            onChange={e => set('year_of_manufacture', e.target.value)}
            placeholder="2024" min="1980" max="2030" />
        </Field>
      </Section>

      <Section title="Status & Location">
        <Field label="Status *" required>
          <select style={S.input} value={form.status}
            onChange={e => set('status', e.target.value)} required>
            {STATUSES.map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
          </select>
        </Field>
        <Field label="Location">
          <input style={S.input} value={form.location}
            onChange={e => set('location', e.target.value)}
            placeholder="e.g. Plant 1 - Bay 3" />
        </Field>
      </Section>

      <Section title="Remark">
        <textarea style={{ ...S.input, height: 80, resize: 'vertical', fontFamily: 'inherit' }}
          value={form.remark}
          onChange={e => set('remark', e.target.value)}
          placeholder="Any notes…" />
      </Section>

      {error && <div style={S.error}>{error}</div>}

      <div style={S.actions}>
        <button type="button" onClick={onCancel} style={{ ...S.btn, ...S.btnSecondary }}>
          Cancel
        </button>
        <button type="submit" disabled={busy} style={{
          ...S.btn, ...S.btnPrimary, ...(busy ? S.btnDisabled : null),
        }}>
          {busy ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'Create asset'}
        </button>
      </div>
    </form>
  );
}

function Section({ title, children }) {
  return (
    <section style={S.section}>
      <div style={S.sectionTitle}>{title}</div>
      <div style={S.sectionBody}>{children}</div>
    </section>
  );
}

function Field({ label, required, children }) {
  return (
    <div style={S.field}>
      <label style={S.label}>{label}{required && <span style={S.required}> *</span>}</label>
      {children}
    </div>
  );
}

const S = {
  form: { padding: 16 },
  section: {
    background: '#fff', borderRadius: 12, marginBottom: 12,
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden',
  },
  sectionTitle: {
    padding: '10px 14px', fontSize: 12, fontWeight: 600,
    color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5,
    background: '#f8fafc', borderBottom: '1px solid #e2e8f0',
  },
  sectionBody: { padding: 14 },
  field: { marginBottom: 14 },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 },
  required: { color: '#dc2626' },
  input: {
    width: '100%', padding: '11px 12px',
    border: '1px solid #cbd5e1', borderRadius: 8,
    fontSize: 16, outline: 'none', boxSizing: 'border-box',
    background: '#f8fafc',
  },
  error: {
    background: '#fee2e2', color: '#991b1b',
    padding: 12, borderRadius: 8, fontSize: 13, marginBottom: 12,
  },
  actions: { display: 'flex', gap: 10, marginTop: 8 },
  btn: {
    flex: 1, padding: '13px 20px', borderRadius: 10, border: 'none',
    fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
  btnPrimary: { background: '#0f172a', color: '#fff' },
  btnSecondary: { background: '#e2e8f0', color: '#0f172a' },
  btnDisabled: { background: '#cbd5e1', color: '#64748b', cursor: 'not-allowed' },
};
