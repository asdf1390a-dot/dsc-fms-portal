import { useState } from 'react';
import { supabase } from '../../lib/supabase';

// PATCH the given endpoint with { is_public } and reflect.
// props: endpoint (e.g. /api/career/companies/abc), value (bool), onChanged(newValue)
export default function PublicToggle({ endpoint, value, onChanged, label = '공개' }) {
  const [busy, setBusy] = useState(false);
  const [v, setV] = useState(!!value);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    const next = !v;
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      const r = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ is_public: next }),
      });
      if (!r.ok) throw new Error('patch failed');
      setV(next);
      onChanged?.(next);
    } catch (e) {
      // revert
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={toggle} disabled={busy} style={{
      ...S.btn,
      background: v ? 'rgba(34,197,94,0.2)' : '#0f172a',
      color:      v ? '#86efac' : '#94a3b8',
      borderColor: v ? 'rgba(34,197,94,0.4)' : '#334155',
    }}>
      <span style={S.dot(v)} />
      {label} {v ? 'ON' : 'OFF'}
    </button>
  );
}

const S = {
  btn: {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    padding: '8px 12px', border: '1px solid #334155', borderRadius: 8,
    fontSize: 13, fontWeight: 600, cursor: 'pointer', minHeight: 40,
  },
  dot: (on) => ({
    width: 8, height: 8, borderRadius: '50%',
    background: on ? '#22c55e' : '#64748b',
  }),
};
