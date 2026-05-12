import { useState } from 'react';

export default function VendorForm({ initial = {}, onSubmit, onCancel, busy }) {
  const [name, setName] = useState(initial.name || '');
  const [nameShort, setNameShort] = useState(initial.name_short || '');
  const [country, setCountry] = useState(initial.country || 'India');
  const [city, setCity] = useState(initial.city || '');
  const [contactName, setContactName] = useState(initial.contact_name || '');
  const [contactPhone, setContactPhone] = useState(initial.contact_phone || '');
  const [contactEmail, setContactEmail] = useState(initial.contact_email || '');
  const [leadTime, setLeadTime] = useState(initial.lead_time_days != null ? String(initial.lead_time_days) : '');
  const [paymentTerms, setPaymentTerms] = useState(initial.payment_terms || '');
  const [currency, setCurrency] = useState(initial.currency || 'INR');
  const [notes, setNotes] = useState(initial.notes || '');
  const [isActive, setIsActive] = useState(initial.is_active !== false);

  function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      name_short: nameShort.trim() || null,
      country: country.trim() || 'India',
      city: city.trim() || null,
      contact_name: contactName.trim() || null,
      contact_phone: contactPhone.trim() || null,
      contact_email: contactEmail.trim() || null,
      lead_time_days: leadTime || null,
      payment_terms: paymentTerms.trim() || null,
      currency,
      notes: notes.trim() || null,
      is_active: isActive,
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <Field label="업체명 *"><input style={S.input} value={name} onChange={e=>setName(e.target.value)} required /></Field>
      <Field label="단축명"><input style={S.input} value={nameShort} onChange={e=>setNameShort(e.target.value)} placeholder="예: SKF" /></Field>
      <div style={S.grid2}>
        <Field label="국가"><input style={S.input} value={country} onChange={e=>setCountry(e.target.value)} /></Field>
        <Field label="도시"><input style={S.input} value={city} onChange={e=>setCity(e.target.value)} placeholder="Chennai" /></Field>
      </div>
      <Field label="담당자"><input style={S.input} value={contactName} onChange={e=>setContactName(e.target.value)} /></Field>
      <div style={S.grid2}>
        <Field label="전화"><input style={S.input} value={contactPhone} onChange={e=>setContactPhone(e.target.value)} /></Field>
        <Field label="이메일"><input style={S.input} type="email" value={contactEmail} onChange={e=>setContactEmail(e.target.value)} /></Field>
      </div>
      <div style={S.grid2}>
        <Field label="납기 (일)"><input style={S.input} type="number" min="0" value={leadTime} onChange={e=>setLeadTime(e.target.value)} placeholder="7" /></Field>
        <Field label="통화">
          <select style={S.input} value={currency} onChange={e=>setCurrency(e.target.value)}>
            <option value="INR">INR</option>
            <option value="KRW">KRW</option>
            <option value="USD">USD</option>
          </select>
        </Field>
      </div>
      <Field label="결제 조건"><input style={S.input} value={paymentTerms} onChange={e=>setPaymentTerms(e.target.value)} placeholder="30일 후불" /></Field>
      <Field label="비고"><textarea style={{...S.input, height: 80, fontFamily:'inherit', resize:'vertical'}} value={notes} onChange={e=>setNotes(e.target.value)} /></Field>
      <Field label="활성 상태">
        <label style={S.toggle}>
          <input type="checkbox" checked={isActive} onChange={e=>setIsActive(e.target.checked)} style={{marginRight: 8}} />
          {isActive ? '활성' : '비활성'}
        </label>
      </Field>
      <div style={S.actions}>
        <button type="button" onClick={onCancel} style={S.btnSecondary} disabled={busy}>취소</button>
        <button type="submit" style={busy ? S.btnDisabled : S.btnPrimary} disabled={busy || !name.trim()}>
          {busy ? '저장 중…' : '저장'}
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ padding: '12px 16px 4px' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      {children}
    </div>
  );
}

const S = {
  input: { width: '100%', padding: '12px 14px', border: '1px solid #334155', borderRadius: 10, fontSize: 16, outline: 'none', boxSizing: 'border-box', background: '#0b1220', color: '#f1f5f9', minHeight: 48 },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  toggle: { display: 'flex', alignItems: 'center', fontSize: 14, color: '#e2e8f0', cursor: 'pointer', padding: '12px 0' },
  actions: { display: 'flex', gap: 10, padding: '16px' },
  btnPrimary: { flex: 1, padding: 16, borderRadius: 12, border: 'none', fontSize: 16, fontWeight: 800, cursor: 'pointer', minHeight: 56, background: '#2563eb', color: '#fff', boxShadow: '0 4px 12px rgba(37,99,235,0.4)' },
  btnSecondary: { flex: 1, padding: 16, borderRadius: 12, border: 'none', fontSize: 16, fontWeight: 700, cursor: 'pointer', minHeight: 56, background: '#334155', color: '#e2e8f0' },
  btnDisabled: { flex: 1, padding: 16, borderRadius: 12, border: 'none', fontSize: 16, fontWeight: 800, cursor: 'not-allowed', minHeight: 56, background: '#1f2937', color: '#475569' },
};
