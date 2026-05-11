import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/use-auth';
import BottomNav from '../../components/BottomNav';

// ── Status meta ─────────────────────────────────────────────────────
const STATUS_META = {
  open:          { label: '대기',     fg: '#93c5fd', bg: 'rgba(37,99,235,0.18)',   border: 'rgba(37,99,235,0.6)',   bar: '#2563eb' },
  in_progress:   { label: '진행중',   fg: '#fdba74', bg: 'rgba(249,115,22,0.18)',  border: 'rgba(249,115,22,0.6)',  bar: '#f97316' },
  pending_parts: { label: '부품대기', fg: '#fcd34d', bg: 'rgba(234,179,8,0.18)',   border: 'rgba(234,179,8,0.6)',   bar: '#eab308' },
  completed:     { label: '완료',     fg: '#86efac', bg: 'rgba(34,197,94,0.18)',   border: 'rgba(34,197,94,0.6)',   bar: '#16a34a' },
  cancelled:     { label: '취소',     fg: '#94a3b8', bg: 'rgba(100,116,139,0.2)',  border: 'rgba(100,116,139,0.5)', bar: '#64748b' },
};

const STATUS_OPTIONS = [
  { value: 'open',          label: '대기' },
  { value: 'in_progress',   label: '진행중' },
  { value: 'pending_parts', label: '부품대기' },
  { value: 'completed',     label: '완료' },
  { value: 'cancelled',     label: '취소' },
];

const PRIORITY_LABEL = {
  critical: '긴급',
  high:     '높음',
  medium:   '보통',
  low:      '낮음',
};

const PRIORITY_COLOR = {
  critical: '#dc2626',
  high:     '#f97316',
  medium:   '#2563eb',
  low:      '#64748b',
};

function getDday(dueDateStr) {
  if (!dueDateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dueDateStr);
  const diff = Math.round((d - today) / 86400000);
  if (diff > 0) return `D-${diff}`;
  if (diff === 0) return 'D-DAY';
  return `D+${Math.abs(diff)}`;
}

