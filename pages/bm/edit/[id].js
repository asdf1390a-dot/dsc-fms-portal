// pages/bm/edit/[id].js
// BM 이력 수정 페이지 — 관리자/보전팀용 전체 편집 폼
// 자산(asset)은 읽기 전용. 나머지 필드 수정 후 저장.

import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../lib/use-auth';
import BottomNav from '../../../components/BottomNav';
import BMStatusBadge from '../../../components/bm/BMStatusBadge';

const STATUS_OPTIONS = [
  { v: 'open',          ko: '접수' },
  { v: 'in_progress',   ko: '진행중' },
  { v: 'pending_parts', ko: '부품대기' },
  { v: 'resolved',      ko: '완료' },
  { v: 'wontfix',       ko: '미처리' },
  { v: 'cancelled',     ko: '취소' },
];
const SEVERITY_OPTIONS = [
  { v: 'minor',     ko: '경미',     color: '#64748b' },
  { v: 'normal',    ko: '정상',    color: '#2563eb' },
  { v: 'major',     ko: '주요',     color: '#f97316' },
  { v: 'line_down', ko: '라인다운', color: '#dc2626' },
];

function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocalInput(s) {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

export default function BMEditPage() {
  const router = useRouter();
  const { id } = router.query;
  const { user, isAuthed, loading: authLoading, fullName } = useAuth();

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [savedFlash, setSavedFlash] = useState(false);

  // Form state
  const [status, setStatus] = useState('open');
  const [severity, setSeverity] = useState('normal');
  const [symptom, setSymptom] = useState('');
  const [symptomTa, setSymptomTa] = useState('');
  const [cause, setCause] = useState('');
  const [actionTaken, setActionTaken] = useState('');
  const [reporterName, setReporterName] = useState('');
  const [resolverName, setResolverName] = useState('');
  const [downtimeStart, setDowntimeStart] = useState('');
  const [downtimeEnd, setDowntimeEnd] = useState('');

  // Auth guard
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthed) {
      router.replace(`/login?next=${encodeURIComponent(`/bm/edit/${id || ''}`)}`);
    }
  }, [authLoading, isAuthed, id, router]);

  // Load event
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('bm_events')
        .select('*, assets(machine_asset_number, name_en, location)')
        .eq('id', id)
        .maybeSingle();
      if (cancelled) return;
      if (error) { setError(error.message); setLoading(false); return; }
      if (!data) { setError('찾을 수 없습니다'); setLoading(false); return; }
      setEvent(data);
      setStatus(data.status || 'open');
      setSeverity(data.severity || 'normal');
      setSymptom(data.symptom || '');
      setSymptomTa(data.symptom_ta || '');
      setCause(data.cause || '');
      setActionTaken(data.action_taken || '');
      setReporterName(data.reporter_name || '');
      setResolverName(data.resolver_name || '');
      setDowntimeStart(toLocalInput(data.downtime_start || data.reported_at));
      setDowntimeEnd(toLocalInput(data.downtime_end || data.resolved_at));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id]);

  async function save() {
    if (!event) return;
    setError(null);

    const dsIso = fromLocalInput(downtimeStart);
    const deIso = fromLocalInput(downtimeEnd);
    if (dsIso && deIso && new Date(deIso) < new Date(dsIso)) {
      setError('완료 시각이 시작 시각보다 빠를 수 없습니다.');
      return;
    }

    setBusy(true);
    try {
      const patch = {
        status,
        severity,
        symptom,
        symptom_ta: symptomTa || null,
        cause,
        action_taken: actionTaken,
        reporter_name: reporterName || null,
        downtime_start: dsIso,
        downtime_end: deIso,
      };

      // resolved 전환 시 자동 보강
      if (status === 'resolved') {
        const resIso = deIso || new Date().toISOString();
        patch.resolved_at = event.resolved_at || resIso;
        patch.downtime_end = patch.downtime_end || resIso;
        patch.resolver_name = resolverName || event.resolver_name || fullName || user?.email || null;
        patch.resolved_by = event.resolved_by || user?.id || null;
      } else {
        // status를 resolved에서 다른 값으로 되돌릴 때: resolved_at 유지 (이력 보존)
        patch.resolver_name = resolverName || null;
      }

      const { error: upErr } = await supabase
        .from('bm_events')
        .update(patch)
        .eq('id', event.id);
      if (upErr) throw upErr;

      setSavedFlash(true);
      setTimeout(() => {
        router.replace(`/bm/${event.id}`);
      }, 700);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Head>
        <title>BM 수정 | DSC FMS</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#0f172a" />
      </Head>
      <main style={S.page}>
        <header style={S.header}>
          <Link href={id ? `/bm/${id}` : '/bm'} style={S.backLink} aria-label="돌아가기">← 취소</Link>
          <div style={S.headerTitleWrap}>
            <div style={S.headerTitle}>BM 수정</div>
            {event?.assets?.machine_asset_number && (
              <div style={S.headerSubtitle}>{event.assets.machine_asset_number}</div>
            )}
          </div>
          <div style={{ width: 44 }} />
        </header>

        {loading && <div style={S.loading}>불러오는 중…</div>}
        {error && <div style={S.errorBox}>{error}</div>}

        {event && (
          <div style={S.content}>
            {/* 자산 (읽기 전용) */}
            <Section title="자산 (읽기 전용)">
              <div style={S.readonlyAsset}>
                <div style={S.assetTag}>{event.assets?.machine_asset_number || '—'}</div>
                {event.assets?.name_en && (
                  <div style={S.assetName}>{event.assets.name_en}</div>
                )}
                {event.assets?.location && (
                  <div style={S.assetLoc}>📍 {event.assets.location}</div>
                )}
              </div>
            </Section>

            {/* 상태 */}
            <Section title="상태">
              <div style={{ marginBottom: 8 }}>
                <BMStatusBadge status={status} />
              </div>
              <select value={status} onChange={(e) => setStatus(e.target.value)} style={S.input}>
                {STATUS_OPTIONS.map(o => (
                  <option key={o.v} value={o.v}>{o.ko}</option>
                ))}
              </select>
            </Section>

            {/* 심각도 */}
            <Section title="심각도">
              <div style={S.severityGrid}>
                {SEVERITY_OPTIONS.map(o => {
                  const active = severity === o.v;
                  return (
                    <button
                      key={o.v}
                      type="button"
                      onClick={() => setSeverity(o.v)}
                      style={{
                        ...S.sevBtn,
                        ...(active ? { background: o.color, color: '#fff', borderColor: o.color } : null),
                      }}
                    >{o.ko}</button>
                  );
                })}
              </div>
            </Section>

            {/* 증상 */}
            <Section title="증상">
              <textarea
                value={symptom}
                onChange={(e) => setSymptom(e.target.value)}
                placeholder="어떤 문제가 발생했나요?"
                style={{ ...S.input, height: 80 }}
              />
              <textarea
                value={symptomTa}
                onChange={(e) => setSymptomTa(e.target.value)}
                placeholder="(타밀어, 선택사항)"
                style={{ ...S.input, height: 60, marginTop: 8, fontStyle: 'italic' }}
              />
            </Section>

            {/* 시간 */}
            <Section title="시간">
              <div style={S.fieldRow}>
                <label style={S.fieldLabel}>고장 시작</label>
                <input
                  type="datetime-local"
                  value={downtimeStart}
                  onChange={(e) => setDowntimeStart(e.target.value)}
                  style={S.input}
                />
              </div>
              <div style={{ ...S.fieldRow, marginTop: 10 }}>
                <label style={S.fieldLabel}>수리 완료</label>
                <input
                  type="datetime-local"
                  value={downtimeEnd}
                  onChange={(e) => setDowntimeEnd(e.target.value)}
                  style={S.input}
                />
              </div>
            </Section>

            {/* 원인 */}
            <Section title="원인">
              <textarea
                value={cause}
                onChange={(e) => setCause(e.target.value)}
                placeholder="왜 발생했나요?"
                style={{ ...S.input, height: 80 }}
              />
            </Section>

            {/* 조치 */}
            <Section title="조치 내용">
              <textarea
                value={actionTaken}
                onChange={(e) => setActionTaken(e.target.value)}
                placeholder="어떻게 조치했나요?"
                style={{ ...S.input, height: 100 }}
              />
            </Section>

            {/* 담당자 */}
            <Section title="담당자">
              <div style={S.fieldRow}>
                <label style={S.fieldLabel}>신고자</label>
                <input
                  type="text"
                  value={reporterName}
                  onChange={(e) => setReporterName(e.target.value)}
                  placeholder="이름"
                  style={S.input}
                />
              </div>
              <div style={{ ...S.fieldRow, marginTop: 10 }}>
                <label style={S.fieldLabel}>처리자</label>
                <input
                  type="text"
                  value={resolverName}
                  onChange={(e) => setResolverName(e.target.value)}
                  placeholder="이름"
                  style={S.input}
                />
              </div>
            </Section>

            {/* 액션 */}
            <div style={S.primaryActions}>
              <Link
                href={`/bm/${event.id}`}
                style={{ ...S.btn, ...S.btnSecondary, textAlign: 'center', textDecoration: 'none', lineHeight: '20px' }}
              >취소</Link>
              <button
                type="button"
                onClick={save}
                disabled={busy}
                style={{
                  ...S.btn, ...S.btnPrimary,
                  ...(busy ? S.btnDisabled : null),
                }}
              >{busy ? '저장 중…' : '저장'}</button>
            </div>

            {savedFlash && <div style={S.savedFlash}>✓ 저장되었습니다</div>}
          </div>
        )}
      </main>
      <BottomNav />
    </>
  );
}

