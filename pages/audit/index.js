import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/use-auth';
import BottomNav from '../../components/BottomNav';

const STATUS_META = {
  pass:  { emoji: '🟢', label: '정상',   color: '#22c55e', bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.35)' },
  warn:  { emoji: '🟡', label: '경고',   color: '#eab308', bg: 'rgba(234,179,8,0.12)',  border: 'rgba(234,179,8,0.35)' },
  fail:  { emoji: '🔴', label: '실패',   color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.35)' },
  error: { emoji: '⚠️', label: '오류',   color: '#f97316', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.35)' },
};
const STATUS_ORDER = ['pass', 'warn', 'fail', 'error'];

const AUDIT_NAME_LABELS = {
  backup_success_rate:  '백업 성공률',
  api_response_time:    'API 응답시간',
  storage_reliability:  '저장소 신뢰도',
  alert_delivery:       '알림 전달',
};

async function bearerHeaders() {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess?.session?.access_token;
  if (!token) throw new Error('로그인이 필요합니다');
  return { Authorization: `Bearer ${token}` };
}

export default function AuditDashboard() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [logs, setLogs]       = useState([]);
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [savingName, setSavingName] = useState(null);

  // ── Filters ───────────────────────────────────────────────────────────
  const [auditNameFilter, setAuditNameFilter] = useState('');
  const [statusFilter, setStatusFilter]       = useState('');
  const [sinceFilter, setSinceFilter]         = useState('');

  // ── Auth gate ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent('/audit')}`);
    }
  }, [user, authLoading, router]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await bearerHeaders();
      const params = new URLSearchParams({ limit: '100' });
      if (auditNameFilter) params.set('audit_name', auditNameFilter);
      if (statusFilter)    params.set('status', statusFilter);
      if (sinceFilter)     params.set('since', new Date(sinceFilter).toISOString());

      const [logsRes, cfgRes] = await Promise.all([
        fetch(`/api/audit/logs?${params.toString()}`, { headers }),
        fetch('/api/audit/config', { headers }),
      ]);

      if (!logsRes.ok) throw new Error(`로그 조회 실패 (${logsRes.status})`);
      if (!cfgRes.ok)  throw new Error(`설정 조회 실패 (${cfgRes.status})`);

      const logsJson = await logsRes.json();
      const cfgJson  = await cfgRes.json();

      setLogs(logsJson.logs || []);
      setConfigs(cfgJson.configs || []);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [auditNameFilter, statusFilter, sinceFilter]);

  useEffect(() => {
    if (!user) return;
    fetchAll();
  }, [user, fetchAll]);

  // ── Summary counts ────────────────────────────────────────────────────
  const counts = useMemo(() => {
    const c = { pass: 0, warn: 0, fail: 0, error: 0 };
    for (const log of logs) {
      if (c[log.status] !== undefined) c[log.status] += 1;
    }
    return c;
  }, [logs]);

  // ── Config save ───────────────────────────────────────────────────────
  const saveConfig = async (cfg, patch) => {
    setSavingName(cfg.audit_name);
    try {
      const headers = { ...(await bearerHeaders()), 'Content-Type': 'application/json' };
      const body = JSON.stringify({
        audit_name: cfg.audit_name,
        description: cfg.description ?? null,
        threshold: patch.threshold ?? cfg.threshold,
        enabled: patch.enabled ?? cfg.enabled,
      });
      const res = await fetch('/api/audit/config', { method: 'POST', headers, body });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `저장 실패 (${res.status})`);
      }
      const { config: updated } = await res.json();
      setConfigs((prev) => prev.map((c) => (c.audit_name === updated.audit_name ? updated : c)));
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setSavingName(null);
    }
  };

  if (authLoading || !user) {
    return (
      <main style={S.page}>
        <div style={S.loading}>불러오는 중…</div>
      </main>
    );
  }

  return (
    <>
      <Head>
        <title>감시 대시보드 | DSC FMS</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#0f172a" />
      </Head>

      <main style={S.page}>
        <header style={S.header}>
          <Link href="/" style={S.backBtn} aria-label="홈으로">‹</Link>
          <h1 style={S.title}>감시 대시보드</h1>
          <button type="button" onClick={fetchAll} style={S.refreshBtn} aria-label="새로고침">↻</button>
        </header>

        {/* ── Summary cards ───────────────────────────────────────────── */}
        <section style={S.summaryGrid}>
          {STATUS_ORDER.map((key) => {
            const meta = STATUS_META[key];
            return (
              <div key={key} style={{ ...S.summaryCard, background: meta.bg, border: `1px solid ${meta.border}` }}>
                <div style={S.summaryEmoji}>{meta.emoji}</div>
                <div style={{ ...S.summaryCount, color: meta.color }}>{counts[key]}</div>
                <div style={S.summaryLabel}>{meta.label}</div>
              </div>
            );
          })}
        </section>

        {/* ── Filters ─────────────────────────────────────────────────── */}
        <section style={S.filterRow}>
          <select
            value={auditNameFilter}
            onChange={(e) => setAuditNameFilter(e.target.value)}
            style={S.select}
            aria-label="감시 항목 필터"
          >
            <option value="">전체 항목</option>
            {Object.entries(AUDIT_NAME_LABELS).map(([k, label]) => (
              <option key={k} value={k}>{label}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={S.select}
            aria-label="상태 필터"
          >
            <option value="">전체 상태</option>
            {STATUS_ORDER.map((k) => (
              <option key={k} value={k}>{STATUS_META[k].emoji} {STATUS_META[k].label}</option>
            ))}
          </select>
          <input
            type="date"
            value={sinceFilter}
            onChange={(e) => setSinceFilter(e.target.value)}
            style={S.dateInput}
            aria-label="시작 날짜"
          />
        </section>

        {error && <div style={S.errorBox}>{error}</div>}

        {/* ── Config editor ───────────────────────────────────────────── */}
        <section style={S.section}>
          <h2 style={S.h2}>감시 설정</h2>
          {configs.length === 0 ? (
            <div style={S.empty}>등록된 감시 설정이 없습니다. 일일 cron 실행 후 자동 생성됩니다.</div>
          ) : (
            <ul style={S.configList}>
              {configs.map((cfg) => (
                <li key={cfg.config_id} style={S.configCard}>
                  <div style={S.configHeader}>
                    <span style={S.configName}>{AUDIT_NAME_LABELS[cfg.audit_name] || cfg.audit_name}</span>
                    <label style={S.toggleWrap}>
                      <input
                        type="checkbox"
                        checked={!!cfg.enabled}
                        disabled={savingName === cfg.audit_name}
                        onChange={(e) => saveConfig(cfg, { enabled: e.target.checked })}
                      />
                      <span style={S.toggleLabel}>{cfg.enabled ? '활성' : '비활성'}</span>
                    </label>
                  </div>
                  {cfg.description && <div style={S.configDesc}>{cfg.description}</div>}
                  <div style={S.thresholdRow}>
                    <label style={S.thresholdLabel}>임계값</label>
                    <input
                      type="number"
                      defaultValue={cfg.threshold}
                      step="0.01"
                      style={S.thresholdInput}
                      disabled={savingName === cfg.audit_name}
                      onBlur={(e) => {
                        const next = Number(e.target.value);
                        if (Number.isFinite(next) && next !== Number(cfg.threshold)) {
                          saveConfig(cfg, { threshold: next });
                        }
                      }}
                    />
                    {savingName === cfg.audit_name && <span style={S.savingPill}>저장중…</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── Logs list ───────────────────────────────────────────────── */}
        <section style={S.section}>
          <h2 style={S.h2}>최근 감시 로그 ({logs.length})</h2>
          {loading ? (
            <div style={S.loading}>불러오는 중…</div>
          ) : logs.length === 0 ? (
            <div style={S.empty}>조건에 맞는 로그가 없습니다.</div>
          ) : (
            <ul style={S.logList}>
              {logs.map((log) => {
                const meta = STATUS_META[log.status] || STATUS_META.error;
                const measured = log.measured_value;
                const showMeasured = measured !== null && measured !== undefined;
                return (
                  <li key={log.log_id} style={{ ...S.logCard, borderColor: meta.border }}>
                    <span style={{ ...S.logStatusBar, background: meta.color }} />
                    <div style={S.logBody}>
                      <div style={S.logTopRow}>
                        <span style={S.logName}>{AUDIT_NAME_LABELS[log.audit_name] || log.audit_name}</span>
                        <span style={{ ...S.statusChip, color: meta.color, background: meta.bg, border: `1px solid ${meta.border}` }}>
                          {meta.emoji} {meta.label}
                        </span>
                      </div>
                      <div style={S.logMetaRow}>
                        {showMeasured && (
                          <span style={S.metric}>
                            <span style={{ color: meta.color, fontWeight: 700 }}>{measured}</span>
                            <span style={S.thresholdMeta}> / {log.threshold ?? '—'}</span>
                          </span>
                        )}
                        <span style={S.logTime}>{formatDateTime(log.run_at)}</span>
                      </div>
                      {log.details && Object.keys(log.details).length > 0 && (
                        <div style={S.logDetails}>{formatDetails(log.details)}</div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>

      <BottomNav />
    </>
  );
}

function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${mm}/${dd} ${hh}:${mi}`;
}

function formatDetails(d) {
  if (d.reason) return `사유: ${d.reason}`;
  const pairs = Object.entries(d).slice(0, 3).map(([k, v]) => `${k}=${v}`);
  return pairs.join(' · ');
}

const S = {
  page: { fontFamily: 'system-ui,-apple-system,sans-serif', background: '#0f172a', minHeight: '100vh', color: '#e2e8f0', paddingBottom: 'calc(60px + env(safe-area-inset-bottom,0px) + 24px)', maxWidth: 480, margin: '0 auto' },
  header: { position: 'sticky', top: 0, zIndex: 20, background: '#0f172a', borderBottom: '1px solid #1f2937', padding: '10px 14px', display: 'grid', gridTemplateColumns: '44px 1fr 44px', alignItems: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.4)' },
  backBtn: { width: 44, height: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', textDecoration: 'none', fontSize: 28, fontWeight: 300, lineHeight: 1 },
  title: { fontSize: 17, fontWeight: 700, margin: 0, color: '#f8fafc', textAlign: 'center' },
  refreshBtn: { width: 44, height: 44, background: 'transparent', border: 'none', color: '#60a5fa', fontSize: 22, cursor: 'pointer' },

  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, padding: '12px 14px 6px' },
  summaryCard: { borderRadius: 10, padding: '10px 6px', textAlign: 'center' },
  summaryEmoji: { fontSize: 18, lineHeight: 1, marginBottom: 4 },
  summaryCount: { fontSize: 20, fontWeight: 800, fontFamily: 'ui-monospace,Menlo,monospace', lineHeight: 1, marginBottom: 2 },
  summaryLabel: { fontSize: 11, color: '#94a3b8', fontWeight: 600 },

  filterRow: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, padding: '8px 14px 4px' },
  select: { padding: '9px 8px', background: '#0b1220', color: '#f1f5f9', border: '1px solid #334155', borderRadius: 8, fontSize: 12, minHeight: 40, outline: 'none' },
  dateInput: { padding: '9px 8px', background: '#0b1220', color: '#f1f5f9', border: '1px solid #334155', borderRadius: 8, fontSize: 12, minHeight: 40, outline: 'none' },

  section: { padding: '8px 14px 4px' },
  h2: { fontSize: 13, fontWeight: 700, color: '#cbd5e1', margin: '12px 0 8px', textTransform: 'uppercase', letterSpacing: 0.5 },

  configList: { listStyle: 'none', margin: 0, padding: 0 },
  configCard: { background: '#1e293b', border: '1px solid #1f2937', borderRadius: 10, padding: 12, marginBottom: 8 },
  configHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 6 },
  configName: { fontSize: 14, fontWeight: 700, color: '#f8fafc' },
  configDesc: { fontSize: 12, color: '#94a3b8', marginBottom: 8 },
  toggleWrap: { display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' },
  toggleLabel: { fontSize: 11, fontWeight: 700, color: '#94a3b8' },
  thresholdRow: { display: 'flex', alignItems: 'center', gap: 8 },
  thresholdLabel: { fontSize: 12, color: '#94a3b8', fontWeight: 600 },
  thresholdInput: { flex: 1, padding: '8px 10px', background: '#0b1220', color: '#f1f5f9', border: '1px solid #334155', borderRadius: 8, fontSize: 14, fontFamily: 'ui-monospace,Menlo,monospace', minHeight: 38, outline: 'none' },
  savingPill: { fontSize: 11, color: '#60a5fa', fontWeight: 700 },

  logList: { listStyle: 'none', margin: 0, padding: 0 },
  logCard: { position: 'relative', background: '#1e293b', border: '1px solid #1f2937', borderRadius: 10, marginBottom: 8, overflow: 'hidden' },
  logStatusBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  logBody: { padding: '10px 12px 10px 14px' },
  logTopRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  logName: { fontSize: 14, fontWeight: 700, color: '#f8fafc' },
  statusChip: { fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 999, whiteSpace: 'nowrap' },
  logMetaRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  metric: { fontSize: 14, fontFamily: 'ui-monospace,Menlo,monospace' },
  thresholdMeta: { color: '#64748b', fontSize: 12 },
  logTime: { fontSize: 11, color: '#64748b', fontFamily: 'ui-monospace,Menlo,monospace' },
  logDetails: { fontSize: 11, color: '#94a3b8', marginTop: 6, fontFamily: 'ui-monospace,Menlo,monospace', wordBreak: 'break-all' },

  loading: { padding: 32, textAlign: 'center', color: '#64748b' },
  empty: { padding: 24, textAlign: 'center', color: '#64748b', fontSize: 13, background: '#1e293b', border: '1px dashed #334155', borderRadius: 10 },
  errorBox: { margin: '8px 14px', padding: 12, background: 'rgba(220,38,38,0.15)', color: '#fca5a5', border: '1px solid rgba(220,38,38,0.4)', borderRadius: 10, fontSize: 13 },
};