function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function WorkOrderDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const { isAuthed } = useAuth();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showCompleteForm, setShowCompleteForm] = useState(false);
  const [actualHours, setActualHours] = useState('');
  const [completionNotes, setCompletionNotes] = useState('');
  const [savedFlash, setSavedFlash] = useState(false);

  // ── Fetch ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const { data, error: fetchErr } = await supabase
        .from('work_orders')
        .select('*, assets(machine_asset_number, name_en, location)')
        .eq('id', id)
        .maybeSingle();
      if (cancelled) return;
      if (fetchErr) { setError(fetchErr.message); setLoading(false); return; }
      if (!data) { setError('작업지시를 찾을 수 없습니다'); setLoading(false); return; }
      setOrder(data);
      setActualHours(data.actual_hours ? String(data.actual_hours) : '');
      setCompletionNotes(data.completion_notes || '');
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id]);

  // ── Status change (select) ───────────────────────────────────────
  async function changeStatus(newStatus) {
    if (!order || newStatus === order.status) return;
    // 완료 처리는 별도 폼 사용
    if (newStatus === 'completed') {
      setShowCompleteForm(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const patch = { status: newStatus, updated_at: new Date().toISOString() };
      // 완료 → 다른 상태로 변경 시 completed_at 초기화
      if (order.status === 'completed' && newStatus !== 'completed') {
        patch.completed_at = null;
      }
      const { error: updErr } = await supabase
        .from('work_orders')
        .update(patch)
        .eq('id', order.id);
      if (updErr) throw updErr;
      setOrder(prev => ({ ...prev, ...patch }));
      setSavedFlash(`상태가 "${STATUS_META[newStatus]?.label || newStatus}"(으)로 변경되었습니다`);
      setTimeout(() => setSavedFlash(false), 2500);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setBusy(false);
    }
  }

  // ── Complete with form ───────────────────────────────────────────
  async function completeNow() {
    if (!order) return;
    setBusy(true);
    setError(null);
    try {
      const now = new Date().toISOString();
      const patch = {
        status: 'completed',
        completed_at: now,
        actual_hours: actualHours ? parseFloat(actualHours) : null,
        completion_notes: completionNotes.trim() || null,
        updated_at: now,
      };
      const { error: updErr } = await supabase
        .from('work_orders')
        .update(patch)
        .eq('id', order.id);
      if (updErr) throw updErr;
      setOrder(prev => ({ ...prev, ...patch }));
      setShowCompleteForm(false);
      setSavedFlash('✓ 완료 처리되었습니다');
      setTimeout(() => setSavedFlash(false), 2500);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setBusy(false);
    }
  }

  // ── Cancel ───────────────────────────────────────────────────────
  async function cancelOrder() {
    if (!order) return;
    if (!confirm('이 작업지시를 취소하시겠습니까?')) return;
    setBusy(true);
    setError(null);
    try {
      const patch = { status: 'cancelled', updated_at: new Date().toISOString() };
      const { error: updErr } = await supabase
        .from('work_orders')
        .update(patch)
        .eq('id', order.id);
      if (updErr) throw updErr;
      setOrder(prev => ({ ...prev, ...patch }));
      setSavedFlash('작업이 취소되었습니다');
      setTimeout(() => setSavedFlash(false), 2500);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setBusy(false);
    }
  }

  const meta = order ? (STATUS_META[order.status] || STATUS_META.open) : STATUS_META.open;
  const asset = order?.assets || null;
  const dday = order ? getDday(order.due_date) : null;
  const isClosed = order && (order.status === 'completed' || order.status === 'cancelled');

  return (
    <>
      <Head>
        <title>작업지시 상세 | DSC FMS</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#0f172a" />
      </Head>

      <main style={S.page}>
        <header style={S.header}>
          <Link href="/wo" style={S.backLink}>← WO</Link>
          <div style={S.headerTitleWrap}>
            <div style={S.headerTitle}>{order?.wo_number || '작업지시'}</div>
            {order?.title && <div style={S.headerSubtitle}>{order.title}</div>}
          </div>
          <div style={{ minWidth: 40 }} />
        </header>

        {loading ? (
          <div style={S.loading}>불러오는 중…</div>
        ) : error && !order ? (
          <div style={S.errorBox}>{error}</div>
        ) : order ? (
          <div style={S.content}>
            {/* Hero */}
            <div style={S.heroCard}>
              <span style={{ ...S.heroBar, background: PRIORITY_COLOR[order.priority] || '#64748b' }} />
              <div style={S.heroBody}>
                <div style={S.heroPillRow}>
                  <span style={{ ...S.statusPill, color: meta.fg, background: meta.bg, border: `1px solid ${meta.border}` }}>
                    {meta.label}
                  </span>
                  <span style={{ ...S.priorityPill, color: PRIORITY_COLOR[order.priority] }}>
                    {PRIORITY_LABEL[order.priority] || order.priority}
                  </span>
                  {dday && !isClosed && (
                    <span style={S.ddayText}>{dday}</span>
                  )}
                </div>
                <div style={S.heroTitle}>{order.title}</div>
              </div>
            </div>

            <Section title="상세">
              <Row label="WO 번호" value={order.wo_number} mono />
              <Row label="상태" value={meta.label} />
              <Row label="우선순위" value={PRIORITY_LABEL[order.priority] || order.priority} />
              <Row label="담당자" value={order.assigned_to} />
              <Row label="기한" value={order.due_date} mono />
              <Row label="관련 자산" value={asset ? `${asset.machine_asset_number || ''}${asset.name_en ? ' — ' + asset.name_en : ''}` : null} />
              <Row label="예상시간" value={order.estimated_hours ? `${order.estimated_hours}h` : null} />
              <Row label="등록자" value={order.created_by} />
              <Row label="등록시각" value={formatDateTime(order.created_at)} mono />
              <Row label="작업내용" value={order.description} pre />
            </Section>

            {savedFlash && <div style={S.savedFlash}>{savedFlash}</div>}

            {/* 상태 변경 select */}
            {isAuthed && !isClosed && (
              <Section title="상태 변경">
                <select
                  value={order.status}
                  onChange={e => changeStatus(e.target.value)}
                  style={S.input}
                  disabled={busy}
                >
                  {STATUS_OPTIONS.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
                <div style={S.hint}>상태를 "완료"로 변경하면 완료 정보 입력 폼이 표시됩니다.</div>
              </Section>
            )}

            {/* 완료 처리 폼 */}
            {isAuthed && !isClosed && showCompleteForm && (
              <Section title="완료 처리">
                <div style={S.fieldGap}>
                  <div style={S.fieldLabel}>실제 작업시간 (시간)</div>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={actualHours}
                    onChange={e => setActualHours(e.target.value)}
                    placeholder="예: 2.5"
                    style={S.input}
                  />
                </div>
                <div style={S.fieldGap}>
                  <div style={S.fieldLabel}>완료 메모</div>
                  <textarea
                    value={completionNotes}
                    onChange={e => setCompletionNotes(e.target.value)}
                    placeholder="완료 시 발견사항, 후속 조치"
                    style={{ ...S.input, ...S.textarea }}
                  />
                </div>

                {error && <div style={{ ...S.errorBox, marginTop: 8, marginBottom: 0 }}>{error}</div>}

                <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                  <button
                    type="button"
                    onClick={() => { setShowCompleteForm(false); setError(null); }}
                    style={{ ...S.btn, ...S.btnSecondary }}
                    disabled={busy}
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={completeNow}
                    style={{ ...S.btn, ...(busy ? S.btnDisabled : S.btnComplete) }}
                    disabled={busy}
                  >
                    {busy ? '저장 중…' : '완료 확인'}
                  </button>
                </div>
              </Section>
            )}

            {/* 액션 버튼 */}
            {isAuthed && !isClosed && !showCompleteForm && (
              <div style={S.actionGrid}>
                <button
                  type="button"
                  onClick={() => setShowCompleteForm(true)}
                  style={{ ...S.btn, ...S.btnComplete }}
                  disabled={busy}
                >
                  ✓ 완료 처리
                </button>
                <button
                  type="button"
                  onClick={cancelOrder}
                  style={{ ...S.btn, ...S.btnCancel }}
                  disabled={busy}
                >
                  작업 취소
                </button>
              </div>
            )}

            {order.status === 'completed' && (
              <Section title="완료 정보">
                <Row label="완료시각" value={formatDateTime(order.completed_at)} mono />
                <Row label="실제시간" value={order.actual_hours ? `${order.actual_hours}h` : null} />
                <Row label="완료 메모" value={order.completion_notes} pre />
              </Section>
            )}

            {!isAuthed && !isClosed && (
              <div style={S.loginHint}>
                상태 변경/완료 처리하려면 <Link href={`/login?next=${encodeURIComponent(`/wo/${id}`)}`} style={{ color: '#60a5fa' }}>로그인</Link>이 필요합니다.
              </div>
            )}

            {error && order && <div style={{ ...S.errorBox, marginTop: 8 }}>{error}</div>}
          </div>
        ) : null}
      </main>

      <BottomNav />
    </>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ background: '#1e293b', borderRadius: 12, marginBottom: 10, border: '1px solid #1f2937', overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8, background: '#0f172a', borderBottom: '1px solid #1f2937' }}>{title}</div>
      <div style={{ padding: 14 }}>{children}</div>
    </div>
  );
}