function Section({ title, children }) {
  return (
    <section style={S.section}>
      <div style={S.sectionTitle}>{title}</div>
      <div style={S.sectionBody}>{children}</div>
    </section>
  );
}

const S = {
  page: {
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans Tamil", "Noto Sans KR", sans-serif',
    background: '#0f172a', minHeight: '100vh', color: '#e2e8f0',
    paddingBottom: 'calc(60px + env(safe-area-inset-bottom, 0px) + 24px)',
    maxWidth: 480, margin: '0 auto',
  },
  header: {
    position: 'sticky', top: 0, zIndex: 20,
    background: '#0f172a', borderBottom: '1px solid #1f2937',
    padding: '10px 14px',
    display: 'flex', alignItems: 'center', gap: 10,
    boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
  },
  backLink: {
    color: '#94a3b8', textDecoration: 'none', fontSize: 14,
    minHeight: 44, minWidth: 44,
    display: 'inline-flex', alignItems: 'center', padding: '0 4px',
  },
  headerTitleWrap: { flex: 1, minWidth: 0, textAlign: 'center' },
  headerTitle: { fontSize: 15, fontWeight: 700, color: '#f8fafc' },
  headerSubtitle: {
    fontSize: 11, color: '#94a3b8', marginTop: 1,
    fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
  },
  loading: { padding: 48, textAlign: 'center', color: '#64748b' },
  errorBox: {
    margin: 14, padding: 14,
    background: 'rgba(220,38,38,0.15)', color: '#fca5a5',
    border: '1px solid rgba(220,38,38,0.4)',
    borderRadius: 10, fontSize: 14,
  },
  content: { padding: 14 },
  section: {
    background: '#1e293b', borderRadius: 12, marginBottom: 10,
    border: '1px solid #1f2937', overflow: 'hidden',
    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
  },
  sectionTitle: {
    padding: '10px 14px', fontSize: 11, fontWeight: 700,
    color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.6,
    background: '#0f172a', borderBottom: '1px solid #1f2937',
  },
  sectionBody: { padding: 14 },
  readonlyAsset: {
    padding: 10, background: '#0b1220',
    border: '1px solid #1f2937', borderRadius: 8,
  },
  assetTag: {
    fontSize: 15, fontWeight: 700, color: '#f8fafc',
    fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
  },
  assetName: { fontSize: 13, color: '#cbd5e1', marginTop: 3 },
  assetLoc: { fontSize: 12, color: '#94a3b8', marginTop: 3 },
  input: {
    width: '100%', padding: '12px',
    border: '1px solid #334155', borderRadius: 8,
    fontSize: 16, outline: 'none', boxSizing: 'border-box',
    background: '#0b1220', color: '#f1f5f9',
    fontFamily: 'inherit', resize: 'vertical', minHeight: 44,
  },
  fieldRow: { display: 'flex', flexDirection: 'column', gap: 6 },
  fieldLabel: { fontSize: 12, color: '#94a3b8', fontWeight: 600 },
  severityGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  sevBtn: {
    padding: '12px', minHeight: 44,
    border: '1px solid #334155', background: '#0b1220',
    color: '#cbd5e1', borderRadius: 8,
    fontSize: 13, fontWeight: 700, cursor: 'pointer',
  },
  primaryActions: {
    display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10,
    margin: '6px 0 12px',
  },
  btn: {
    padding: '14px', borderRadius: 10, border: 'none',
    fontSize: 14, fontWeight: 700, cursor: 'pointer', minHeight: 48,
  },
  btnPrimary: { background: '#2563eb', color: '#fff' },
  btnSecondary: { background: '#334155', color: '#e2e8f0', border: '1px solid #475569' },
  btnDisabled: { background: '#1f2937', color: '#475569', cursor: 'not-allowed' },
  savedFlash: {
    background: 'rgba(34,197,94,0.18)', color: '#86efac',
    border: '1px solid rgba(34,197,94,0.5)',
    padding: '10px 14px', borderRadius: 8, marginBottom: 12,
    fontSize: 13, textAlign: 'center', fontWeight: 600,
  },
};
