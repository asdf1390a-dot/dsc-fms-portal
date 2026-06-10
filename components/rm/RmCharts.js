import { useMemo, useState } from 'react';
import {
  PieChart, Pie, Cell,
  BarChart, Bar,
  LineChart, Line,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend, ResponsiveContainer,
} from 'recharts';

// Color palette
// - Welding Coil (3.4) highlighted in bright amber
// - R&M (1.x) shades of blue
// - 부자재 (2.x/3.x) shades of green, except 3.4 highlight
const RM_BLUES = ['#38bdf8', '#0ea5e9', '#0284c7', '#0369a1', '#075985', '#1e40af', '#3b82f6'];
const SUB_GREENS = ['#34d399', '#10b981', '#059669', '#047857', '#065f46', '#22c55e'];
const HIGHLIGHT = '#fbbf24'; // welding coil

function fmtRs(n) {
  if (n == null || isNaN(n)) return '–';
  return 'Rs ' + Number(n).toLocaleString();
}
function fmtShort(n) {
  const v = Number(n) || 0;
  if (v >= 1e7) return (v / 1e7).toFixed(1) + 'Cr';
  if (v >= 1e5) return (v / 1e5).toFixed(1) + 'L';
  if (v >= 1e3) return (v / 1e3).toFixed(0) + 'K';
  return String(v);
}

function pieColorFor(row, idxInGroup) {
  if (row.category_code === '3.4') return HIGHLIGHT;
  if (row.category_group === 'R&M') return RM_BLUES[idxInGroup % RM_BLUES.length];
  if (row.category_group === '부자재') return SUB_GREENS[idxInGroup % SUB_GREENS.length];
  return '#94a3b8';
}

function amountForRow(row, monthFilter) {
  if (monthFilter === 0) {
    return ['jan_amount', 'feb_amount', 'mar_amount', 'apr_amount']
      .reduce((s, k) => s + Number(row[k] || 0), 0);
  }
  const keys = ['jan_amount','feb_amount','mar_amount','apr_amount','may_amount','jun_amount','jul_amount','aug_amount','sep_amount','oct_amount','nov_amount','dec_amount'];
  return Number(row[keys[monthFilter - 1]] || 0);
}

