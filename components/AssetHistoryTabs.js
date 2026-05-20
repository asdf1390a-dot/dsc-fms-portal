// AssetHistoryTabs — 자산 상세 페이지의 PM/BM 통합 이력 + 통계 탭 컨테이너
// 4개 탭: Overview는 부모 페이지에 남기고, 본 컴포넌트는 PM / BM / Stats 3개를 렌더.
// 상위 페이지(/assets/[id].js)는 본 컴포넌트를 단일 [history] 섹션으로 포함한다.
//
// Props:
//   assetId  (uuid)   — 필수
//   assetNumber (text)— optional, 신규 BM 신고 링크용
//   isAuthed (bool)   — 신고 버튼 표시 여부
//
// Data fetching: /api/assets/history?assetId=... + /api/assets/stats?assetId=...
// 캐싱 전략: 탭 진입 시 한번 fetch, 메모리 캐시(객체 상태). React Query 미도입 → 의존성 추가 회피.
import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';

const TABS = [
  { key: 'pm',    label: 'PM 이력' },
  { key: 'bm',    label: 'BM 이력' },
  { key: 'stats', label: '통계' },
];

const PM_STATUS_STYLE = {
  completed:   { bg: '#dcfce7', fg: '#166534', label: '완료' },
  pending:     { bg: '#fef3c7', fg: '#92400e', label: '예정' },
  overdue:     { bg: '#fee2e2', fg: '#991b1b', label: '연체' },
  in_progress: { bg: '#dbeafe', fg: '#1e40af', label: '진행' },
  skipped:     { bg: '#e5e7eb', fg: '#374151', label: '스킵' },
};

const BM_STATUS_STYLE = {
  open:          { bg: '#fee2e2', fg: '#991b1b', label: 'OPEN' },
  in_progress:   { bg: '#fef3c7', fg: '#92400e', label: 'WIP' },
  pending_parts: { bg: '#fde68a', fg: '#78350f', label: '부품대기' },
  resolved:      { bg: '#dcfce7', fg: '#166534', label: '완료' },
  cancelled:     { bg: '#e5e7eb', fg: '#374151', label: '취소' },
};

const PRIORITY_COLOR = {
  critical: '#dc2626',
  high:     '#ea580c',
  medium:   '#ca8a04',
  low:      '#16a34a',
};

