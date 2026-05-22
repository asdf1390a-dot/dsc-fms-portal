import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import JeepneyLayout from '../../../components/jeepney/JeepneyLayout';
import { colors, spacing, typography, borderRadius } from '../../../lib/design-tokens';
import { useAuth } from '../../../lib/use-auth';
import { apiGet, apiPost } from '../../../lib/backup-fetch';

const STATUS_STYLE = {
  pass: { bg: `${colors.success}22`, fg: colors.success, label: '정상' },
  warn: { bg: `${colors.warning}22`, fg: colors.warning, label: '경고' },
  fail: { bg: `${colors.error}22`, fg: colors.error, label: '실패' },
  error: { bg: `${colors.textTertiary}22`, fg: colors.textTertiary, label: '오류' },
};

const DEFAULT_AUDITS = [
  { audit_name: 'backup_success_rate', description: '24시간 백업 성공률 (%)', threshold: 95 },
  { audit_name: 'api_response_time', description: 'API p99 응답시간 (ms)', threshold: 500 },
];

function StatusBadge({ status }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.error;
  return (
    <span
      style={{
        background: s.bg,
        color: s.fg,
        padding: `2px ${spacing.sm}`,
        borderRadius: borderRadius.sm,
        fontSize: typography.sizes.xs,
        fontWeight: typography.weights.semibold,
      }}
    >
      {s.label}
    </span>
  );
}