export default function RmCharts({ rows = [], monthFilter = 0, grandTotal = 0 }) {
  const [tab, setTab] = useState('pie'); // pie | bar | line

  // Pie: per-category share
  const pieData = useMemo(() => {
    // Maintain group ordering: R&M first, 부자재 second
    const rm = rows.filter(r => r.category_group === 'R&M');
    const su = rows.filter(r => r.category_group === '부자재');
    const ordered = [...rm, ...su, ...rows.filter(r => r.category_group !== 'R&M' && r.category_group !== '부자재')];

    let rmIdx = 0, suIdx = 0;
    return ordered.map(r => {
      const amt = amountForRow(r, monthFilter);
      const color = r.category_code === '3.4'
        ? HIGHLIGHT
        : r.category_group === 'R&M'
          ? RM_BLUES[(rmIdx++) % RM_BLUES.length]
          : r.category_group === '부자재'
            ? SUB_GREENS[(suIdx++) % SUB_GREENS.length]
            : '#94a3b8';
      return {
        code: r.category_code,
        name: r.category_name_ko || r.category_name,
        group: r.category_group,
        value: amt,
        color,
      };
    }).filter(d => d.value > 0);
  }, [rows, monthFilter]);

  // Bar: R&M vs 부자재 group totals
  const barData = useMemo(() => {
    const sumGroup = (g) => rows
      .filter(r => r.category_group === g)
      .reduce((s, r) => s + amountForRow(r, monthFilter), 0);
    return [
      { group: 'R&M (1.x)',         value: sumGroup('R&M'),   fill: '#38bdf8' },
      { group: '부자재 (2.x · 3.x)', value: sumGroup('부자재'), fill: '#34d399' },
    ];
  }, [rows, monthFilter]);

  // Line: monthly Jan-Apr, group totals
  const lineData = useMemo(() => {
    const monKeys = ['jan_amount','feb_amount','mar_amount','apr_amount'];
    const labels = ['Jan','Feb','Mar','Apr'];
    const rm = rows.filter(r => r.category_group === 'R&M');
    const su = rows.filter(r => r.category_group === '부자재');
    return labels.map((label, i) => ({
      month: label,
      'R&M': rm.reduce((s, r) => s + Number(r[monKeys[i]] || 0), 0),
      '부자재': su.reduce((s, r) => s + Number(r[monKeys[i]] || 0), 0),
    }));
  }, [rows]);

  const tabs = [
    { key: 'pie',  label: '원형 (카테고리 비중)' },
    { key: 'bar',  label: '막대 (R&M / 부자재)' },
    { key: 'line', label: '추세 (Jan–Apr)' },
  ];

  return (
    <div style={S.wrap}>
      <div style={S.tabRow}>
        {tabs.map(t => (
          <button key={t.key}
            onClick={() => setTab(t.key)}
            style={{ ...S.tab, ...(tab === t.key ? S.tabActive : {}) }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'pie' && (
        <div style={S.chartBox}>
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%" cy="50%"
                innerRadius={55}
                outerRadius={110}
                paddingAngle={2}
                stroke="#0b1220"
                strokeWidth={1}
              >
                {pieData.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value, name, props) => {
                  const pct = grandTotal > 0 ? (value * 100 / grandTotal).toFixed(1) : '0';
                  return [`${fmtRs(value)} (${pct}%)`, `${props.payload.code} ${name}`];
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div style={S.legendGrid}>
            {pieData.map(d => {
              const pct = grandTotal > 0 ? (d.value * 100 / grandTotal) : 0;
              const highlight = d.code === '3.4';
              return (
                <div key={d.code} style={{ ...S.legendItem, ...(highlight ? S.legendItemHL : {}) }}>
                  <span style={{ ...S.dot, background: d.color }} />
                  <span style={S.legCode}>{d.code}</span>
                  <span style={S.legName}>{d.name}</span>
                  <span style={S.legVal}>{fmtShort(d.value)}</span>
                  <span style={S.legPct}>{pct.toFixed(1)}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'bar' && (
        <div style={S.chartBox}>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={barData} margin={{ top: 20, right: 16, bottom: 12, left: 8 }}>
              <CartesianGrid stroke="#1f2a3d" strokeDasharray="3 3" />
              <XAxis dataKey="group" tick={{ fill: '#cbd5e1', fontSize: 12 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={fmtShort} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value) => [fmtRs(value), '합계']}
              />
              <Bar dataKey="value" radius={[8,8,0,0]}>
                {barData.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={S.barLabels}>
            {barData.map(d => (
              <div key={d.group} style={S.barLabel}>
                <span style={{ ...S.dot, background: d.fill }} />
                <span style={S.legName}>{d.group}</span>
                <span style={S.legVal}>{fmtRs(d.value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'line' && (
        <div style={S.chartBox}>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={lineData} margin={{ top: 20, right: 16, bottom: 12, left: 8 }}>
              <CartesianGrid stroke="#1f2a3d" strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fill: '#cbd5e1', fontSize: 12 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={fmtShort} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value, name) => [fmtRs(value), name]}
              />
              <Legend wrapperStyle={{ color: '#cbd5e1', fontSize: 12 }} />
              <Line type="monotone" dataKey="R&M" stroke="#38bdf8" strokeWidth={3} dot={{ r: 4, fill: '#38bdf8' }} />
              <Line type="monotone" dataKey="부자재" stroke="#34d399" strokeWidth={3} dot={{ r: 4, fill: '#34d399' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

const tooltipStyle = {
  background: '#0f1a2c',
  border: '1px solid #1f2a3d',
  borderRadius: 8,
  fontSize: 12,
  color: '#e2e8f0',
};

const S = {
  wrap: { background:'#0f1a2c', border:'1px solid #1f2a3d', borderRadius:12, padding:10 },
  tabRow: { display:'flex', gap:6, overflowX:'auto', paddingBottom:8 },
  tab: { flex:'0 0 auto', minHeight:40, padding:'8px 12px', borderRadius:8, border:'1px solid #1f2a3d', background:'#111c2e', color:'#cbd5e1', fontSize:13, cursor:'pointer' },
  tabActive: { background:'#1d4ed8', borderColor:'#3b82f6', color:'#fff', fontWeight:600 },
  chartBox: { padding:'4px 0' },
  legendGrid: { display:'grid', gridTemplateColumns:'1fr', gap:4, marginTop:8 },
  legendItem: { display:'grid', gridTemplateColumns:'14px 36px 1fr auto auto', alignItems:'center', gap:8, padding:'4px 8px', borderRadius:6, background:'#111c2e', fontSize:12, color:'#cbd5e1' },
  legendItemHL: { background:'rgba(251,191,36,.10)', border:'1px solid rgba(251,191,36,.35)' },
  dot: { display:'inline-block', width:10, height:10, borderRadius:'50%' },
  legCode: { color:'#94a3b8', fontWeight:700, fontSize:11 },
  legName: { color:'#e2e8f0' },
  legVal: { color:'#e2e8f0', fontWeight:600 },
  legPct: { color:'#94a3b8', fontSize:11, minWidth:42, textAlign:'right' },
  barLabels: { display:'flex', justifyContent:'space-around', gap:8, marginTop:8, flexWrap:'wrap' },
  barLabel: { display:'flex', alignItems:'center', gap:8, padding:'6px 10px', borderRadius:8, background:'#111c2e', fontSize:13, color:'#e2e8f0' },
};