export default function AssetHistoryTabs({ assetId, assetNumber, isAuthed }) {
  const [tab, setTab] = useState('pm');
  const [history, setHistory] = useState(null);     // { pmSchedules, bmEvents, meta }
  const [stats, setStats] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);
  const [error, setError] = useState(null);

  const fetchHistory = useCallback(async () => {
    if (!assetId) return;
    setLoadingHistory(true);
    setError(null);
    try {
      const r = await fetch(`/api/assets/history?assetId=${encodeURIComponent(assetId)}&limit=20&offset=0`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'history fetch failed');
      setHistory(j);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingHistory(false);
    }
  }, [assetId]);

  const fetchStats = useCallback(async () => {
    if (!assetId) return;
    setLoadingStats(true);
    setError(null);
    try {
      const r = await fetch(`/api/assets/stats?assetId=${encodeURIComponent(assetId)}&months=3`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'stats fetch failed');
      setStats(j);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingStats(false);
    }
  }, [assetId]);

  // 진입 시 history는 항상 로드 (PM/BM 탭에서 모두 사용)
  useEffect(() => { fetchHistory(); }, [fetchHistory]);
  // stats 탭 진입 시 첫 1회만 로드
  useEffect(() => {
    if (tab === 'stats' && !stats && !loadingStats) fetchStats();
  }, [tab, stats, loadingStats, fetchStats]);

  const loadMore = async () => {
    if (!history?.meta) return;
    const nextOffset = history.meta.offset + history.meta.limit;
    const r = await fetch(`/api/assets/history?assetId=${encodeURIComponent(assetId)}&limit=20&offset=${nextOffset}`);
    const j = await r.json();
    if (!r.ok) return;
    setHistory({
      pmSchedules: [...history.pmSchedules, ...j.pmSchedules],
      bmEvents:    [...history.bmEvents,    ...j.bmEvents],
      meta:        j.meta,
    });
  };

  return (
    <div style={S.wrap}>
      <div style={S.tabBar} role="tablist">
        {TABS.map(t => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            style={{ ...S.tab, ...(tab === t.key ? S.tabActive : null) }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <div style={S.errBox}>{error}</div>}

      {tab === 'pm' && (
        <PMTab
          loading={loadingHistory}
          history={history}
          onLoadMore={history?.meta?.hasMorePm ? loadMore : null}
        />
      )}
      {tab === 'bm' && (
        <BMTab
          loading={loadingHistory}
          history={history}
          isAuthed={isAuthed}
          assetNumber={assetNumber}
          onLoadMore={history?.meta?.hasMoreBm ? loadMore : null}
        />
      )}
      {tab === 'stats' && (
        <StatsTab loading={loadingStats} stats={stats} />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// PM 탭
// ──────────────────────────────────────────────────────────
function PMTab({ loading, history, onLoadMore }) {
  if (loading && !history) return <div style={S.loading}>Loading…</div>;
  const rows = history?.pmSchedules || [];
  const total = history?.meta?.pmCount || 0;
  const completed = rows.filter(r => r.status === 'completed').length;
  const overdue   = rows.filter(r => r.derived_status === 'overdue').length;
  const rate = rows.length > 0 ? Math.round((completed / rows.length) * 1000) / 10 : null;

  return (
    <div>
      <div style={S.kpiRow}>
        <KpiCard label="총 건수" value={total.toLocaleString()} />
        <KpiCard label="완료율" value={rate == null ? '—' : `${rate}%`} color="#16a34a" />
        <KpiCard label="연체" value={overdue.toLocaleString()} color={overdue > 0 ? '#dc2626' : '#64748b'} />
      </div>

      {rows.length === 0 ? (
        <div style={S.empty}>PM 이력이 없습니다.</div>
      ) : (
        <ul style={S.list}>
          {rows.map(r => {
            const ss = PM_STATUS_STYLE[r.derived_status] || PM_STATUS_STYLE[r.status] || PM_STATUS_STYLE.pending;
            return (
              <li key={r.id} style={S.listItem}>
                <span style={{ ...S.badge, background: ss.bg, color: ss.fg }}>{ss.label}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={S.itemTitle}>{r.title || '(제목 없음)'}</div>
                  <div style={S.itemMeta}>
                    예정: {r.scheduled_date}
                    {r.completed_at && ` · 완료: ${new Date(r.completed_at).toLocaleDateString()}`}
                    {r.completed_by_name && ` · ${r.completed_by_name}`}
                    {r.actual_hours != null && ` · ${r.actual_hours}h`}
                  </div>
                  {r.notes && <div style={S.itemNote}>{r.notes}</div>}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {onLoadMore && (
        <button onClick={onLoadMore} style={S.loadMoreBtn}>더 보기</button>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// BM 탭
// ──────────────────────────────────────────────────────────
function BMTab({ loading, history, isAuthed, assetNumber, onLoadMore }) {
  if (loading && !history) return <div style={S.loading}>Loading…</div>;
  const rows = history?.bmEvents || [];
  const total = history?.meta?.bmCount || 0;
  const resolved = rows.filter(r => r.status === 'resolved').length;
  const open = rows.filter(r => ['open', 'in_progress', 'pending_parts'].includes(r.status)).length;
  const resolveRate = rows.length > 0 ? Math.round((resolved / rows.length) * 1000) / 10 : null;

  // 페이지 단위 MTTR (가벼운 미리보기 — 상세 stats는 통계 탭에 있음)
  let dtSum = 0, dtN = 0;
  for (const e of rows) {
    if (e.status !== 'resolved') continue;
    const s = e.downtime_start || e.reported_at;
    const ed = e.downtime_end || e.resolved_at;
    if (!s || !ed) continue;
    const m = (new Date(ed) - new Date(s)) / 60000;
    if (Number.isFinite(m) && m >= 0) { dtSum += m; dtN += 1; }
  }
  const mttr = dtN > 0 ? Math.round((dtSum / dtN) * 10) / 10 : null;

  return (
    <div>
      <div style={S.kpiRow}>
        <KpiCard label="총 건수" value={total.toLocaleString()} />
        <KpiCard label="해결률" value={resolveRate == null ? '—' : `${resolveRate}%`} color="#16a34a" />
        <KpiCard label="MTTR" value={mttr == null ? '—' : `${mttr}분`} />
        <KpiCard label="진행중" value={open.toLocaleString()} color={open > 0 ? '#dc2626' : '#64748b'} />
      </div>

      {isAuthed && assetNumber && (
        <Link href={`/bm/new?asset=${encodeURIComponent(assetNumber)}`} style={S.reportBtn}>
          🚨 고장 신고
        </Link>
      )}

      {rows.length === 0 ? (
        <div style={S.empty}>BM 이력이 없습니다.</div>
      ) : (
        <ul style={S.list}>
          {rows.map(e => {
            const ss = BM_STATUS_STYLE[e.status] || BM_STATUS_STYLE.open;
            const pri = e.priority || 'medium';
            return (
              <li key={e.id} style={S.listItem}>
                <span style={{ ...S.badge, background: ss.bg, color: ss.fg }}>{ss.label}</span>
                <Link href={`/bm/${e.id}`} style={{ flex: 1, minWidth: 0, textDecoration: 'none', color: 'inherit' }}>
                  <div style={S.itemTitle}>
                    <span style={{
                      display: 'inline-block', width: 8, height: 8, borderRadius: 4,
                      background: PRIORITY_COLOR[pri] || '#94a3b8', marginRight: 6, verticalAlign: 'middle',
                    }} />
                    {(e.symptom || '').slice(0, 80)}{e.symptom?.length > 80 ? '…' : ''}
                  </div>
                  <div style={S.itemMeta}>
                    {new Date(e.reported_at).toLocaleDateString()}
                    {e.resolved_at && ` → ${new Date(e.resolved_at).toLocaleDateString()}`}
                    {e.work_hours != null && ` · ${e.work_hours}h`}
                    {e.cause_code && ` · ${e.cause_code}`}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {onLoadMore && (
        <button onClick={onLoadMore} style={S.loadMoreBtn}>더 보기</button>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// 통계 탭
// ──────────────────────────────────────────────────────────
function StatsTab({ loading, stats }) {
  if (loading && !stats) return <div style={S.loading}>Loading…</div>;
  if (!stats) return <div style={S.empty}>통계 데이터가 없습니다.</div>;

  const { pmRate, bm, failuresByPriority, monthlyCompliance, windowMonths } = stats;
  const maxPri = Math.max(1, ...failuresByPriority.map(p => p.count));

  return (
    <div>
      <div style={S.statsSection}>
        <div style={S.statsTitle}>PM 준수율 ({windowMonths}개월)</div>
        <div style={S.kpiRow}>
          <KpiCard label="예정" value={pmRate.totalScheduled.toLocaleString()} />
          <KpiCard label="완료" value={pmRate.totalCompleted.toLocaleString()} color="#16a34a" />
          <KpiCard
            label="준수율"
            value={pmRate.complianceRate == null ? '—' : `${pmRate.complianceRate}%`}
            color="#2563eb"
          />
          <KpiCard
            label="연체"
            value={pmRate.overdueCount.toLocaleString()}
            color={pmRate.overdueCount > 0 ? '#dc2626' : '#64748b'}
          />
        </div>

        {monthlyCompliance.length > 0 && (
          <div style={{ marginTop: 12 }}>
            {monthlyCompliance.map(m => (
              <div key={m.ym} style={S.barRow}>
                <div style={S.barLabel}>{m.ym}</div>
                <div style={S.barTrack}>
                  <div style={{
                    ...S.barFill,
                    width: `${m.rate == null ? 0 : m.rate}%`,
                    background: '#2563eb',
                  }} />
                </div>
                <div style={S.barValue}>
                  {m.completed}/{m.scheduled} · {m.rate == null ? '—' : `${m.rate}%`}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={S.statsSection}>
        <div style={S.statsTitle}>BM 신뢰성 지표 ({windowMonths}개월)</div>
        <div style={S.kpiRow}>
          <KpiCard label="MTTR" value={bm.mttrMin == null ? '—' : `${bm.mttrMin}분`} />
          <KpiCard label="MTBF" value={bm.mtbfMin == null ? '—' : `${bm.mtbfMin}분`} />
          <KpiCard
            label="가동률"
            value={bm.uptimePct == null ? '—' : `${bm.uptimePct}%`}
            color={bm.uptimePct != null && bm.uptimePct < 95 ? '#dc2626' : '#16a34a'}
          />
          <KpiCard label="고장 건수" value={bm.breakdownCount.toLocaleString()} />
        </div>
      </div>

      <div style={S.statsSection}>
        <div style={S.statsTitle}>우선순위별 고장 분포</div>
        {failuresByPriority.every(p => p.count === 0) ? (
          <div style={S.empty}>데이터 없음</div>
        ) : (
          failuresByPriority.map(p => (
            <div key={p.priority} style={S.barRow}>
              <div style={S.barLabel}>{p.priority.toUpperCase()}</div>
              <div style={S.barTrack}>
                <div style={{
                  ...S.barFill,
                  width: `${(p.count / maxPri) * 100}%`,
                  background: PRIORITY_COLOR[p.priority] || '#94a3b8',
                }} />
              </div>
              <div style={S.barValue}>{p.count}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// KPI 카드
// ──────────────────────────────────────────────────────────
function KpiCard({ label, value, color }) {
  return (
    <div style={S.kpi}>
      <div style={S.kpiLabel}>{label}</div>
      <div style={{ ...S.kpiValue, ...(color ? { color } : null) }}>{value}</div>
    </div>
  );
}

const S = {
  wrap: { background: '#fff', borderRadius: 12, padding: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' },

  tabBar: {
    display: 'flex', gap: 4, borderBottom: '1px solid #e2e8f0',
    marginBottom: 14, overflowX: 'auto', WebkitOverflowScrolling: 'touch',
  },
  tab: {
    flex: '1 1 auto', minWidth: 88,
    padding: '12px 10px', border: 'none', background: 'transparent',
    fontSize: 14, fontWeight: 600, color: '#64748b', cursor: 'pointer',
    borderBottom: '2px solid transparent',
  },
  tabActive: { color: '#0f172a', borderBottomColor: '#0f172a' },

  loading: { padding: 24, textAlign: 'center', color: '#64748b' },
  empty:   { padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 13 },
  errBox:  { padding: 12, background: '#fee2e2', color: '#991b1b', borderRadius: 8, fontSize: 13, marginBottom: 10 },

  kpiRow: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))',
    gap: 8, marginBottom: 12,
  },
  kpi: {
    background: '#f8fafc', borderRadius: 8, padding: '10px 12px',
    border: '1px solid #e2e8f0',
  },
  kpiLabel: { fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 },
  kpiValue: { fontSize: 18, fontWeight: 700, color: '#0f172a', marginTop: 2 },

  list: { listStyle: 'none', margin: 0, padding: 0 },
  listItem: {
    display: 'flex', gap: 10, alignItems: 'flex-start',
    padding: '12px 4px', borderTop: '1px solid #f1f5f9',
  },
  badge: {
    fontSize: 10, fontWeight: 700, padding: '4px 8px', borderRadius: 4,
    minWidth: 54, textAlign: 'center', letterSpacing: 0.3, flexShrink: 0,
  },
  itemTitle: { fontSize: 14, color: '#0f172a', fontWeight: 500 },
  itemMeta:  { fontSize: 11, color: '#94a3b8', marginTop: 3 },
  itemNote:  { fontSize: 12, color: '#475569', marginTop: 4, fontStyle: 'italic' },

  reportBtn: {
    display: 'block', background: '#dc2626', color: '#fff',
    padding: '12px', borderRadius: 10, textDecoration: 'none',
    textAlign: 'center', fontSize: 14, fontWeight: 700,
    marginBottom: 12,
  },

  loadMoreBtn: {
    display: 'block', width: '100%', marginTop: 12,
    padding: '10px', border: '1px solid #cbd5e1', borderRadius: 8,
    background: '#fff', fontSize: 13, fontWeight: 600, color: '#334155',
    cursor: 'pointer',
  },

  statsSection: {
    padding: '12px 0', borderTop: '1px solid #f1f5f9',
  },
  statsTitle: { fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.3 },

  barRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 },
  barLabel: { fontSize: 12, color: '#64748b', minWidth: 70, fontWeight: 600 },
  barTrack: { flex: 1, height: 10, background: '#e2e8f0', borderRadius: 6, overflow: 'hidden' },
  barFill:  { height: '100%', borderRadius: 6, transition: 'width 0.3s' },
  barValue: { fontSize: 12, color: '#334155', minWidth: 80, textAlign: 'right' },
};
