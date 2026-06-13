import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/use-auth';
import BottomNav from '../../components/BottomNav';

// Period tabs: 14 months from 2025-11 through 2026-12
const PERIOD_TABS = [
  { key: 'y2025_m11', short: '25-11',  label: '2025년 11월' },
  { key: 'y2025_m12', short: '25-12',  label: '2025년 12월' },
  { key: 'y2026_m01', short: 'JAN',    label: '2026년 1월' },
  { key: 'y2026_m02', short: 'FEB',    label: '2026년 2월' },
  { key: 'y2026_m03', short: 'MAR',    label: '2026년 3월' },
  { key: 'y2026_m04', short: 'APR',    label: '2026년 4월' },
  { key: 'y2026_m05', short: 'MAY',    label: '2026년 5월' },
  { key: 'y2026_m06', short: 'JUN',    label: '2026년 6월' },
  { key: 'y2026_m07', short: 'JUL',    label: '2026년 7월' },
  { key: 'y2026_m08', short: 'AUG',    label: '2026년 8월' },
  { key: 'y2026_m09', short: 'SEP',    label: '2026년 9월' },
  { key: 'y2026_m10', short: 'OCT',    label: '2026년 10월' },
  { key: 'y2026_m11', short: 'NOV',    label: '2026년 11월' },
  { key: 'y2026_m12', short: 'DEC',    label: '2026년 12월' },
];

