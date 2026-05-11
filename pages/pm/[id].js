import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/use-auth';
import BottomNav from '../../components/BottomNav';

// ── Status meta ───────────────────────────────────────────────────────
const STATUS_META = {
  pending:     { label: '예정',   fg: '#93c5fd', bg: 'rgba(37,99,235,0.18)',  border: 'rgba(37,99,235,0.6)',  bar: '#2563eb' },
  in_progress: { label: '진행중', fg: '#fdba74', bg: 'rgba(249,115,22,0.18)', border: 'rgba(249,115,22,0.6)', bar: '#f97316' },
  completed:   { label: '완료',   fg: '#86efac', bg: 'rgba(34,197,94,0.18)',  border: 'rgba(34,197,94,0.6)',  bar: '#16a34a' },
  skipped:     { label: '건너뜀', fg: '#94a3b8', bg: 'rgba(100,116,139,0.2)', border: 'rgba(100,116,139,0.5)', bar: '#64748b' },
};

function getDday(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr);
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

export default function PMDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const { user, isAuthed, fullName } = useAuth();

  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [completedByName, setCompletedByName] = useState('');
  const [actualHours, setActualHours] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [showCompleteForm, setShowCompleteForm] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  // ── Fetch ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const { data, error: fetchErr } = await supabase
        .from('pm_schedules')
        .select(`id, scheduled_date, status, completed_at, completed_by_name, actual_hours, notes, created_at, plan_id, asset_id, pm_plans(id, title, description, frequency_days, estimated_hours), assets(machine_asset_number, name_en, location)`)
        .eq('id', id)
        .maybeSingle();
      if (cancelled) return;
      if (fetchErr) { setError(fetchErr.message); setLoading(false); return; }
      if (!data) { setError('일정을 찾을 수 없습니다'); setLoading(false); return; }
      setSchedule(data);
      setActualHours(data.actual_hours ? String(data.actual_hours) : '');
      setNotes(data.notes || '');
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id]);

  // ── Prefill completed_by_name from auth ──────────────────────────────
  useEffect(() => {
    if (fullName && !completedByName) setCompletedByName(fullName);
  }, [fullName]); // eslint-disable-line react-hooks/exhaustive-deps

  async function completeNow() {
    if (!completedByName.trim()) { setError('완료자 이름을 입력하세요'); return; }
    setBusy(true);
    setError(null);
    try {
      const now = new Date().toISOString();
      const { error: updErr } = await supabase.from('pm_schedules').update({
        status: 'completed',
        completed_at: now,
        completed_by: user?.id || null,
        completed_by_name: completedByName.trim(),
        actual_hours: actualHours ? parseFloat(actualHours) : null,
        notes: notes.trim() || null,
      }).eq('id', schedule.id);
      if (updErr) throw updErr;

      // Auto-create next schedule
      const freqDays = schedule.pm_plans?.frequency_days || 30;
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + freqDays);
      const p = n => String(n).padStart(2, '0');
      const nextDateStr = `${nextDate.getFullYear()}-${p(nextDate.getMonth() + 1)}-${p(nextDate.getDate())}`;
      await supabase.from('pm_schedules').insert({
        plan_id: schedule.plan_id,
        asset_id: schedule.asset_id,
        scheduled_date: nextDateStr,
        status: 'pending',
      });

      setSchedule(prev => ({
        ...prev,
        status: 'completed',
        completed_at: now,
        completed_by_name: completedByName.trim(),
        actual_hours: actualHours ? parseFloat(actualHours) : null,
        notes: notes.trim() || null,
      }));

      // Fire-and-forget Discord notification
      fetch('/api/discord-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'pm_completed',
          title: schedule?.pm_plans?.title || 'PM 완료',
          fields: [
            { name: '자산', value: schedule?.assets?.machine_asset_number || '-' },
            { name: '실제시간', value: actualHours ? `${actualHours}h` : '-' },
            { name: '완료자', value: completedByName.trim() || '-' },
          ],
        }),
      }).catch(() => {});

      setShowCompleteForm(false);
      setSavedFlash('completed');
      setTimeout(() => setSavedFlash(false), 2500);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setBusy(false);
    }
  }

  async function skipNow() {
    setBusy(true);
    setError(null);
    try {
      const { error: updErr } = await supabase.from('pm_schedules').update({ status: 'skipped' }).eq('id', schedule.id);
      if (updErr) throw updErr;
      setSchedule(prev => ({ ...prev, status: 'skipped' }));
      setSavedFlash('skipped');
      setTimeout(() => setSavedFlash(false), 2500);
      setTimeout(() => setSavedFlash(false), 2500);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setBusy(false);
    }
  }

  const meta = schedule ? (STATUS_META[schedule.status] || STATUS_META.pending) : STATUS_META.pending;
  const plan = schedule?.pm_plans || {};
  const asset = schedule?.assets || {};
  const canAct = isAuthed && schedule && (schedule.status === 'pending' || schedule.status === 'in_progress');

  return (
    <>
      <Head>
        <title>PM 상세 | DSC FMS</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#0f172a" />
      </Head>

      <main style={S.page}>
        <header style={S.header}>
          <Link href="/pm" style={S.backLink}>← PM</Link>
          <div style={S.headerTitleWrap}>
            <div style={S.headerTitle}>{asset.machine_asset_number || 'PM 상세'}</div>
            {asset.name_en && <div style={S.headerSubtitle}>{asset.name_en}</div>}
          </div>
          <div style={{ minWidth: 40 }} />
        </header>

        {loading ? (
          <div style={S.loading}>불러오는 중…</div>
        ) : error && !schedule ? (
          <div style={S.errorBox}>{error}</div>
        ) : schedule ? (
          <div style={S.content}>
            {/* Hero */}
            <div style={S.heroCard}>
              <span style={{ ...S.heroBar, background: meta.bar }} />
              <div style={S.heroBody}>
                <div style={S.heroPillRow}>
                  <span style={{ ...S.statusPill, color: meta.fg, background: meta.bg, border: `1px solid ${meta.border}` }}>
                    {meta.label}
                  </span>
                  {schedule.status !== 'completed' && schedule.status !== 'skipped' && (
                    <span style={S.ddayText}>{getDday(schedule.scheduled_date)}</span>
                  )}
                </div>
                <div style={S.heroSchedDate}>예정일 {schedule.scheduled_date}</div>
              </div>
            </div>

            <Section title="작업 정보">
              <div style={S.taskTitleLg}>{plan.title || '(작업명 없음)'}</div>
              {plan.description && <div style={S.taskDesc}>{plan.description}</div>}
              <div style={S.metaRow}>
                <span>주기 {plan.frequency_days || '—'}일</span>
                {plan.estimated_hours && <span>· 예상 {plan.estimated_hours}h</span>}
              </div>
            </Section>

            <Section title="자산">
              <Row label="자산번호" value={asset.machine_asset_number} />
              <Row label="자산명" value={asset.name_en} />
              <Row label="위치" value={asset.location} />
            </Section>

            {savedFlash && <div style={S.savedFlash}>{savedFlash === 'skipped' ? '건너뜀 처리되었습니다' : '✓ 완료 처리되었습니다'}</div>}

            {canAct && !showCompleteForm && (
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
                  onClick={skipNow}
                  style={{ ...S.btn, ...S.btnSkip }}
                  disabled={busy}
                >
                  건너뜀
                </button>
              </div>
            )}

            {canAct && showCompleteForm && (
              <Section title="완료 처리">
                <div style={S.fieldGap}>
                  <div style={S.fieldLabel}>완료자 *</div>
                  <input
                    type="text"
                    value={completedByName}
                    onChange={e => setCompletedByName(e.target.value)}
                    placeholder="이름"
                    style={S.input}
                  />
                </div>
                <div style={S.fieldGap}>
                  <div style={S.fieldLabel}>실제 작업시간 (시간)</div>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={actualHours}
                    onChange={e => setActualHours(e.target.value)}
                    placeholder="예: 1.5"
                    style={S.input}
                  />
                </div>
                <div style={S.fieldGap}>
                  <div style={S.fieldLabel}>메모</div>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="작업 중 발견사항"
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

            {schedule.status === 'completed' && (
              <Section title="완료 정보">
                <Row label="완료자" value={schedule.completed_by_name} />
                <Row label="완료시각" value={formatDateTime(schedule.completed_at)} />
                <Row label="실제 작업시간" value={schedule.actual_hours ? `${schedule.actual_hours}h` : null} />
                <Row label="메모" value={schedule.notes} />
              </Section>
            )}

            {!isAuthed && (schedule.status === 'pending' || schedule.status === 'in_progress') && (
              <div style={S.loginHint}>
                완료 처리하려면 <Link href={`/login?next=${encodeURIComponent(`/pm/${id}`)}`} style={{ color: '#60a5fa' }}>로그인</Link>이 필요합니다.
              </div>
            )}

            {error && schedule && <div style={{ ...S.errorBox, marginTop: 8 }}>{error}</div>}
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

function Row({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', gap: 12, padding: '8px 0', fontSize: 13, borderBottom: '1px solid #1f2937' }}>
      <span style={{ color: '#64748b', minWidth: 100, flexShrink: 0 }}>{label}</span>
      <span style={{ color: '#e2e8f0', flex: 1, wordBreak: 'break-word' }}>{value}</span>
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
  heroPillRow: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 },
  statusPill: { fontSize: 12, fontWeight: 800, padding: '4px 10px', borderRadius: 999 },
  ddayText: { fontSize: 14, fontWeight: 800, color: '#fbbf24', fontFamily: 'ui-monospace,Menlo,monospace' },
  heroSchedDate: { fontSize: 14, color: '#cbd5e1', fontFamily: 'ui-monospace,Menlo,monospace' },
  taskTitleLg: { fontSize: 17, fontWeight: 700, color: '#f8fafc', marginBottom: 6 },
  taskDesc: { fontSize: 13, color: '#cbd5e1', lineHeight: 1.5, marginBottom: 10, whiteSpace: 'pre-wrap' },
  metaRow: { display: 'flex', gap: 8, fontSize: 12, color: '#64748b' },
  actionGrid: { display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10, marginBottom: 10 },
  btn: { padding: '14px', borderRadius: 12, border: 'none', fontSize: 15, fontWeight: 700, cursor: 'pointer', minHeight: 52 },
  btnComplete: { background: '#16a34a', color: '#fff', boxShadow: '0 4px 12px rgba(22,163,74,0.4)' },
  btnSkip: { background: '#334155', color: '#cbd5e1' },
  btnSecondary: { background: '#334155', color: '#e2e8f0', flex: 1 },
  btnDisabled: { background: '#1f2937', color: '#475569', cursor: 'not-allowed', boxShadow: 'none', flex: 1 },
  fieldGap: { marginBottom: 10 },
  fieldLabel: { fontSize: 12, color: '#94a3b8', marginBottom: 6, fontWeight: 600 },
  input: { width: '100%', padding: '12px 14px', border: '1px solid #334155', borderRadius: 10, fontSize: 16, outline: 'none', boxSizing: 'border-box', background: '#0b1220', color: '#f1f5f9', minHeight: 48 },
  textarea: { height: 90, fontFamily: 'inherit', resize: 'vertical' },
  savedFlash: { background: 'rgba(34,197,94,0.18)', color: '#86efac', border: '1px solid rgba(34,197,94,0.5)', padding: 12, borderRadius: 10, fontSize: 13, marginBottom: 10, textAlign: 'center', fontWeight: 700 },
  loading: { padding: 48, textAlign: 'center', color: '#64748b' },
  errorBox: { margin: 14, padding: 14, background: 'rgba(220,38,38,0.15)', color: '#fca5a5', border: '1px solid rgba(220,38,38,0.4)', borderRadius: 10, fontSize: 14 },
  loginHint: { padding: 14, fontSize: 13, color: '#94a3b8', textAlign: 'center', background: '#1e293b', borderRadius: 10, border: '1px solid #1f2937' },
};
