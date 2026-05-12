import PMComplianceBar from './PMComplianceBar';

// 설비별 PM 그룹 카드: 설비 정보 + 이행률 + 연체 표시
export default function AssetPMGroup({ asset }) {
  if (!asset) return null;
  const {
    asset_number, asset_name, location,
    done = 0, total = 0, overdue = 0,
  } = asset;

  return (
    <div style={S.card}>
      <div style={S.head}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={S.code}>{asset_number || '—'}</div>
          <div style={S.name}>{asset_name || '—'}</div>
          {location && <div style={S.loc}>📍 {location}</div>}
        </div>
        {overdue > 0 && (
          <span style={S.overdueBadge}>연체 {overdue}</span>
        )}
      </div>
      <div style={{ marginTop: 8 }}>
        <PMComplianceBar done={done} total={total} />
      </div>
    </div>
  );
}

const S = {
  card: { background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: 14, marginBottom: 10 },
  head: { display: 'flex', alignItems: 'flex-start', gap: 10 },
  code: { fontSize: 12, color: '#94a3b8', fontFamily: 'ui-monospace,Menlo,monospace' },
  name: { fontSize: 15, fontWeight: 700, color: '#f1f5f9', marginTop: 2 },
  loc: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  overdueBadge: {
    fontSize: 11, fontWeight: 700, padding: '4px 8px', borderRadius: 999,
    background: 'rgba(239,68,68,0.15)', color: '#fca5a5',
    border: '1px solid rgba(239,68,68,0.5)', whiteSpace: 'nowrap',
  },
};