function Row({ label, value, mono, pre }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div style={{ display: 'flex', gap: 12, padding: '8px 0', fontSize: 13, borderBottom: '1px solid #1f2937' }}>
      <span style={{ color: '#64748b', minWidth: 90, flexShrink: 0 }}>{label}</span>
      <span style={{
        color: '#e2e8f0',
        flex: 1,
        wordBreak: 'break-word',
        fontFamily: mono ? 'ui-monospace,Menlo,monospace' : 'inherit',
        whiteSpace: pre ? 'pre-wrap' : 'normal',
      }}>{value}</span>
    </div>
  );
}

const S = {
  page: { fontFamily: 'system-ui,-apple-system,sans-serif', background: '#0f172a', minHeight: '100vh', color: '#e2e8f0', paddingBottom: 'calc(60px + env(safe-area-inset-bottom,0px) + 24px)', maxWidth: 480, margin: '0 auto' },
  header: { position: 'sticky', top: 0, zIndex: 20, background: '#0f172a', borderBottom: '1px solid #1f2937', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.4)' },
  backLink: { color: '#94a3b8', textDecoration: 'none', fontSize: 14, minWidth: 40 },
  headerTitleWrap: { flex: 1, minWidth: 0 },
  headerTitle: { fontSize: 16, fontWeight: 700, color: '#f8fafc', fontFamily: 'ui-monospace,Menlo,monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  headerSubtitle: { fontSize: 12, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  content: { padding: 14 },
  heroCard: { position: 'relative', background: '#1e293b', borderRadius: 12, marginBottom: 10, border: '1px solid #1f2937', overflow: 'hidden' },
  heroBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  heroBody: { padding: '14px 14px 14px 18px' },
  heroPillRow: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' },
  statusPill: { fontSize: 12, fontWeight: 800, padding: '4px 10px', borderRadius: 999 },
  priorityPill: { fontSize: 12, fontWeight: 800 },
  ddayText: { fontSize: 14, fontWeight: 800, color: '#fbbf24', fontFamily: 'ui-monospace,Menlo,monospace' },
  heroTitle: { fontSize: 17, fontWeight: 700, color: '#f8fafc', lineHeight: 1.35 },
  input: { width: '100%', padding: '12px 14px', border: '1px solid #334155', borderRadius: 10, fontSize: 16, outline: 'none', boxSizing: 'border-box', background: '#0b1220', color: '#f1f5f9', minHeight: 48 },
  textarea: { height: 90, fontFamily: 'inherit', resize: 'vertical' },
  hint: { fontSize: 11, color: '#64748b', marginTop: 6 },
  fieldGap: { marginBottom: 10 },
  fieldLabel: { fontSize: 12, color: '#94a3b8', marginBottom: 6, fontWeight: 600 },
  actionGrid: { display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10, marginBottom: 10 },
  btn: { padding: '14px', borderRadius: 12, border: 'none', fontSize: 15, fontWeight: 700, cursor: 'pointer', minHeight: 52 },
  btnComplete: { background: '#16a34a', color: '#fff', boxShadow: '0 4px 12px rgba(22,163,74,0.4)', flex: 1 },
  btnCancel: { background: '#334155', color: '#cbd5e1' },
  btnSecondary: { background: '#334155', color: '#e2e8f0', flex: 1 },
  btnDisabled: { background: '#1f2937', color: '#475569', cursor: 'not-allowed', boxShadow: 'none', flex: 1 },
  savedFlash: { background: 'rgba(34,197,94,0.18)', color: '#86efac', border: '1px solid rgba(34,197,94,0.5)', padding: 12, borderRadius: 10, fontSize: 13, marginBottom: 10, textAlign: 'center', fontWeight: 700 },
  loading: { padding: 48, textAlign: 'center', color: '#64748b' },
  errorBox: { margin: 14, padding: 14, background: 'rgba(220,38,38,0.15)', color: '#fca5a5', border: '1px solid rgba(220,38,38,0.4)', borderRadius: 10, fontSize: 14 },
  loginHint: { padding: 14, fontSize: 13, color: '#94a3b8', textAlign: 'center', background: '#1e293b', borderRadius: 10, border: '1px solid #1f2937' },
};