function isMonthCol(c) { return c.group === 'actual'; }
function isNumeric(v) {
  if (v === '' || v === null || v === undefined) return false;
  const n = Number(v);
  return Number.isFinite(n);
}
function fmtCellValue(v, rowType) {
  if (v === '' || v === null || v === undefined) return '';
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  // Percent for ratio rows
  if (rowType === 'ratio' || rowType === 'summary') {
    if (Math.abs(n) <= 2) return (n * 100).toFixed(2) + '%';
  }
  // Otherwise round to 1 dp for hours, integer for small whole
  if (Number.isInteger(n)) return n.toLocaleString();
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
function isUrlLike(s) {
  return typeof s === 'string' && /^https?:\/\//i.test(s.trim());
}

export default function ProductivityWorkbookPage() {
  const router = useRouter();
  const { period } = router.query;
  const { user } = useAuth();

  const [wb, setWb] = useState(null);
  const [rows, setRows] = useState([]);
  const [activePeriod, setActivePeriod] = useState('y2026_m04');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [showAdd, setShowAdd] = useState(false);

  const tableScrollRef = useRef(null);
  const activeColRef = useRef(null);

  // Load workbook meta
  useEffect(() => {
    if (!period) return;
    let cancelled = false;
    (async () => {
      const { data, error: e } = await supabase
        .from('productivity_workbooks').select('*').eq('key', period).maybeSingle();
      if (cancelled) return;
      if (e) setError(e.message);
      setWb(data || null);
    })();
    return () => { cancelled = true; };
  }, [period]);

  const loadRows = useCallback(async () => {
    if (!period) return;
    setLoading(true);
    const { data, error: e } = await supabase
      .from('productivity_monthly_rows')
      .select('id, row_index, row_type, data, hyperlinks, source, updated_at')
      .eq('workbook_key', period)
      .order('row_index', { ascending: true });
    if (e) setError(e.message);
    setRows(data || []);
    setLoading(false);
  }, [period]);

  useEffect(() => { loadRows(); }, [loadRows]);

  const cols = useMemo(() => (wb && Array.isArray(wb.columns)) ? wb.columns : [], [wb]);

  // Scroll active month column into view when tab changes
  useEffect(() => {
    if (!activeColRef.current || !tableScrollRef.current) return;
    const el = activeColRef.current;
    const container = tableScrollRef.current;
    const elRect = el.getBoundingClientRect();
    const cRect = container.getBoundingClientRect();
    const target = container.scrollLeft + (elRect.left - cRect.left) - 200;
    container.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
  }, [activePeriod, cols.length]);

  function emptyDraft() {
    const data = {}; for (const c of cols) data[c.key] = '';
    return { data, hyperlinks: {} };
  }

  async function handleSaveEdit() {
    if (!editingId || !draft) return;
    setSaving(true);
    const { error: e } = await supabase
      .from('productivity_monthly_rows')
      .update({
        data: draft.data,
        hyperlinks: draft.hyperlinks,
        updated_by: user?.email || null,
      })
      .eq('id', editingId);
    setSaving(false);
    if (e) { alert('저장 실패: ' + e.message); return; }
    setEditingId(null); setDraft(null);
    loadRows();
  }

  async function handleAdd() {
    if (!draft) return;
    setSaving(true);
    const nextIdx = (rows.length ? Math.max(...rows.map(r => r.row_index || 0)) : 0) + 1;
    const { error: e } = await supabase
      .from('productivity_monthly_rows')
      .insert({
        workbook_key: period,
        row_index: nextIdx,
        row_type: 'data',
        data: draft.data,
        hyperlinks: draft.hyperlinks,
        source: 'manual',
        created_by: user?.email || null,
      });
    setSaving(false);
    if (e) { alert('추가 실패: ' + e.message); return; }
    setShowAdd(false); setDraft(null);
    loadRows();
  }

  async function handleDelete(id) {
    if (!confirm('이 행을 삭제하시겠습니까?')) return;
    const { error: e } = await supabase.from('productivity_monthly_rows').delete().eq('id', id);
    if (e) { alert('삭제 실패: ' + e.message); return; }
    loadRows();
  }

  if (!period) return null;

  return (
    <>
      <Head><title>{wb ? wb.title_ko : '생산성'} | DSC FMS</title></Head>
      <main style={S.page}>
        <div style={S.crumbs}>
          <Link href="/productivity" style={S.crumbLink}>← 생산성 관리</Link>
        </div>
        <header style={S.header}>
          <div style={S.titleRow}>
            <div>
              <h1 style={S.h1}>
                <span style={S.keyBadge}>{wb?.key || period}</span> {wb?.title_ko || ''}
              </h1>
              <p style={S.sub}>{wb?.title_en || ''} · {wb?.year || 2026}년</p>
            </div>
            {user ? (
              <button style={S.addBtn} onClick={() => { setDraft(emptyDraft()); setShowAdd(true); setEditingId(null); }}>
                + 행 추가
              </button>
            ) : (
              <Link href="/login" style={S.loginHint}>로그인 후 편집</Link>
            )}
          </div>
        </header>

        {/* Period tabs */}
        <div style={S.tabsWrap}>
          <div style={S.tabs}>
            {PERIOD_TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setActivePeriod(t.key)}
                style={{ ...S.tab, ...(t.key === activePeriod ? S.tabActive : null) }}
                title={t.label}
              >
                {t.short}
              </button>
            ))}
          </div>
        </div>

        {error && <div style={S.err}>오류: {error}</div>}

        <div style={S.tableMeta}>
          <span style={S.metaItem}><b>{rows.length.toLocaleString()}</b> 행</span>
          <span style={S.metaItem}>활성 기간: <b style={{color:'#fbbf24'}}>{PERIOD_TABS.find(t=>t.key===activePeriod)?.label}</b></span>
        </div>

        {loading ? (
          <div style={S.muted}>불러오는 중…</div>
        ) : !cols.length ? (
          <div style={S.muted}>컬럼 정의가 없습니다. import 스크립트를 먼저 실행해 주세요.</div>
        ) : (
          <div style={S.tableScroll} ref={tableScrollRef}>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={{ ...S.th, ...S.thSticky }}>#</th>
                  {cols.map(c => {
                    const isActive = c.key === activePeriod;
                    const month = isMonthCol(c);
                    return (
                      <th
                        key={c.key}
                        ref={isActive ? activeColRef : null}
                        style={{
                          ...S.th,
                          textAlign: month || c.group === 'target' || c.group === 'summary' ? 'right' : 'left',
                          background: isActive ? '#3a2a08' : S.th.background,
                          color: isActive ? '#fbbf24' : S.th.color,
                          minWidth: c.width || 100,
                        }}
                      >
                        {c.label_ko}
                      </th>
                    );
                  })}
                  {user && <th style={S.th}>편집</th>}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={cols.length + 2} style={S.empty}>데이터가 없습니다.</td></tr>
                )}
                {rows.map(r => {
                  const isEditing = editingId === r.id;
                  const rt = r.row_type || 'data';
                  const rowBg =
                    isEditing ? 'rgba(59,130,246,.08)' :
                    rt === 'subtotal' ? 'rgba(251,191,36,.05)' :
                    rt === 'ratio' ? 'rgba(148,163,184,.05)' :
                    rt === 'summary' ? 'rgba(34,197,94,.06)' :
                    'transparent';
                  return (
                    <tr key={r.id} style={{ background: rowBg }}>
                      <td style={{ ...S.td, ...S.tdNum, ...S.thSticky, background: isEditing ? '#162033' : '#0e1729' }}>{r.row_index}</td>
                      {cols.map(c => {
                        const isActive = c.key === activePeriod;
                        const v = isEditing ? draft.data[c.key] : r.data?.[c.key];
                        const link = isEditing ? draft.hyperlinks[c.key] : r.hyperlinks?.[c.key];
                        const month = isMonthCol(c);
                        const numericAlign = month || c.group === 'target' || c.group === 'summary';
                        if (isEditing) {
                          return (
                            <td key={c.key} style={{ ...S.tdEdit, background: isActive ? 'rgba(251,191,36,.10)' : S.tdEdit.background }}>
                              <input
                                value={v ?? ''}
                                onChange={(e) => {
                                  const nv = e.target.value;
                                  setDraft(d => ({ ...d, data: { ...d.data, [c.key]: nv } }));
                                }}
                                style={{ ...S.input, textAlign: numericAlign ? 'right' : 'left' }}
                              />
                            </td>
                          );
                        }
                        const isNum = numericAlign && isNumeric(v);
                        const display = isNum ? fmtCellValue(v, rt) : (v ?? '');
                        const fontWeight = (rt === 'subtotal' || rt === 'summary') ? 700 : 400;
                        const color = isActive && isNum ? '#fbbf24' : '#e2e8f0';
                        return (
                          <td
                            key={c.key}
                            style={{
                              ...S.td,
                              textAlign: numericAlign ? 'right' : 'left',
                              background: isActive ? 'rgba(251,191,36,.06)' : 'transparent',
                              fontWeight,
                              color,
                            }}
                          >
                            {link ? (
                              <a href={link} target="_blank" rel="noreferrer" style={S.link}>{String(display) || link}</a>
                            ) : isUrlLike(display) ? (
                              <a href={String(display)} target="_blank" rel="noreferrer" style={S.link}>{display}</a>
                            ) : (
                              <span>{display}</span>
                            )}
                          </td>
                        );
                      })}
                      {user && (
                        <td style={S.td}>
                          {isEditing ? (
                            <div style={{ display:'flex', gap:6 }}>
                              <button style={S.btnPrimary} disabled={saving} onClick={handleSaveEdit}>저장</button>
                              <button style={S.btnGhost} onClick={() => { setEditingId(null); setDraft(null); }}>취소</button>
                            </div>
                          ) : (
                            <div style={{ display:'flex', gap:6 }}>
                              <button style={S.btnGhost} onClick={() => { setEditingId(r.id); setDraft({ data: { ...r.data }, hyperlinks: { ...(r.hyperlinks||{}) } }); }}>편집</button>
                              <button style={S.btnDanger} onClick={() => handleDelete(r.id)}>삭제</button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {showAdd && draft && (
          <div style={S.modalBack} onClick={() => { setShowAdd(false); setDraft(null); }}>
            <div style={S.modal} onClick={(e) => e.stopPropagation()}>
              <h3 style={S.modalTitle}>새 행 추가</h3>
              <div style={S.modalBody}>
                {cols.map(c => (
                  <label key={c.key} style={S.field}>
                    <span style={S.fieldLabel}>{c.label_ko} <span style={S.muted2}>({c.label_en})</span></span>
                    <input
                      value={draft.data[c.key] ?? ''}
                      onChange={(e) => setDraft(d => ({ ...d, data: { ...d.data, [c.key]: e.target.value } }))}
                      style={S.input}
                      inputMode={(isMonthCol(c) || c.group === 'target' || c.group === 'summary') ? 'decimal' : 'text'}
                    />
                  </label>
                ))}
              </div>
              <div style={S.modalFoot}>
                <button style={S.btnGhost} onClick={() => { setShowAdd(false); setDraft(null); }}>취소</button>
                <button style={S.btnPrimary} disabled={saving} onClick={handleAdd}>{saving ? '저장 중…' : '추가'}</button>
              </div>
            </div>
          </div>
        )}
      </main>
      <BottomNav />
    </>
  );
}

const S = {
  page: { background:'#0b1220', minHeight:'100vh', color:'#e2e8f0', padding:'12px 8px 96px', fontFamily:'Inter, "Noto Sans KR", sans-serif' },
  crumbs: { marginBottom:6, padding:'0 4px' },
  crumbLink: { color:'#60a5fa', fontSize:13, textDecoration:'none' },
  header: { padding:'4px 4px 12px' },
  titleRow: { display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 },
  h1: { fontSize:20, fontWeight:700, margin:0, color:'#f1f5f9', display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' },
  keyBadge: { background:'#1e293b', color:'#fbbf24', fontSize:12, fontWeight:700, padding:'3px 8px', borderRadius:6, letterSpacing:0.5 },
  sub: { fontSize:12, color:'#94a3b8', margin:'4px 0 0' },
  addBtn: { background:'#dc2626', color:'#fff', border:'none', padding:'10px 14px', borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer', minHeight:44, whiteSpace:'nowrap' },
  loginHint: { color:'#94a3b8', fontSize:13, textDecoration:'underline', alignSelf:'center' },

  tabsWrap: { overflowX:'auto', marginBottom:10, borderBottom:'1px solid #1f2a3d' },
  tabs: { display:'flex', gap:0, padding:'0 4px' },
  tab: { background:'transparent', border:'none', color:'#94a3b8', fontWeight:600, fontSize:13, padding:'10px 12px', cursor:'pointer', minHeight:44, borderBottom:'2px solid transparent', whiteSpace:'nowrap' },
  tabActive: { color:'#fbbf24', borderBottom:'2px solid #fbbf24' },

  tableMeta: { display:'flex', gap:14, padding:'6px 6px 10px', fontSize:13, color:'#94a3b8', flexWrap:'wrap' },
  metaItem: {},

  tableScroll: { overflowX:'auto', border:'1px solid #1f2a3d', borderRadius:8, background:'#0e1729' },
  table: { width:'100%', borderCollapse:'collapse', fontSize:12, minWidth:1600 },
  th: { background:'#162033', color:'#cbd5e1', fontSize:11, fontWeight:700, padding:'8px 8px', textAlign:'left', borderBottom:'1px solid #334155', whiteSpace:'nowrap', position:'sticky', top:0 },
  thSticky: { position:'sticky', left:0, zIndex:2, background:'#162033' },
  td: { padding:'7px 8px', borderBottom:'1px solid #1f2a3d', color:'#e2e8f0', verticalAlign:'top', whiteSpace:'pre-wrap', wordBreak:'break-word', maxWidth:260 },
  tdNum: { color:'#94a3b8', textAlign:'right', fontWeight:600 },
  tdEdit: { padding:'4px 6px', borderBottom:'1px solid #1f2a3d', background:'rgba(59,130,246,.06)' },
  input: { width:'100%', background:'#0b1220', color:'#f1f5f9', border:'1px solid #334155', padding:'6px 8px', borderRadius:4, fontSize:13, minHeight:32 },
  link: { color:'#60a5fa', textDecoration:'underline' },
  empty: { padding:24, textAlign:'center', color:'#64748b' },
  muted: { color:'#64748b', fontSize:14, padding:16 },
  muted2: { color:'#64748b', fontSize:10, fontWeight:400 },
  err: { background:'rgba(239,68,68,.12)', border:'1px solid rgba(239,68,68,.4)', color:'#fca5a5', padding:'10px 12px', borderRadius:8, margin:'8px 4px', fontSize:14 },

  btnPrimary: { background:'#2563eb', color:'#fff', border:'none', padding:'6px 12px', borderRadius:6, fontSize:12, fontWeight:600, cursor:'pointer', minHeight:32 },
  btnGhost: { background:'transparent', color:'#cbd5e1', border:'1px solid #334155', padding:'6px 12px', borderRadius:6, fontSize:12, cursor:'pointer', minHeight:32 },
  btnDanger: { background:'transparent', color:'#fca5a5', border:'1px solid #7f1d1d', padding:'6px 12px', borderRadius:6, fontSize:12, cursor:'pointer', minHeight:32 },

  modalBack: { position:'fixed', inset:0, background:'rgba(0,0,0,.7)', display:'flex', alignItems:'center', justifyContent:'center', padding:12, zIndex:100 },
  modal: { background:'#0e1729', border:'1px solid #1f2a3d', borderRadius:12, width:'100%', maxWidth:560, maxHeight:'90vh', display:'flex', flexDirection:'column' },
  modalTitle: { padding:'14px 16px', margin:0, fontSize:16, fontWeight:700, color:'#f1f5f9', borderBottom:'1px solid #1f2a3d' },
  modalBody: { padding:'12px 16px', overflowY:'auto', display:'flex', flexDirection:'column', gap:10 },
  modalFoot: { padding:'12px 16px', display:'flex', justifyContent:'flex-end', gap:8, borderTop:'1px solid #1f2a3d' },
  field: { display:'flex', flexDirection:'column', gap:4 },
  fieldLabel: { fontSize:11, color:'#94a3b8', fontWeight:600 },
};
