import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

export default function KpiTrendChartInner({ data, unit }) {
  const lineColor = '#ef4444';
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 16, right: 16, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis dataKey="month_label" tick={{ fill: '#64748b', fontSize: 11 }} />
        <YAxis tick={{ fill: '#64748b', fontSize: 11 }} unit={unit === '%' ? '%' : ''} />
        <Tooltip
          contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: '#f1f5f9' }}
          itemStyle={{ color: '#e2e8f0' }}
        />
        <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
        <Line type="monotone" dataKey="target" stroke="#64748b" strokeDasharray="4 4"
              dot={false} strokeWidth={1.5} name="목표" connectNulls />
        <Line type="monotone" dataKey="actual" stroke={lineColor} strokeWidth={2.5}
              dot={{ fill: lineColor, r: 4 }} name="실적" connectNulls />
      </LineChart>
    </ResponsiveContainer>
  );
}
