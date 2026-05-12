// KpiInputRow — 1 row of actual input
// props: { item, value, note, onChangeValue, onChangeNote }
export default function KpiInputRow({ item, value, note, onChangeValue, onChangeNote }) {
  return (
    <div style={S.row}>
      <div style={S.head}>
        <span style={S.label}>{item.label}</span>
        <span style={S.unit}>{item.unit}</span>
        {item.is_auto && <span style={S.autoBadge}>🔄 자동</span>}
      </div>
      <div style={S.metaRow}>
        <span style={S.meta}>목표: {item.target_value != null ? `${item.target_value} ${item.unit}` : '미설정'}</span>
      </div>
      <div style={S.inputs}>
        <input
          type="number"
          inputMode="decimal"
          step="any"
          placeholder="실적값"
          value={value ?? ''}
          onChange={e => onChangeValue(e.target.value)}
          style={S.input}
        />
        <input
          type="text"
          placeholder="비고 (선택)"
          value={note ?? ''}
          onChange={e => onChangeNote(e.target.value)}
          style={S.input}
        />
      </div>
    </div>
  );
}

const S = {
  row:   { background: '#1e293b', border: '1px solid #1f2937', borderRadius: 10, padding: 12, marginBottom: 10 },
  head:  { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 },
  label: { fontSize: 13, fontWeight: 700, color: '#f1f5f9' },
  unit:  { fontSize: 11, color: '#64748b', fontFamily: 'ui-monospace,Menlo,Consolas,monospace' },
  autoBadge: { marginLeft: 'auto', fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 999, background: 'rgba(59,130,246,0.18)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.4)' },
  metaRow: { marginBottom: 8 },
  meta:    { fontSize: 11, color: '#94a3b8' },
  inputs:  { display: 'grid', gridTemplateColumns: '1fr', gap: 8 },
  input:   { width: '100%', height: 44, padding: '0 12px', fontSize: 16, background: '#0f172a', color: '#f1f5f9', border: '1px solid #334155', borderRadius: 8, outline: 'none', boxSizing: 'border-box' },
};
