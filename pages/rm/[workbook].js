import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/use-auth';
import BottomNav from '../../components/BottomNav';

const MONTHS = [
  { n: 1,  short: 'JAN' }, { n: 2,  short: 'FEB' }, { n: 3,  short: 'MAR' },
  { n: 4,  short: 'APR' }, { n: 5,  short: 'MAY' }, { n: 6,  short: 'JUN' },
  { n: 7,  short: 'JUL' }, { n: 8,  short: 'AUG' }, { n: 9,  short: 'SEP' },
  { n: 10, short: 'OCT' }, { n: 11, short: 'NOV' }, { n: 12, short: 'DEC' },
];

const YEAR = 2026;

// Heuristic: which columns are numeric (right-aligned, formatted)
const NUMERIC_HINTS = /(qty|price|amount|total|cost|rs|rupees|수량|금액|단가)/i;
function isNumericCol(label) { return NUMERIC_HINTS.test(label || ''); }
function fmtNum(v) {
  if (v === '' || v === null || v === undefined) return '';
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
function isUrlLike(s) {
  return typeof s === 'string' && /^https?:\/\//i.test(s.trim());
}

export default function RmWorkbookPage() {
  const router = useRouter();
  const { workbook } = router.query;
  const { user } = useAuth();

  const [wb, setWb] = useState(null);
  const [rows, setRows] = useState([]);
  const [month, setMonth] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null); // { data, hyperlinks }
  const [showAdd, setShowAdd] = useState(false);

  // Load workbook meta once router has the param
  useEffect(() => {
    if (!workbook) return;
    let cancelled = false;
    (async () => {
      const { data, error: e } = await supabase
        .from('rm_workbooks').select('*').eq('key', workbook).maybeSingle();
      if (cancelled) return;
      if (e) setError(e.message);
      setWb(data || null);
    })();
    return () => { cancelled = true; };
  }, [workbook]);

  // Load rows for current month
  const loadRows = useCallback(async () => {
    if (!workbook) return;
    setLoading(true);
    const { data, error: e } = await supabase
      .from('rm_monthly_rows')
      .select('id, row_index, data, hyperlinks, source, updated_at')
      .eq('workbook_key', workbook)
      .eq('year', YEAR)
      .eq('month', month)
      .order('row_index', { ascending: true });
    if (e) setError(e.message);
    setRows(data || []);
    setLoading(false);
  }, [workbook, month]);

  useEffect(() => { loadRows(); }, [loadRows]);

  const cols = useMemo(() => (wb && Array.isArray(wb.columns)) ? wb.columns : [], [wb]);

  // Totals (sum of last numeric column heuristically — TOTAL AMOUNT)
  const totals = useMemo(() => {
    const out = {};
    for (const c of cols) {
      if (!isNumericCol(c.label_en)) continue;
      let sum = 0; let hasAny = false;
      for (const r of rows) {
        const v = r.data?.[c.key];
        const n = Number(v);
        if (Number.isFinite(n)) { sum += n; hasAny = true; }
      }
      if (hasAny) out[c.key] = sum;
    }
    return out;
  }, [cols, rows]);

  const monthlyTotalAmount = useMemo(() => {
    const totalCol = cols.find(c => /total\s*amount|총\s*금액/i.test(c.label_en));
    if (!totalCol) return null;
    return totals[totalCol.key] ?? null;
  }, [cols, totals]);

  function emptyDraft() {
    const data = {}; for (const c of cols) data[c.key] = '';
    return { data, hyperlinks: {} };
  }

  async function handleSaveEdit() {
    if (!editingId || !draft) return;
    setSaving(true);
    const { error: e } = await supabase
      .from('rm_monthly_rows')
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
      .from('rm_monthly_rows')
      .insert({
        workbook_key: workbook,
        year: YEAR,
        month,
        row_index: nextIdx,
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
    const { error: e } = await supabase.from('rm_monthly_rows').delete().eq('id', id);
    if (e) { alert('삭제 실패: ' + e.message); return; }
    loadRows();
  }

  if (!workbook) return null;

  return (
    <>
      <Head><title>{wb ? `${wb.key} ${wb.title_ko}` : 'R&M'} | DSC FMS</title></Head>
      <main style={S.page}>
        <div style={S.crumbs}>
          <Link href="/rm" style={S.crumbLink}>← R&M 비용 관리</Link>
        </div>
        <header style={S.header}>
          <div style={S.titleRow}>
            <div>
              <h1 style={S.h1}>
                <span style={S.keyBadge}>{wb?.key || workbook}</span> {wb?.title_ko || ''}
              </h1>
              <p style={S.sub}>{wb?.title_en || ''} · {YEAR}년</p>
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

        {/* Month tabs (JAN~DEC) — horizontally scrollable */}
        <div style={S.tabsWrap}>
          <div style={S.tabs}>
            {MONTHS.map(m => (
              <button
                key={m.n}
                onClick={() => setMonth(m.n)}
                style={{ ...S.tab, ...(m.n === month ? S.tabActive : null) }}
              >
                {m.short}
              </button>
            ))}
          </div>
        </div>

        {error && <div style={S.err}>오류: {error}</div>}

        <div style={S.tableMeta}>
          <span style={S.metaItem}><b>{rows.length.toLocaleString()}</b> 행</span>
          {monthlyTotalAmount !== null && (
            <span style={S.metaItem}>
              월 합계: <b style={{ color:'#fbbf24' }}>Rs {fmtNum(monthlyTotalAmount)}</b>
            </span>
          )}
        </div>

        {loading ? (
          <div style={S.muted}>불러오는 중…</div>
        ) : !cols.length ? (
          <div style={S.muted}>컬럼 정의가 없습니다. import 스크립트를 먼저 실행해 주세요.</div>
        ) : (
          <div style={S.tableScroll}>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={{ ...S.th, ...S.thSticky }}>#</th>
                  {cols.map(c => (
                    <th key={c.key} style={{ ...S.th, textAlign: isNumericCol(c.label_en) ? 'right' : 'left' }}>
                      {c.label_en}
                    </th>
                  ))}
                  {user && <th style={S.th}>편집</th>}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={cols.length + 2} style={S.empty}>해당 월에 데이터가 없습니다.</td></tr>
                )}
                {rows.map(r => {
                  const isEditing = editingId === r.id;
                  return (
                    <tr key={r.id} style={{ background: isEditing ? 'rgba(59,130,246,.08)' : 'transparent' }}>
                      <td style={{ ...S.td, ...S.tdNum, ...S.thSticky, background: isEditing ? '#162033' : '#0e1729' }}>{r.row_index}</td>
                      {cols.map(c => {
                        const v = isEditing ? draft.data[c.key] : r.data?.[c.key];
                        const link = isEditing ? draft.hyperlinks[c.key] : r.hyperlinks?.[c.key];
                        const numeric = isNumericCol(c.label_en);
                        if (isEditing) {
                          return (
                            <td key={c.key} style={S.tdEdit}>
                              <input
                                value={v ?? ''}
                                onChange={(e) => {
                                  const nv = e.target.value;
                                  setDraft(d => ({ ...d, data: { ...d.data, [c.key]: nv } }));
                                }}
                                style={{ ...S.input, textAlign: numeric ? 'right' : 'left' }}
                              />
                            </td>
                          );
                        }
                        const display = numeric ? fmtNum(v) : (v ?? '');
                        return (
                          <td key={c.key} style={{ ...S.td, textAlign: numeric ? 'right' : 'left' }}>
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

                {/* Totals row */}
                {rows.length > 0 && (
                  <tr style={{ background:'#0e1a2e', borderTop:'2px solid #334155' }}>
                    <td style={{ ...S.td, ...S.thSticky, background:'#0e1a2e', fontWeight:700 }}>합계</td>
                    {cols.map(c => {
                      const numeric = isNumericCol(c.label_en);
                      const tv = totals[c.key];
                      return (
                        <td key={c.key} style={{ ...S.td, textAlign: numeric ? 'right' : 'left', fontWeight:700, color: numeric ? '#fbbf24' : '#cbd5e1' }}>
                          {numeric && tv !== undefined ? fmtNum(tv) : ''}
                        </td>
                      );
                    })}
                    {user && <td style={S.td}></td>}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Add row modal */}
        {showAdd && draft && (
          <div style={S.modalBack} onClick={() => { setShowAdd(false); setDraft(null); }}>
            <div style={S.modal} onClick={(e) => e.stopPropagation()}>
              <h3 style={S.modalTitle}>{MONTHS[month-1].short} 새 행 추가</h3>
              <div style={S.modalBody}>
                {cols.map(c => (
                  <label key={c.key} style={S.field}>
                    <span style={S.fieldLabel}>{c.label_en}</span>
                    <input
                      value={draft.data[c.key] ?? ''}
                      onChange={(e) => setDraft(d => ({ ...d, data: { ...d.data, [c.key]: e.target.value } }))}
                      style={S.input}
                      inputMode={isNumericCol(c.label_en) ? 'decimal' : 'text'}
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
  tab: { background:'transparent', border:'none', color:'#94a3b8', fontWeight:600, fontSize:13, padding:'10px 14px', cursor:'pointer', minHeight:44, borderBottom:'2px solid transparent', whiteSpace:'nowrap' },
  tabActive: { color:'#fbbf24', borderBottom:'2px solid #fbbf24' },

  tableMeta: { display:'flex', gap:14, padding:'6px 6px 10px', fontSize:13, color:'#94a3b8', flexWrap:'wrap' },
  metaItem: {},

  tableScroll: { overflowX:'auto', border:'1px solid #1f2a3d', borderRadius:8, background:'#0e1729' },
  table: { width:'100%', borderCollapse:'collapse', fontSize:12, minWidth:800 },
  th: { background:'#162033', color:'#cbd5e1', fontSize:11, fontWeight:700, padding:'8px 8px', textAlign:'left', borderBottom:'1px solid #334155', whiteSpace:'nowrap', position:'sticky', top:0 },
  thSticky: { position:'sticky', left:0, zIndex:2, background:'#162033' },
  td: { padding:'7px 8px', borderBottom:'1px solid #1f2a3d', color:'#e2e8f0', verticalAlign:'top', whiteSpace:'pre-wrap', wordBreak:'break-word', maxWidth:260 },
  tdNum: { color:'#94a3b8', textAlign:'right', fontWeight:600 },
  tdEdit: { padding:'4px 6px', borderBottom:'1px solid #1f2a3d', background:'rgba(59,130,246,.06)' },
  input: { width:'100%', background:'#0b1220', color:'#f1f5f9', border:'1px solid #334155', padding:'6px 8px', borderRadius:4, fontSize:13, minHeight:32 },
  link: { color:'#60a5fa', textDecoration:'underline' },
  empty: { padding:24, textAlign:'center', color:'#64748b' },
  muted: { color:'#64748b', fontSize:14, padding:16 },
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
