// components/bm/BMFilterPanel.js
// 날짜 범위 + 설비 필터 패널 — bm/index.js 토글 UI 용

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

function todayISO()      { return new Date().toISOString().slice(0, 10); }
function firstOfMonth()  { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); }
function lastMonthStart(){ const d = new Date(); d.setMonth(d.getMonth() - 1); d.setDate(1); return d.toISOString().slice(0, 10); }
function lastMonthEnd()  { const d = new Date(); d.setDate(0); return d.toISOString().slice(0, 10); }

export default function BMFilterPanel({
  open,
  startDate, endDate, assetId,
  onApply, onClear,
}) {
  const [sd, setSd] = useState(startDate || '');
  const [ed, setEd] = useState(endDate || '');
  const [aid, setAid] = useState(assetId || '');
  const [assets, setAssets] = useState([]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('assets')
        .select('id, machine_asset_number, name_en')
        .order('machine_asset_number', { ascending: true })
        .limit(2000);
      if (cancelled) return;
      setAssets(data || []);
    })();
    return () => { cancelled = true; };
  }, [open]);

  useEffect(() => {
    setSd(startDate || ''); setEd(endDate || ''); setAid(assetId || '');
  }, [startDate, endDate, assetId, open]);

  if (!open) return null;

  function preset(kind) {
    if (kind === 'this_month') { setSd(firstOfMonth()); setEd(todayISO()); }
    else if (kind === 'last_month') { setSd(lastMonthStart()); setEd(lastMonthEnd()); }
    else if (kind === 'last_3m') {
      const d = new Date(); d.setMonth(d.getMonth() - 3);
      setSd(d.toISOString().slice(0, 10)); setEd(todayISO());
    }
  }

  return (
    <div style={S.panel}>
      <div style={S.row}>
        <span style={S.label}>기간 / Period</span>
        <div style={S.presets}>
          <button type="button" style={S.presetBtn} onClick={() => preset('this_month')}>이번 달</button>
          <button type="button" style={S.presetBtn} onClick={() => preset('last_month')}>지난 달</button>
          <button type="button" style={S.presetBtn} onClick={() => preset('last_3m')}>최근 3개월</button>
        </div>
      </div>

      <div style={S.dateRow}>
        <input type="date" value={sd} onChange={(e) => setSd(e.target.value)} style={S.input} />
        <span style={{ color: '#64748b' }}>~</span>
        <input type="date" value={ed} onChange={(e) => setEd(e.target.value)} style={S.input} />
      </div>

      <div style={S.row}>
        <span style={S.label}>설비 / Asset</span>
      </div>
      <select value={aid} onChange={(e) => setAid(e.target.value)} style={S.input}>
        <option value="">전체</option>
        {assets.map(a => (
          <option key={a.id} value={a.id}>
            {a.machine_asset_number}{a.name_en ? ` · ${a.name_en}` : ''}
          </option>
        ))}
      </select>

      <div style={S.btnRow}>
        <button
          type="button"
          style={{ ...S.btn, ...S.btnGhost }}
          onClick={() => { setSd(''); setEd(''); setAid(''); onClear && onClear(); }}
        >초기화</button>
        <button
          type="button"
          style={{ ...S.btn, ...S.btnPrimary }}
          onClick={() => onApply({ startDate: sd, endDate: ed, assetId: aid })}
        >적용</button>
      </div>
    </div>
  );
}

const S = {
  panel: {
    background: '#1e293b', border: '1px solid #1f2937',
    borderRadius: 12, padding: 14, margin: '0 14px 12px',
    display: 'flex', flexDirection: 'column', gap: 10,
  },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  label: { fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: 0.5, textTransform: 'uppercase' },
  presets: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  presetBtn: {
    padding: '6px 10px', minHeight: 32,
    border: '1px solid #334155', background: '#0f172a', color: '#cbd5e1',
    borderRadius: 6, fontSize: 12, cursor: 'pointer',
  },
  dateRow: { display: 'flex', alignItems: 'center', gap: 8 },
  input: {
    flex: 1, padding: '10px 12px',
    border: '1px solid #334155', borderRadius: 8,
    fontSize: 16, outline: 'none', boxSizing: 'border-box',
    background: '#0b1220', color: '#f1f5f9',
    fontFamily: 'inherit', minHeight: 44, width: '100%',
  },
  btnRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 },
  btn: { padding: '12px', borderRadius: 8, border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer', minHeight: 44 },
  btnGhost: { background: '#334155', color: '#e2e8f0', border: '1px solid #475569' },
  btnPrimary: { background: '#2563eb', color: '#fff' },
};
