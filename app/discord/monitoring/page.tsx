'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

type DashboardData = {
  configs: any[];
  pending_count: number;
  last_success_at: string | null;
  recent_logs: any[];
  metrics_7d: { totals: { total: number; success: number; error: number; pending: number }; daily: any[] };
};

export default function DiscordMonitoringPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const token = useMemo(() => (typeof window === 'undefined' ? null : localStorage.getItem('sb-token')), []);

  const load = useCallback(async () => {
    if (!token) {
      router.push('/auth/login');
      return;
    }
    try {
      setRefreshing(true);
      const [dash, list] = await Promise.all([
        fetch('/api/discord/monitoring/dashboard', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/discord/monitoring/logs?limit=50', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (!dash.ok) throw new Error(`dashboard ${dash.status}`);
      const dashJson = await dash.json();
      setData(dashJson.data ?? dashJson);
      if (list.ok) {
        const j = await list.json();
        setLogs((j.data ?? j)?.rows ?? []);
      }
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router, token]);

  useEffect(() => {
    load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, [load]);

  if (loading) return <main className={styles.main}><p>로딩 중…</p></main>;
  if (error) return <main className={styles.main}><p className={styles.error}>오류: {error}</p></main>;

  const totals = data?.metrics_7d?.totals ?? { total: 0, success: 0, error: 0, pending: 0 };
  const successRate = totals.total ? Math.round((totals.success / totals.total) * 1000) / 10 : null;

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <h1>Discord ↔ Telegram 동기화 모니터링</h1>
        <button onClick={load} className={styles.refresh} disabled={refreshing}>
          {refreshing ? '갱신 중…' : '새로 고침'}
        </button>
      </header>

      <section className={styles.kpis}>
        <div className={styles.kpi}>
          <span className={styles.kpiLabel}>대기 중</span>
          <span className={styles.kpiValue}>{data?.pending_count ?? 0}</span>
        </div>
        <div className={styles.kpi}>
          <span className={styles.kpiLabel}>7일 성공률</span>
          <span className={styles.kpiValue}>{successRate !== null ? `${successRate}%` : '—'}</span>
        </div>
        <div className={styles.kpi}>
          <span className={styles.kpiLabel}>7일 총 전송</span>
          <span className={styles.kpiValue}>{totals.total}</span>
        </div>
        <div className={styles.kpi}>
          <span className={styles.kpiLabel}>마지막 성공</span>
          <span className={styles.kpiValueSmall}>
            {data?.last_success_at ? new Date(data.last_success_at).toLocaleString('ko-KR') : '없음'}
          </span>
        </div>
      </section>

      <section className={styles.panel}>
        <h2>연결된 길드 / 채널 라우팅</h2>
        {(data?.configs ?? []).length === 0 ? (
          <p className={styles.empty}>설정된 길드가 없습니다. OAuth 로그인을 먼저 진행하세요.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>길드</th>
                <th>일반</th>
                <th>진행중</th>
                <th>완료</th>
                <th>블로커</th>
                <th>팀 논의</th>
                <th>텔레그램 채팅</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              {data!.configs.map((c) => (
                <tr key={c.config_id}>
                  <td>{c.guild_name || c.guild_id}</td>
                  <td>{c.channel_general || '—'}</td>
                  <td>{c.channel_in_progress || '—'}</td>
                  <td>{c.channel_completed || '—'}</td>
                  <td>{c.channel_blocker || '—'}</td>
                  <td>{c.channel_team_discuss || '—'}</td>
                  <td>{c.telegram_chat_id || '—'}</td>
                  <td>
                    <span className={c.enabled ? styles.badgeOk : styles.badgeOff}>
                      {c.enabled ? '활성' : '비활성'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className={styles.panel}>
        <h2>최근 동기화 로그</h2>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>시간</th>
              <th>경로</th>
              <th>상태</th>
              <th>지연(ms)</th>
              <th>에러</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={5} className={styles.empty}>로그 없음</td>
              </tr>
            ) : (
              logs.map((row) => (
                <tr key={row.log_id}>
                  <td>{row.created_at ? new Date(row.created_at).toLocaleString('ko-KR') : '—'}</td>
                  <td>{row.source_platform} → {row.target_platform}</td>
                  <td>
                    <span className={
                      row.sync_status === 'success' ? styles.badgeOk
                      : row.sync_status === 'error' ? styles.badgeErr
                      : styles.badgePending
                    }>
                      {row.sync_status}
                    </span>
                  </td>
                  <td>{row.latency_ms ?? '—'}</td>
                  <td className={styles.errCell}>{row.error_message || ''}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
