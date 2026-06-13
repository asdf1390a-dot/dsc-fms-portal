// 감사 로그 테이블 (간이)
import React from 'react';

export default function AccessLogTable({ items }) {
  if (!items?.length) return <div style={S.empty}>감사 로그가 없습니다.</div>;
  return (
    <div style={S.box}>
      <div style={S.title}>접근 기록</div>
      <div style={S.scroll}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>시각</th>
              <th style={S.th}>사용자</th>
              <th style={S.th}>동작</th>
              <th style={S.th}>IP</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id}>
                <td style={S.td}>{fmtTime(r.created_at)}</td>
                <td style={S.td}>{r.user_email || '—'}</td>
                <td style={S.td}>{r.action}</td>
                <td style={S.td}>{r.ip_address || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function fmtTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const kst = new Date(d.getTime() + 9 * 3600 * 1000);
  return kst.toISOString().slice(0, 16).replace('T', ' ');
}

const S = {
  box: { background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: 12 },
  title: { fontSize: 13, fontWeight: 700, marginBottom: 8 },
  scroll: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th: { textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #334155', color: '#94a3b8', fontWeight: 600 },
  td: { padding: '6px 8px', borderBottom: '1px solid #1f2937', color: '#cbd5e1' },
  empty: { padding: 16, textAlign: 'center', color: '#64748b',
           background: '#1e293b', border: '1px solid #334155', borderRadius: 12 },
};
