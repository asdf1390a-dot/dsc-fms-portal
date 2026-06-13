// 6개월 KPI 추이 차트 (recharts LineChart)
import React from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts';

export default function MonthlyTrendChart({ series, dataKey, label, color = '#3b82f6' }) {
  if (!series?.length) {
    return <div style={S.empty}>추이 데이터가 부족합니다.</div>;
  }
  const data = series.map((s) => ({
    name: `${String(s.year).slice(2)}/${String(s.month).padStart(2, '0')}`,
    value: s[dataKey],
  }));
  return (
    <div style={S.box}>
      <div style={S.title}>{label}</div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
          <YAxis stroke="#94a3b8" fontSize={11} />
          <Tooltip
            contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: '#cbd5e1' }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="value" name={label} stroke={color} strokeWidth={2}
                dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

const S = {
  box: { background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: 12 },
  title: { fontSize: 13, fontWeight: 700, color: '#cbd5e1', marginBottom: 6 },
  empty: { padding: 16, textAlign: 'center', color: '#64748b',
           background: '#1e293b', border: '1px solid #334155', borderRadius: 12 },
};
