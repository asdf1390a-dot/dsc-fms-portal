import React, { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';
import { colors, spacing, typography, borderRadius } from '../../lib/design-tokens';

function formatBytes(n) {
  const b = Number(n);
  if (!Number.isFinite(b) || b <= 0) return '0';
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(0)}K`;
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)}M`;
  return `${(b / 1024 ** 3).toFixed(2)}G`;
}

/**
 * MetricsChart — 30-day line chart of daily backup counts or cumulative size.
 *
 * Props:
 *   daily_data: [{date|metric_date, count|total_backups, total_size|total_size_bytes}]
 */
export default function MetricsChart({ daily_data = [] }) {
  const [mode, setMode] = useState('count'); // 'count' | 'size'

  // Normalize + sort ascending by date for the chart.
  const data = React.useMemo(() => {
    return [...daily_data]
      .map((r) => ({
        date: r.date || r.metric_date,
        count: Number(r.count ?? r.total_backups ?? 0),
        size: Number(r.total_size ?? r.total_size_bytes ?? 0),
      }))
      .filter((r) => r.date)
      .sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [daily_data]);

  return (
    <div style={S.card}>
      <div style={S.header}>
        <h3 style={S.title}>일일 추이 (최근 30일)</h3>
        <div style={S.toggle}>
          <button
            type="button"
            onClick={() => setMode('count')}
            style={{
              ...S.toggleBtn,
              ...(mode === 'count' ? S.toggleBtnActive : {}),
            }}
          >
            백업 수
          </button>
          <button
            type="button"
            onClick={() => setMode('size')}
            style={{
              ...S.toggleBtn,
              ...(mode === 'size' ? S.toggleBtnActive : {}),
            }}
          >
            총 크기
          </button>
        </div>
      </div>

      {data.length === 0 ? (
        <div style={S.empty}>데이터가 없습니다.</div>
      ) : (
        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
            >
              <CartesianGrid stroke={colors.borderLight} strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tick={{ fill: colors.textTertiary, fontSize: 11 }}
                stroke={colors.borderLight}
                tickFormatter={(d) => (d || '').slice(5)}
              />
              <YAxis
                tick={{ fill: colors.textTertiary, fontSize: 11 }}
                stroke={colors.borderLight}
                tickFormatter={(v) => (mode === 'size' ? formatBytes(v) : v)}
                allowDecimals={false}
                width={48}
              />
              <Tooltip
                contentStyle={{
                  background: colors.bgSecondary,
                  border: `1px solid ${colors.borderLight}`,
                  borderRadius: '6px',
                  color: colors.textPrimary,
                  fontSize: 12,
                }}
                formatter={(value) =>
                  mode === 'size' ? formatBytes(value) : value
                }
                labelStyle={{ color: colors.textTertiary }}
              />
              <Line
                type="monotone"
                dataKey={mode === 'size' ? 'size' : 'count'}
                stroke={colors.accentCyan}
                strokeWidth={2}
                dot={{ r: 3, fill: colors.accentCyan }}
                activeDot={{ r: 5 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

const S = {
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.md,
    padding: spacing.lg,
    background: colors.bgSecondary,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: borderRadius.lg,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  title: {
    margin: 0,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
  },
  toggle: {
    display: 'inline-flex',
    background: colors.bgPrimary,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: borderRadius.md,
    padding: '2px',
  },
  toggleBtn: {
    padding: `${spacing.xs} ${spacing.md}`,
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    background: 'transparent',
    border: 'none',
    borderRadius: borderRadius.sm,
    cursor: 'pointer',
  },
  toggleBtnActive: {
    background: colors.accentCyan,
    color: colors.bgPrimary,
    fontWeight: typography.weights.semibold,
  },
  empty: {
    textAlign: 'center',
    padding: spacing['3xl'],
    color: colors.textTertiary,
    fontSize: typography.sizes.sm,
  },
};
