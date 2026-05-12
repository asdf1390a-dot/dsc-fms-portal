// 월별 일정 타임라인 — 점(dot)으로 과거/예정/연체/완료 표시
const STATUS_COLOR = {
  done: '#22c55e',
  completed: '#22c55e',
  pending: '#3b82f6',
  overdue: '#ef4444',
  skipped: '#64748b',
  in_progress: '#f59e0b',
};

function ymd(d) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export default function ScheduleTimeline({ schedules = [], month }) {
  // month: 'YYYY-MM' or Date; default current month
  const base = month
    ? (typeof month === 'string' ? new Date(month + '-01') : new Date(month))
    : new Date();
  const y = base.getFullYear();
  const m = base.getMonth();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const todayStr = ymd(new Date());

  const byDate = {};
  for (const s of schedules) {
    const d = (s.scheduled_date || s.date || '').slice(0, 10);
    if (!d) continue;
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(s);
  }

  const days = [];
  for (let i = 1; i <= daysInMonth; i++) {
    const dstr = ymd(new Date(y, m, i));
    days.push({ day: i, dstr, items: byDate[dstr] || [] });
  }

  return (
    <div style={S.wrap}>
      <div style={S.monthLabel}>{y}년 {String(m + 1).padStart(2, '0')}월</div>
      <div style={S.grid}>
        {days.map(d => {
          const isToday = d.dstr === todayStr;
          const top = d.items[0];
          const color = top ? (STATUS_COLOR[top.status] || '#64748b') : null;
          return (
            <div key={d.day} style={{
              ...S.cell,
              border: isToday ? '1px solid #3b82f6' : '1px solid #334155',
            }}>
              <div style={S.dayNum}>{d.day}</div>
              {d.items.length > 0 && (
                <div style={S.dots}>
                  {d.items.slice(0, 3).map((s, i) => (
                    <span key={i} style={{
                      ...S.dot,
                      background: STATUS_COLOR[s.status] || '#64748b',
                    }} />
                  ))}
                  {d.items.length > 3 && (
                    <span style={S.more}>+{d.items.length - 3}</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div style={S.legend}>
        <Legend color="#3b82f6" label="예정" />
        <Legend color="#22c55e" label="완료" />
        <Legend color="#ef4444" label="연체" />
        <Legend color="#64748b" label="건너뜀" />
      </div>
    </div>
  );
}

function Legend({ color, label }) {
  return (
    <span style={S.legendItem}>
      <span style={{ ...S.dot, background: color }} />
      <span>{label}</span>
    </span>
  );
}

const S = {
  wrap: { background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: 12 },
  monthLabel: { fontSize: 13, fontWeight: 700, color: '#f1f5f9', marginBottom: 10, textAlign: 'center' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 },
  cell: { aspectRatio: '1 / 1', borderRadius: 6, padding: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', background: '#0b1220' },
  dayNum: { fontSize: 11, color: '#cbd5e1', fontFamily: 'ui-monospace,Menlo,monospace' },
  dots: { display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 2 },
  dot: { width: 6, height: 6, borderRadius: '50%', display: 'inline-block' },
  more: { fontSize: 9, color: '#94a3b8' },
  legend: { display: 'flex', gap: 12, marginTop: 10, flexWrap: 'wrap', justifyContent: 'center', fontSize: 11, color: '#94a3b8' },
  legendItem: { display: 'inline-flex', alignItems: 'center', gap: 4 },
};
