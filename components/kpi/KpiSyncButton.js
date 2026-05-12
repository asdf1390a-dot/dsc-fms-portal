// KpiSyncButton — POST /api/kpi/sync with month
import { useState } from 'react';
import { supabase } from '../../lib/supabase';

export default function KpiSyncButton({ month, onSynced }) {
  const [state, setState] = useState('idle'); // idle | loading | ok | err
  const [msg, setMsg] = useState('');

  async function handleClick() {
    setState('loading');
    setMsg('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('not_authenticated');
      const r = await fetch('/api/kpi/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ target_month: month }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setState('ok');
      setMsg('동기화 완료');
      if (onSynced) onSynced(j);
      setTimeout(() => setState('idle'), 2000);
    } catch (e) {
      setState('err');
      setMsg(e.message || '동기화 실패');
    }
  }

  const bg =
    state === 'ok'  ? '#16a34a'
  : state === 'err' ? '#dc2626'
  : state === 'loading' ? '#475569'
  : '#1e293b';

  return (
    <div style={S.wrap}>
      <button onClick={handleClick} disabled={state === 'loading'} style={{ ...S.btn, background: bg }}>
        {state === 'loading' ? '동기화 중…' : state === 'ok' ? '✓ 동기화' : '🔄 BM 동기화'}
      </button>
      {msg && state === 'err' && <span style={S.err}>{msg}</span>}
    </div>
  );
}

const S = {
  wrap: { display: 'flex', alignItems: 'center', gap: 8 },
  btn:  { height: 36, padding: '0 14px', borderRadius: 8, border: '1px solid #334155', color: '#f1f5f9', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  err:  { fontSize: 11, color: '#fca5a5' },
};
