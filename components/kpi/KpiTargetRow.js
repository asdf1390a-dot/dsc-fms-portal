// KpiTargetRow — 1 row of monthly target
export default function KpiTargetRow({ item, value, onChange }) {
  return (
    <div style={S.row}>
      <div style={S.head}>
        <span style={S.label}>{item.label}</span>
        <span style={S.unit}>{item.unit}</span>
      </div>
      <input
        type="number"
        inputMode="decimal"
        step="any"
        placeholder="목표값"
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        style={S.input}
      />
    </div>
  );
}

const S = {
  row:   { background: '#1e293b', border: '1px solid #1f2937', borderRadius: 10, padding: 12, marginBottom: 10 },
  head:  { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 },
  label: { fontSize: 13, fontWeight: 700, color: '#f1f5f9' },
  unit:  { fontSize: 11, color: '#64748b', fontFamily: 'ui-monospace,Menlo,Consolas,monospace' },
  input: { width: '100%', height: 44, padding: '0 12px', fontSize: 16, background: '#0f172a', color: '#f1f5f9', border: '1px solid #334155', borderRadius: 8, outline: 'none', boxSizing: 'border-box' },
};
