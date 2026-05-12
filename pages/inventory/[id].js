import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/use-auth';
import BottomNav from '../../components/BottomNav';

const CAT_LABELS = {
  consumable: '소모품',
  mechanical: '기계부품',
  electrical: '전기부품',
  hydraulic:  '유압부품',
  other:      '기타',
};

function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function InventoryDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const { isAuthed, fullName } = useAuth();

  const [part, setPart] = useState(null);
  const [asset, setAsset] = useState(null);
  const [vendor, setVendor] = useState(null);
  const [movements, setMovements] = useState([]);
  const [openBms, setOpenBms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Form panel state: null | 'IN' | 'OUT'
  const [activePanel, setActivePanel] = useState(null);
  const [moveQty, setMoveQty] = useState('');
  const [moveReason, setMoveReason] = useState('');
  const [movePerformer, setMovePerformer] = useState('');
  const [bmEventId, setBmEventId] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [busy, setBusy] = useState(false);
  const [savedFlash, setSavedFlash] = useState(null);

  // ── Fetch part + movements ─────────────────────────────────────────
  const refetch = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    const { data: partRow, error: partErr } = await supabase
      .from('spare_parts')
      .select('id, part_number, name_ko, name_en, category, asset_id, vendor_id, maker, specs, unit_price, currency, quantity, min_quantity, unit, location, notes, created_at')
      .eq('id', id)
      .maybeSingle();
    if (partErr) { setError(partErr.message); setLoading(false); return; }
    if (!partRow) { setError('예비품을 찾을 수 없습니다'); setLoading(false); return; }
    setPart(partRow);

    if (partRow.asset_id) {
      const { data: assetRow } = await supabase
        .from('assets')
        .select('machine_asset_number, name_en')
        .eq('id', partRow.asset_id)
        .maybeSingle();
      setAsset(assetRow || null);
    } else {
      setAsset(null);
    }

    if (partRow.vendor_id) {
      const { data: vRow } = await supabase
        .from('vendors')
        .select('id, name, currency, lead_time_days')
        .eq('id', partRow.vendor_id)
        .maybeSingle();
      setVendor(vRow || null);
    } else {
      setVendor(null);
    }

    const { data: moveRows } = await supabase
      .from('stock_movements')
      .select('id, movement_type, quantity, reason, performed_by, performed_at, bm_event_id, reference_no')
      .eq('part_id', id)
      .order('performed_at', { ascending: false })
      .limit(20);
    setMovements(moveRows || []);

    // Open BM events (최근 30일)
    const from30 = new Date(Date.now() - 30*86400000).toISOString();
    const { data: bms } = await supabase
      .from('bm_events')
      .select('id, reported_at, symptom, status, assets(machine_asset_number)')
      .in('status', ['open', 'in_progress', 'pending_parts'])
      .gte('reported_at', from30)
      .order('reported_at', { ascending: false })
      .limit(50);
    setOpenBms(bms || []);

    setLoading(false);
  }, [id]);

  useEffect(() => { refetch(); }, [refetch]);

  // ── Prefill performer name from auth ───────────────────────────────
  useEffect(() => {
    if (fullName && !movePerformer) setMovePerformer(fullName);
  }, [fullName]); // eslint-disable-line react-hooks/exhaustive-deps

  function openPanel(type) {
    if (activePanel === type) {
      setActivePanel(null);
      return;
    }
    setActivePanel(type);
    setMoveQty('');
    setMoveReason('');
    setBmEventId('');
    setReferenceNo('');
    setError(null);
  }

  async function submitMovement() {
    if (!activePanel || !part) return;
    const qty = parseInt(moveQty, 10);
    if (Number.isNaN(qty) || qty <= 0) { setError('수량은 1 이상이어야 합니다'); return; }
    if (activePanel === 'OUT' && qty > (part.quantity ?? 0)) {
      setError('현재 재고보다 많은 수량을 출고할 수 없습니다');
      return;
    }
    if (!movePerformer.trim()) { setError('처리자 이름을 입력하세요'); return; }

    setBusy(true);
    setError(null);
    try {
      const { error: moveErr } = await supabase
        .from('stock_movements')
        .insert({
          part_id: part.id,
          movement_type: activePanel,
          quantity: qty,
          reason: moveReason.trim() || null,
          performed_by: movePerformer.trim(),
          bm_event_id: activePanel === 'OUT' && bmEventId ? bmEventId : null,
          reference_no: referenceNo.trim() || null,
        });
      if (moveErr) {
        if (String(moveErr.message || '').includes('INSUFFICIENT_STOCK')) {
          throw new Error('현재 재고보다 많은 수량을 출고할 수 없습니다');
        }
        throw moveErr;
      }

      // Check if the DB trigger (apply_stock_movement) already updated quantity.
      const { data: nowPart } = await supabase
        .from('spare_parts').select('quantity').eq('id', part.id).maybeSingle();
      const expected = activePanel === 'IN' ? (part.quantity ?? 0) + qty : (part.quantity ?? 0) - qty;
      if (!nowPart || Number(nowPart.quantity) !== expected) {
        // Trigger not installed — fall back to manual update.
        const { error: updErr } = await supabase
          .from('spare_parts')
          .update({ quantity: expected })
          .eq('id', part.id);
        if (updErr) throw updErr;
      }

      setSavedFlash(activePanel === 'IN' ? '입고 완료' : '출고 완료');
      setActivePanel(null);
      setMoveQty('');
      setMoveReason('');
      await refetch();
      setTimeout(() => setSavedFlash(null), 2500);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setBusy(false);
    }
  }

  const low = part && (part.quantity ?? 0) <= (part.min_quantity ?? 0);
  const unit = part?.unit || 'EA';

  return (
    <>
      <Head>
        <title>예비품 상세 | DSC FMS</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#0f172a" />
      </Head>

      <main style={S.page}>
        <header style={S.header}>
          <Link href="/inventory" style={S.backLink}>← 재고</Link>
          <div style={S.headerTitleWrap}>
            {part?.part_number && <div style={S.headerTitle}>{part.part_number}</div>}
            <div style={part?.part_number ? S.headerSubtitle : S.headerTitle}>{part?.name_ko || '예비품'}</div>
          </div>
          <div style={{ minWidth: 40 }} />
        </header>

        {loading ? (
          <div style={S.loading}>불러오는 중…</div>
        ) : error && !part ? (
          <div style={S.errorBox}>{error}</div>
        ) : part ? (
          <div style={S.content}>
            {/* Stock status card */}
            <div style={{
              ...S.stockCard,
              background: low ? 'rgba(220,38,38,0.15)' : '#1e293b',
              borderColor: low ? 'rgba(220,38,38,0.55)' : '#1f2937',
            }}>
              <div style={S.stockLabel}>현재 재고</div>
              <div style={S.stockMain}>
                <span style={{ ...S.stockQty, color: low ? '#fca5a5' : '#f8fafc' }}>
                  {part.quantity ?? 0}
                </span>
                <span style={S.stockUnit}>{unit}</span>
              </div>
              <div style={S.stockMin}>최소 수량 {part.min_quantity ?? 0} {unit}</div>
              {low && <div style={S.lowWarn}>⚠ 재고 부족 — 보충이 필요합니다</div>}
            </div>

            {savedFlash && <div style={S.savedFlash}>✓ {savedFlash}</div>}

            {/* IN/OUT actions */}
            {isAuthed ? (
              <div style={S.actionGrid}>
                <button
                  type="button"
                  onClick={() => openPanel('IN')}
                  style={{
                    ...S.btnAction,
                    ...S.btnIn,
                    ...(activePanel === 'IN' ? S.btnActive : {}),
                  }}
                  disabled={busy}
                >
                  ▲ 입고
                </button>
                <button
                  type="button"
                  onClick={() => openPanel('OUT')}
                  style={{
                    ...S.btnAction,
                    ...S.btnOut,
                    ...(activePanel === 'OUT' ? S.btnActive : {}),
                  }}
                  disabled={busy}
                >
                  ▼ 출고
                </button>
              </div>
            ) : (
              <div style={S.loginHint}>
                입출고 처리하려면 <Link href={`/login?next=${encodeURIComponent(`/inventory/${id}`)}`} style={{ color: '#60a5fa' }}>로그인</Link>이 필요합니다.
              </div>
            )}

            {activePanel && (
              <Section title={activePanel === 'IN' ? '입고 처리' : '출고 처리'}>
                <div style={S.fieldGap}>
                  <div style={S.fieldLabel}>수량 *</div>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={moveQty}
                    onChange={e => setMoveQty(e.target.value)}
                    placeholder={`수량 (${unit})`}
                    style={S.input}
                  />
                </div>
                {activePanel === 'OUT' && (
                  <div style={S.fieldGap}>
                    <div style={S.fieldLabel}>BM 연결 (선택)</div>
                    <select value={bmEventId} onChange={e => setBmEventId(e.target.value)} style={S.input}>
                      <option value="">{openBms.length === 0 ? '연결할 BM 없음' : '— BM 선택 안 함 —'}</option>
                      {openBms.map(b => (
                        <option key={b.id} value={b.id}>
                          {b.assets?.machine_asset_number || '?'} · {(b.symptom || '').slice(0, 30)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {activePanel === 'IN' && (
                  <div style={S.fieldGap}>
                    <div style={S.fieldLabel}>발주/인보이스 번호 (선택)</div>
                    <input type="text" value={referenceNo} onChange={e => setReferenceNo(e.target.value)} placeholder="예: PO-2026-051" style={S.input} />
                  </div>
                )}
                <div style={S.fieldGap}>
                  <div style={S.fieldLabel}>사유</div>
                  <input
                    type="text"
                    value={moveReason}
                    onChange={e => setMoveReason(e.target.value)}
                    placeholder={activePanel === 'IN' ? '예: 신규 입고, 반품' : '예: BM 수리 사용, 점검 교체'}
                    style={S.input}
                  />
                </div>
                <div style={S.fieldGap}>
                  <div style={S.fieldLabel}>처리자 *</div>
                  <input
                    type="text"
                    value={movePerformer}
                    onChange={e => setMovePerformer(e.target.value)}
                    placeholder="이름"
                    style={S.input}
                  />
                </div>

                {error && <div style={{ ...S.errorBox, marginTop: 8, marginBottom: 0 }}>{error}</div>}

                <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                  <button
                    type="button"
                    onClick={() => { setActivePanel(null); setError(null); }}
                    style={{ ...S.btn, ...S.btnSecondary }}
                    disabled={busy}
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={submitMovement}
                    style={{
                      ...S.btn,
                      ...(busy
                        ? S.btnDisabled
                        : (activePanel === 'IN' ? S.btnConfirmIn : S.btnConfirmOut)),
                    }}
                    disabled={busy}
                  >
                    {busy ? '저장 중…' : '확인'}
                  </button>
                </div>
              </Section>
            )}

            <Section title="상세 정보">
              <Row label="카테고리" value={CAT_LABELS[part.category] || part.category} />
              <Row label="제조사" value={part.maker} />
              <Row label="규격" value={part.specs} />
              <Row label="공급업체" value={vendor ? (
                <Link href={`/vendors/${vendor.id}`} style={{ color: '#60a5fa', textDecoration: 'none' }}>
                  {vendor.name}{vendor.lead_time_days != null ? ` · 납기 ${vendor.lead_time_days}일` : ''}
                </Link>
              ) : null} />
              <Row label="단가" value={part.unit_price != null ? `${Number(part.unit_price).toLocaleString()} ${part.currency || 'INR'}` : null} />
              <Row label="관련 자산" value={asset ? `${asset.machine_asset_number}${asset.name_en ? ` — ${asset.name_en}` : ''}` : null} />
              <Row label="단위" value={part.unit} />
              <Row label="보관 위치" value={part.location} />
              <Row label="비고" value={part.notes} />
              {isAuthed && (
                <div style={{ marginTop: 12 }}>
                  <Link href={`/inventory/edit/${part.id}`} style={S.editBtn}>편집</Link>
                </div>
              )}
            </Section>

            <Section title={`입출고 이력 (${movements.length})`}>
              {movements.length === 0 ? (
                <div style={{ padding: '12px 4px', fontSize: 13, color: '#64748b', textAlign: 'center' }}>
                  이력이 없습니다
                </div>
              ) : (
                <ul style={S.histList}>
                  {movements.map(m => {
                    const isIn = m.movement_type === 'IN';
                    return (
                      <li key={m.id} style={S.histRow}>
                        <div style={{ ...S.histArrow, color: isIn ? '#86efac' : '#fca5a5' }}>
                          {isIn ? '▲' : '▼'}
                        </div>
                        <div style={S.histBody}>
                          <div style={S.histTopLine}>
                            <span style={{ ...S.histType, color: isIn ? '#86efac' : '#fca5a5' }}>
                              {isIn ? '입고' : '출고'}
                            </span>
                            <span style={S.histQty}>
                              {isIn ? '+' : '-'}{m.quantity} {unit}
                            </span>
                          </div>
                          {m.reason && <div style={S.histReason}>{m.reason}</div>}
                          {m.bm_event_id && (
                            <div style={{ fontSize: 11, marginBottom: 2 }}>
                              <Link href={`/bm/${m.bm_event_id}`} style={{ color: '#60a5fa', textDecoration: 'none' }}>→ BM 이벤트 보기</Link>
                            </div>
                          )}
                          {m.reference_no && <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'ui-monospace,Menlo,monospace' }}>{m.reference_no}</div>}
                          <div style={S.histMeta}>
                            {m.performed_by || '—'} · {formatDateTime(m.performed_at)}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Section>

            {error && part && <div style={{ ...S.errorBox, marginTop: 8 }}>{error}</div>}
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
  stockCard: { borderRadius: 12, marginBottom: 10, border: '1px solid #1f2937', padding: '18px 16px', textAlign: 'center' },
  stockLabel: { fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  stockMain: { display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 8, marginBottom: 4 },
  stockQty: { fontSize: 42, fontWeight: 800, fontFamily: 'ui-monospace,Menlo,monospace', lineHeight: 1 },
  stockUnit: { fontSize: 16, fontWeight: 700, color: '#94a3b8' },
  stockMin: { fontSize: 12, color: '#94a3b8', fontFamily: 'ui-monospace,Menlo,monospace' },
  lowWarn: { marginTop: 10, fontSize: 12, fontWeight: 700, color: '#fca5a5' },
  actionGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 },
  btnAction: { padding: '16px', borderRadius: 12, border: '2px solid transparent', fontSize: 15, fontWeight: 800, cursor: 'pointer', minHeight: 56 },
  btnIn: { background: '#16a34a', color: '#fff', boxShadow: '0 4px 12px rgba(22,163,74,0.4)' },
  btnOut: { background: '#dc2626', color: '#fff', boxShadow: '0 4px 12px rgba(220,38,38,0.4)' },
  btnActive: { outline: '2px solid #f8fafc', outlineOffset: 2 },
  btn: { padding: '14px', borderRadius: 12, border: 'none', fontSize: 15, fontWeight: 700, cursor: 'pointer', minHeight: 52, flex: 1 },
  btnSecondary: { background: '#334155', color: '#e2e8f0' },
  btnConfirmIn: { background: '#16a34a', color: '#fff', boxShadow: '0 4px 12px rgba(22,163,74,0.4)' },
  btnConfirmOut: { background: '#dc2626', color: '#fff', boxShadow: '0 4px 12px rgba(220,38,38,0.4)' },
  btnDisabled: { background: '#1f2937', color: '#475569', cursor: 'not-allowed', boxShadow: 'none' },
  fieldGap: { marginBottom: 10 },
  fieldLabel: { fontSize: 12, color: '#94a3b8', marginBottom: 6, fontWeight: 600 },
  input: { width: '100%', padding: '12px 14px', border: '1px solid #334155', borderRadius: 10, fontSize: 16, outline: 'none', boxSizing: 'border-box', background: '#0b1220', color: '#f1f5f9', minHeight: 48 },
  histList: { listStyle: 'none', margin: 0, padding: 0 },
  histRow: { display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid #1f2937' },
  histArrow: { fontSize: 18, fontWeight: 800, lineHeight: 1.4, minWidth: 18 },
  histBody: { flex: 1, minWidth: 0 },
  histTopLine: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  histType: { fontSize: 13, fontWeight: 700 },
  histQty: { fontSize: 14, fontWeight: 800, color: '#e2e8f0', fontFamily: 'ui-monospace,Menlo,monospace' },
  histReason: { fontSize: 13, color: '#cbd5e1', marginBottom: 2, wordBreak: 'break-word' },
  histMeta: { fontSize: 11, color: '#64748b' },
  savedFlash: { background: 'rgba(34,197,94,0.18)', color: '#86efac', border: '1px solid rgba(34,197,94,0.5)', padding: 12, borderRadius: 10, fontSize: 13, marginBottom: 10, textAlign: 'center', fontWeight: 700 },
  loading: { padding: 48, textAlign: 'center', color: '#64748b' },
  errorBox: { margin: '0 0 8px', padding: 14, background: 'rgba(220,38,38,0.15)', color: '#fca5a5', border: '1px solid rgba(220,38,38,0.4)', borderRadius: 10, fontSize: 14 },
  loginHint: { padding: 14, fontSize: 13, color: '#94a3b8', textAlign: 'center', background: '#1e293b', borderRadius: 10, border: '1px solid #1f2937', marginBottom: 10 },
  editBtn: { display: 'inline-block', padding: '10px 18px', background: '#334155', color: '#e2e8f0', textDecoration: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700 },
};