export default function AuditDashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [configs, setConfigs] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [savingKey, setSavingKey] = useState(null);
  const [drafts, setDrafts] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, l] = await Promise.all([
        apiGet('/api/audit/config'),
        apiGet('/api/audit/logs?limit=50'),
      ]);
      const fetched = c.configs || [];

      const byName = new Map(fetched.map((row) => [row.audit_name, row]));
      const merged = DEFAULT_AUDITS.map((d) => byName.get(d.audit_name) || {
        config_id: null,
        audit_name: d.audit_name,
        description: d.description,
        threshold: d.threshold,
        enabled: false,
      });
      for (const row of fetched) {
        if (!DEFAULT_AUDITS.find((d) => d.audit_name === row.audit_name)) merged.push(row);
      }

      setConfigs(merged);
      setLogs(l.logs || []);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent('/jeepney-personal/audit')}`);
      return;
    }
    load();
  }, [user, authLoading, router, load]);

  const setDraft = (auditName, field, value) => {
    setDrafts((prev) => ({
      ...prev,
      [auditName]: { ...prev[auditName], [field]: value },
    }));
  };

  const effective = (cfg) => ({
    threshold: drafts[cfg.audit_name]?.threshold ?? cfg.threshold,
    enabled: drafts[cfg.audit_name]?.enabled ?? cfg.enabled,
  });

  const saveConfig = async (cfg) => {
    const eff = effective(cfg);
    setSavingKey(cfg.audit_name);
    try {
      const body = {
        audit_name: cfg.audit_name,
        description: cfg.description || null,
        threshold: Number(eff.threshold),
        enabled: Boolean(eff.enabled),
      };
      await apiPost('/api/audit/config', body);
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[cfg.audit_name];
        return next;
      });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingKey(null);
    }
  };

  const toggleEnabled = (cfg) => {
    const eff = effective(cfg);
    setDraft(cfg.audit_name, 'enabled', !eff.enabled);
  };

  const isDirty = (cfg) => {
    const d = drafts[cfg.audit_name];
    if (!d) return false;
    if (d.threshold !== undefined && Number(d.threshold) !== Number(cfg.threshold)) return true;
    if (d.enabled !== undefined && Boolean(d.enabled) !== Boolean(cfg.enabled)) return true;
    return false;
  };

  return (
    <JeepneyLayout
      title="감시 시스템"
      level={4}
      crumbs={[
        { label: 'Personal', href: '/jeepney-personal' },
        { label: '감시 시스템' },
      ]}
    >
      <section style={S.header}>
        <div>
          <h2 style={S.title}>감시 시스템</h2>
          <p style={S.subtitle}>일일 신뢰도 자동 점검 · 매일 02:00 KST</p>
        </div>
      </section>

      {error && (
        <div style={S.errBox}>
          <p style={S.errText}>오류: {error}</p>
        </div>
      )}

      {loading ? (
        <div style={S.center}>로딩 중…</div>
      ) : (
        <div style={S.stack}>
          <div style={S.card}>
            <h3 style={S.cardTitle}>감시 설정</h3>
            <p style={S.cardHint}>임계값과 활성화 여부를 조정한 후 저장을 누르세요.</p>
            <div style={S.tableWrap}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>이름</th>
                    <th style={S.th}>설명</th>
                    <th style={{ ...S.th, width: 120 }}>임계값</th>
                    <th style={{ ...S.th, width: 90, textAlign: 'center' }}>활성화</th>
                    <th style={{ ...S.th, width: 90, textAlign: 'right' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {configs.map((cfg) => {
                    const eff = effective(cfg);
                    const dirty = isDirty(cfg);
                    return (
                      <tr key={cfg.audit_name}>
                        <td style={S.td}>
                          <span style={S.mono}>{cfg.audit_name}</span>
                        </td>
                        <td style={S.td}>{cfg.description || '-'}</td>
                        <td style={S.td}>
                          <input
                            type="number"
                            step="0.01"
                            value={eff.threshold ?? ''}
                            onChange={(e) => setDraft(cfg.audit_name, 'threshold', e.target.value)}
                            style={S.input}
                          />
                        </td>
                        <td style={{ ...S.td, textAlign: 'center' }}>
                          <button
                            onClick={() => toggleEnabled(cfg)}
                            style={{
                              ...S.toggle,
                              background: eff.enabled ? colors.success : colors.bgTertiary,
                              color: colors.textPrimary,
                            }}
                          >
                            {eff.enabled ? 'ON' : 'OFF'}
                          </button>
                        </td>
                        <td style={{ ...S.td, textAlign: 'right' }}>
                          <button
                            onClick={() => saveConfig(cfg)}
                            disabled={!dirty || savingKey === cfg.audit_name}
                            style={{
                              ...S.saveBtn,
                              opacity: !dirty || savingKey === cfg.audit_name ? 0.5 : 1,
                              cursor: !dirty || savingKey === cfg.audit_name ? 'not-allowed' : 'pointer',
                            }}
                          >
                            {savingKey === cfg.audit_name ? '저장 중…' : '저장'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div style={S.card}>
            <h3 style={S.cardTitle}>최근 점검 결과 (최대 50건)</h3>
            {logs.length === 0 ? (
              <div style={S.empty}>아직 점검 결과가 없습니다. 다음 02:00 KST 실행을 기다려주세요.</div>
            ) : (
              <div style={S.tableWrap}>
                <table style={S.table}>
                  <thead>
                    <tr>
                      <th style={S.th}>실행 시각</th>
                      <th style={S.th}>감시 항목</th>
                      <th style={S.th}>측정값</th>
                      <th style={S.th}>임계값</th>
                      <th style={{ ...S.th, width: 80, textAlign: 'center' }}>상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((row) => (
                      <tr key={row.log_id}>
                        <td style={S.td}>
                          <span style={S.mono}>{new Date(row.run_at).toLocaleString('ko-KR')}</span>
                        </td>
                        <td style={S.td}>
                          <span style={S.mono}>{row.audit_name}</span>
                        </td>
                        <td style={S.td}>{row.measured_value ?? '-'}</td>
                        <td style={S.td}>{row.threshold ?? '-'}</td>
                        <td style={{ ...S.td, textAlign: 'center' }}>
                          <StatusBadge status={row.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </JeepneyLayout>
  );
}

const S = {
  header: {
    marginBottom: spacing['2xl'],
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.lg,
    flexWrap: 'wrap',
  },
  title: {
    margin: 0,
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  subtitle: {
    margin: `${spacing.sm} 0 0`,
    fontSize: typography.sizes.sm,
    color: colors.textTertiary,
  },
  stack: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing['2xl'],
  },
  card: {
    background: colors.bgSecondary,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
  },
  cardTitle: {
    margin: 0,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
  },
  cardHint: {
    margin: `${spacing.sm} 0 ${spacing.lg}`,
    fontSize: typography.sizes.sm,
    color: colors.textTertiary,
  },
  tableWrap: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: typography.sizes.sm,
  },
  th: {
    textAlign: 'left',
    padding: `${spacing.sm} ${spacing.md}`,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
    borderBottom: `1px solid ${colors.borderLight}`,
  },
  td: {
    padding: `${spacing.md}`,
    color: colors.textPrimary,
    borderBottom: `1px solid ${colors.borderDark}`,
  },
  mono: {
    fontFamily: typography.fonts.mono,
    fontSize: typography.sizes.xs,
  },
  input: {
    width: '100%',
    padding: `${spacing.sm} ${spacing.md}`,
    background: colors.bgPrimary,
    color: colors.textPrimary,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: borderRadius.sm,
    fontSize: typography.sizes.sm,
  },
  toggle: {
    padding: `${spacing.xs} ${spacing.md}`,
    border: 'none',
    borderRadius: borderRadius.sm,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    cursor: 'pointer',
    minWidth: 56,
  },
  saveBtn: {
    padding: `${spacing.sm} ${spacing.lg}`,
    background: colors.accentCyan,
    color: colors.bgPrimary,
    border: 'none',
    borderRadius: borderRadius.sm,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  empty: {
    padding: spacing.xl,
    textAlign: 'center',
    color: colors.textTertiary,
    fontSize: typography.sizes.sm,
  },
  center: {
    textAlign: 'center',
    padding: spacing['3xl'],
    color: colors.textSecondary,
  },
  errBox: {
    padding: spacing.lg,
    background: `${colors.error}20`,
    border: `1px solid ${colors.error}`,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
  },
  errText: {
    margin: 0,
    color: colors.error,
    fontSize: typography.sizes.sm,
  },
};
