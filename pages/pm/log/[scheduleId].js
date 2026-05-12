import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../../lib/supabase';

// 현장 작업일지 입력 — 공개 접근 (작업자가 휴대폰에서 바로 기록)
export default function PMLogPage() {
  const router = useRouter();
  const { scheduleId } = router.query;

  const [schedule, setSchedule] = useState(null);
  const [plan, setPlan] = useState(null);
  const [asset, setAsset] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  // form state
  const [workerName, setWorkerName] = useState('');
  const [result, setResult] = useState('normal'); // normal | abnormal | skipped
  const [notes, setNotes] = useState('');
  const [checklistDone, setChecklistDone] = useState([]); // [bool]
  const [parts, setParts] = useState([]); // [{part_name, quantity, unit}]

  useEffect(() => {
    if (!scheduleId) return;
    let cancelled = false;
    (async () => {
      setLoading(true); setError(null);
      try {
        const { data: s, error: se } = await supabase
          .from('pm_schedules')
          .select('id, plan_id, scheduled_date, status')
          .eq('id', scheduleId).maybeSingle();
        if (se) throw se;
        if (cancelled) return;
        setSchedule(s);

        if (s?.plan_id) {
          const { data: p } = await supabase
            .from('pm_plans')
            .select('id, title, asset_id, frequency_label, frequency_days, checklist')
            .eq('id', s.plan_id).maybeSingle();
          if (cancelled) return;
          setPlan(p);
          const cl = Array.isArray(p?.checklist) ? p.checklist : [];
          setChecklistDone(cl.map(() => false));

          if (p?.asset_id) {
            const { data: a } = await supabase
              .from('assets')
              .select('id, machine_asset_number, name_en, name_ko, location')
              .eq('id', p.asset_id).maybeSingle();
            if (!cancelled) setAsset(a);
          }
        }
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [scheduleId]);

  const checklist = Array.isArray(plan?.checklist) ? plan.checklist : [];

  function toggleItem(i) {
    setChecklistDone(prev => {
      const next = [...prev];
      next[i] = !next[i];
      return next;
    });
  }

  function addPart() {
    setParts(prev => [...prev, { part_name: '', quantity: '', unit: 'EA' }]);
  }
  function updatePart(i, key, val) {
    setParts(prev => prev.map((p, idx) => idx === i ? { ...p, [key]: val } : p));
  }
  function removePart(i) {
    setParts(prev => prev.filter((_, idx) => idx !== i));
  }

  async function handleSave() {
    if (!workerName.trim()) {
      alert('작업자 이름을 입력하세요');
      return;
    }
    setSaving(true); setError(null);
    try {
      const newStatus = result === 'skipped' ? 'skipped' : 'done';
      // 1) insert work log
      const { data: log, error: le } = await supabase
        .from('pm_work_logs')
        .insert({
          schedule_id: scheduleId,
          worker_name: workerName.trim(),
          completed_at: new Date().toISOString(),
          result,
          notes: notes.trim() || null,
          checklist_done: checklist.map((c, i) => ({
            item: typeof c === 'string' ? c : (c.label || c.title || c.text || ''),
            done: !!checklistDone[i],
          })),
        })
        .select('id')
        .single();
      if (le) throw le;

      // 2) parts used
      const validParts = parts.filter(p => p.part_name.trim() && p.quantity);
      if (validParts.length > 0 && log?.id) {
        const rows = validParts.map(p => ({
          log_id: log.id,
          part_name: p.part_name.trim(),
          quantity: Number(p.quantity) || 0,
          unit: p.unit || 'EA',
        }));
        const { error: pe } = await supabase.from('pm_parts_used').insert(rows);
        if (pe) throw pe;
      }

      // 3) update schedule status
      await supabase.from('pm_schedules').update({ status: newStatus }).eq('id', scheduleId);

      setSavedFlash(true);
      setTimeout(() => {
        router.push(`/pm/plans/${plan?.id || ''}`);
      }, 800);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Head>
        <title>작업일지 기록 | DSC FMS</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </Head>
      <main style={S.page}>
        <header style={S.header}>
          <Link href={plan?.id ? `/pm/plans/${plan.id}` : '/pm'} style={S.back}>←</Link>
          <h1 style={S.title}>작업일지 기록</h1>
        </header>

        {error && <div style={S.errorBox}>{error}</div>}
        {savedFlash && <div style={S.flashBox}>저장 완료!</div>}

        {loading ? (
          <div style={S.loading}>불러오는 중…</div>
        ) : (
          <div style={S.section}>
            {/* 일정 정보 */}
            <div style={S.card}>
              <div style={S.cardTitle}>일정 정보</div>
              <div style={S.kvRow}><span style={S.k}>계획명</span><span style={S.v}>{plan?.title || '—'}</span></div>
              <div style={S.kvRow}>
                <span style={S.k}>설비</span>
                <span style={S.v}>{asset ? `${asset.machine_asset_number || '—'} · ${asset.name_en || asset.name_ko || ''}` : '—'}</span>
              </div>
              <div style={S.kvRow}><span style={S.k}>예정일</span><span style={S.v}>{schedule?.scheduled_date || '—'}</span></div>
            </div>

            {/* 작업자 */}
            <div style={S.card}>
              <label style={S.label}>작업자 *</label>
              <input
                type="text" value={workerName}
                onChange={e => setWorkerName(e.target.value)}
                placeholder="이름 입력"
                style={S.input}
              />
            </div>

            {/* 체크리스트 */}
            {checklist.length > 0 && (
              <div style={S.card}>
                <div style={S.cardTitle}>체크리스트 ({checklistDone.filter(Boolean).length}/{checklist.length})</div>
                <ul style={S.checkList}>
                  {checklist.map((c, i) => {
                    const label = typeof c === 'string' ? c : (c.label || c.title || c.text || '');
                    return (
                      <li key={i} style={S.checkItem} onClick={() => toggleItem(i)}>
                        <span style={{
                          ...S.checkBox,
                          background: checklistDone[i] ? '#22c55e' : '#0b1220',
                          borderColor: checklistDone[i] ? '#22c55e' : '#334155',
                        }}>
                          {checklistDone[i] && <span style={S.checkMark}>✓</span>}
                        </span>
                        <span style={{
                          ...S.checkLabel,
                          color: checklistDone[i] ? '#94a3b8' : '#f1f5f9',
                          textDecoration: checklistDone[i] ? 'line-through' : 'none',
                        }}>{label}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* 결과 */}
            <div style={S.card}>
              <div style={S.cardTitle}>결과</div>
              <div style={S.resultGrid}>
                {[
                  { k: 'normal', label: '정상', color: '#22c55e' },
                  { k: 'abnormal', label: '이상', color: '#ef4444' },
                  { k: 'skipped', label: '건너뜀', color: '#94a3b8' },
                ].map(r => (
                  <button
                    key={r.k}
                    type="button"
                    onClick={() => setResult(r.k)}
                    style={{
                      ...S.resultBtn,
                      background: result === r.k ? r.color : '#0b1220',
                      color: result === r.k ? '#fff' : '#cbd5e1',
                      borderColor: result === r.k ? r.color : '#334155',
                    }}
                  >{r.label}</button>
                ))}
              </div>
            </div>

            {/* 메모 */}
            <div style={S.card}>
              <label style={S.label}>메모</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="특이사항, 발견된 문제 등"
                style={{ ...S.input, minHeight: 80, resize: 'vertical' }}
              />
            </div>

            {/* 사용부품 */}
            <div style={S.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={S.cardTitle}>사용부품 (선택)</span>
                <button type="button" onClick={addPart} style={S.smallBtn}>+ 추가</button>
              </div>
              {parts.length === 0 ? (
                <div style={S.muted}>없음</div>
              ) : (
                parts.map((p, i) => (
                  <div key={i} style={S.partRow}>
                    <input
                      type="text" value={p.part_name}
                      onChange={e => updatePart(i, 'part_name', e.target.value)}
                      placeholder="부품명"
                      style={{ ...S.input, flex: 2 }}
                    />
                    <input
                      type="number" inputMode="decimal" value={p.quantity}
                      onChange={e => updatePart(i, 'quantity', e.target.value)}
                      placeholder="수량"
                      style={{ ...S.input, flex: 1 }}
                    />
                    <input
                      type="text" value={p.unit}
                      onChange={e => updatePart(i, 'unit', e.target.value)}
                      placeholder="단위"
                      style={{ ...S.input, width: 70 }}
                    />
                    <button type="button" onClick={() => removePart(i)} style={S.removeBtn}>×</button>
                  </div>
                ))
              )}
            </div>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              style={{ ...S.saveBtn, opacity: saving ? 0.6 : 1 }}
            >{saving ? '저장 중…' : '저장'}</button>
          </div>
        )}
      </main>
    </>
  );
}

const S = {
  page: { fontFamily: 'system-ui,-apple-system,sans-serif', background: '#0f172a', minHeight: '100vh', color: '#f1f5f9', maxWidth: 480, margin: '0 auto', paddingBottom: 'calc(env(safe-area-inset-bottom,0px) + 32px)' },
  header: { position: 'sticky', top: 0, zIndex: 20, background: '#0f172a', borderBottom: '1px solid #334155', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 },
  back: { width: 44, height: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', textDecoration: 'none', fontSize: 22, borderRadius: 8 },
  title: { fontSize: 17, fontWeight: 700, flex: 1, margin: 0, color: '#f1f5f9' },
  section: { padding: '12px 14px' },
  card: { background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: 14, marginBottom: 12 },
  cardTitle: { fontSize: 13, fontWeight: 700, color: '#f1f5f9', marginBottom: 10 },
  kvRow: { display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', borderBottom: '1px dashed rgba(148,163,184,0.15)', fontSize: 13 },
  k: { color: '#94a3b8' },
  v: { color: '#f1f5f9', textAlign: 'right', flex: 1 },
  label: { display: 'block', fontSize: 12, color: '#94a3b8', fontWeight: 700, marginBottom: 6 },
  input: { width: '100%', padding: '11px 12px', border: '1px solid #334155', borderRadius: 8, fontSize: 16, background: '#0b1220', color: '#f1f5f9', outline: 'none', boxSizing: 'border-box', minHeight: 44 },
  checkList: { listStyle: 'none', margin: 0, padding: 0 },
  checkItem: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 4px', borderBottom: '1px dashed rgba(148,163,184,0.15)', cursor: 'pointer', minHeight: 44 },
  checkBox: { width: 24, height: 24, borderRadius: 6, border: '1.5px solid', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 120ms' },
  checkMark: { color: '#fff', fontSize: 14, fontWeight: 800 },
  checkLabel: { fontSize: 14, flex: 1 },
  resultGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 },
  resultBtn: { padding: '14px', borderRadius: 10, border: '1.5px solid', fontSize: 14, fontWeight: 700, cursor: 'pointer', minHeight: 48 },
  partRow: { display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 },
  removeBtn: { width: 36, height: 44, border: '1px solid #ef4444', background: 'rgba(239,68,68,0.1)', color: '#fca5a5', borderRadius: 8, fontSize: 18, cursor: 'pointer', flexShrink: 0 },
  smallBtn: { padding: '6px 10px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' },
  saveBtn: { width: '100%', padding: '14px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 700, cursor: 'pointer', minHeight: 50, marginTop: 4 },
  muted: { color: '#64748b', fontSize: 13 },
  loading: { padding: 48, textAlign: 'center', color: '#64748b' },
  errorBox: { margin: 14, padding: 14, background: 'rgba(239,68,68,0.15)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 10 },
  flashBox: { margin: 14, padding: 14, background: 'rgba(34,197,94,0.15)', color: '#86efac', border: '1px solid rgba(34,197,94,0.5)', borderRadius: 10, textAlign: 'center', fontWeight: 700 },
};
