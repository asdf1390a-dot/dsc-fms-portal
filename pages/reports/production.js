import Head from 'next/head';
import Link from 'next/link';
import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/use-auth';
import BottomNav from '../../components/BottomNav';

const MONTHS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];

export default function ProductionPage() {
  const { isAuthed } = useAuth();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [fileProd, setFileProd] = useState(null);   // 생산현황.xlsx
  const [fileSum, setFileSum]   = useState(null);   // 생산성집계.xlsx
  const [uploading, setUploading] = useState(false);
  const [extracted, setExtracted] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [msg, setMsg] = useState('');

  async function handleUpload() {
    if (!fileProd) return alert('생산현황 파일을 선택해주세요');
    if (!fileSum)  return alert('생산성집계 파일을 선택해주세요');
    setUploading(true); setMsg(''); setExtracted(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      const fd = new FormData();
      fd.append('type', 'production');
      fd.append('file_production', fileProd);
      fd.append('file_summary', fileSum);
      const r = await fetch(`/api/reports/${year}/${month}/extract`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || '업로드 실패');
      setExtracted(json.extracted || {});
      setMsg('✅ 생산 데이터 추출 완료');
    } catch (e) {
      setMsg('❌ ' + e.message);
    } finally { setUploading(false); }
  }

  async function handleGenExcel() {
    setGenerating(true); setMsg('');
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      const r = await fetch(`/api/reports/${year}/${month}/generate/excel?type=production`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error('생성 실패');
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `만누르법인_생산성_${year}_${month}월.xlsx`;
      a.click(); URL.revokeObjectURL(url);
      setMsg('✅ 생산성 Excel 다운로드 완료');
    } catch (e) {
      setMsg('❌ ' + e.message);
    } finally { setGenerating(false); }
  }

  const pct = (v) => v != null ? (v * 100).toFixed(1) + '%' : '—';
  const num = (v) => v != null ? Number(v).toLocaleString() : '—';

  return (
    <>
      <Head><title>생산성 | DSC FMS</title></Head>
      <div style={S.page}>
        <div style={S.wrap}>
          <div style={S.header}>
            <Link href="/reports" style={S.back}>← 경영실적</Link>
            <h1 style={S.h1}>🏭 생산성</h1>
          </div>

          <div style={S.row}>
            <select value={year} onChange={e => setYear(+e.target.value)} style={S.sel}>
              {[2025,2026,2027].map(y => <option key={y} value={y}>{y}년</option>)}
            </select>
            <select value={month} onChange={e => setMonth(+e.target.value)} style={S.sel}>
              {MONTHS.map((m,i) => <option key={i+1} value={i+1}>{m}</option>)}
            </select>
          </div>

          {/* ── 파일 업로드 ── */}
          <div style={S.card}>
            <div style={S.cardTitle}>파일 업로드 (2개 필수)</div>

            <div style={S.fileRow}>
              <div style={S.fileLabel}>① 생산현황.xlsx</div>
              <div style={S.fileHint}>생산현황_N월_RevX.xlsx</div>
              <input
                type="file" accept=".xlsx,.xls"
                onChange={e => setFileProd(e.target.files[0])}
                style={S.fileInput}
              />
              {fileProd && <div style={S.fileName}>📄 {fileProd.name}</div>}
            </div>

            <div style={S.divider} />

            <div style={S.fileRow}>
              <div style={S.fileLabel}>② 생산성집계.xlsx</div>
              <div style={S.fileHint}>26.N월_만누르법인_생산성.xlsx</div>
              <input
                type="file" accept=".xlsx,.xls"
                onChange={e => setFileSum(e.target.files[0])}
                style={S.fileInput}
              />
              {fileSum && <div style={S.fileName}>📄 {fileSum.name}</div>}
            </div>

            <button
              onClick={handleUpload}
              disabled={uploading || !isAuthed || !fileProd || !fileSum}
              style={S.btn}
            >
              {uploading ? '추출 중…' : '업로드 → 데이터 추출'}
            </button>
          </div>

          {/* ── 추출 결과: 차종별 생산 ── */}
          {extracted?.byModel?.length > 0 && (
            <div style={S.card}>
              <div style={S.cardTitle}>차종별 생산 실적</div>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>차종</th>
                    <th style={{...S.th, textAlign:'right'}}>계획</th>
                    <th style={{...S.th, textAlign:'right'}}>실적</th>
                    <th style={{...S.th, textAlign:'right'}}>달성률</th>
                  </tr>
                </thead>
                <tbody>
                  {extracted.byModel.map((row, i) => (
                    <tr key={i}>
                      <td style={S.td}>{row.model}</td>
                      <td style={{...S.td, textAlign:'right'}}>{num(row.plan)}</td>
                      <td style={{...S.td, textAlign:'right', color:'#38bdf8'}}>{num(row.actual)}</td>
                      <td style={{...S.td, textAlign:'right', color: row.ratio >= 1 ? '#22c55e' : '#f59e0b'}}>
                        {pct(row.ratio)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── 추출 결과: 생산효율 KPI ── */}
          {extracted && (extracted.직접인원 != null || extracted.종합생산성 != null) && (
            <div style={S.card}>
              <div style={S.cardTitle}>생산효율 지표</div>
              <div style={S.kpiGrid}>
                <KpiItem label="직접인원" value={`${num(extracted.직접인원)} 명`} />
                <KpiItem label="종합생산성" value={pct(extracted.종합생산성)} highlight />
                <KpiItem label="표준시간" value={`${num(Math.round(extracted.표준시간))} Hr`} />
                <KpiItem label="투입시간" value={`${num(Math.round(extracted.투입시간))} Hr`} />
                <KpiItem label="생산효율" value={pct(extracted.생산효율)} highlight />
              </div>
            </div>
          )}

          {/* ── 추출 결과: 비가동시간 ── */}
          {extracted?.인정비가동 && (
            <div style={S.card}>
              <div style={S.cardTitle}>비가동시간 현황</div>

              <div style={S.subTitle}>인정비가동</div>
              <NonOpTable data={extracted.인정비가동} />

              <div style={{...S.subTitle, marginTop:12}}>개선비가동</div>
              <NonOpTable data={extracted.개선비가동} />

              <div style={{...S.subTitle, marginTop:12}}>Loss</div>
              <div style={S.summary}>
                <span>소계: <b style={{color:'#f59e0b'}}>{num(Math.round(extracted.loss?.소계))} Hr</b></span>
                <span>비율: <b style={{color:'#f59e0b'}}>{pct(extracted.loss?.비율)}</b></span>
              </div>
            </div>
          )}

          {/* ── 파일 생성 ── */}
          <div style={S.card}>
            <div style={S.cardTitle}>파일 생성</div>
            <button onClick={handleGenExcel} disabled={generating || !isAuthed} style={S.btn}>
              {generating ? '생성 중…' : '생산성 집계 Excel 다운로드'}
            </button>
            <button disabled style={{...S.btn, background:'#334155', marginTop:8, cursor:'not-allowed'}}>
              생산성 PPT 생성 (.pptx 변환 후 가능)
            </button>
          </div>

          {msg && <div style={S.msg}>{msg}</div>}
        </div>
        <BottomNav />
      </div>
    </>
  );
}

function KpiItem({ label, value, highlight }) {
  return (
    <div style={S.kpiItem}>
      <div style={S.kpiLabel}>{label}</div>
      <div style={{...S.kpiValue, color: highlight ? '#38bdf8' : '#f1f5f9'}}>{value}</div>
    </div>
  );
}

function NonOpTable({ data }) {
  if (!data) return null;
  const SKIP = ['소계', '비율'];
  const entries = Object.entries(data).filter(([k]) => !SKIP.includes(k));
  return (
    <>
      <table style={S.table}>
        <tbody>
          {entries.map(([k, v]) => (
            <tr key={k}>
              <td style={S.td}>{k}</td>
              <td style={{...S.td, textAlign:'right', color:'#94a3b8'}}>
                {v != null ? Number(v).toFixed(2) + ' Hr' : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={S.summary}>
        <span>소계: <b style={{color:'#f59e0b'}}>{data.소계 != null ? Number(data.소계).toFixed(1) : '—'} Hr</b></span>
        <span>비율: <b style={{color:'#f59e0b'}}>{data.비율 != null ? (data.비율 * 100).toFixed(2) + '%' : '—'}</b></span>
      </div>
    </>
  );
}

const S = {
  page: { minHeight:'100vh', background:'#0f172a', color:'#f1f5f9', paddingBottom:80 },
  wrap: { maxWidth:480, margin:'0 auto', padding:'16px 14px 0' },
  header: { marginBottom:16 },
  back: { color:'#94a3b8', textDecoration:'none', fontSize:14 },
  h1: { fontSize:22, fontWeight:800, margin:'6px 0 0' },
  row: { display:'flex', gap:8, marginBottom:14 },
  sel: { flex:1, background:'#1e293b', border:'1px solid #334155', color:'#f1f5f9', borderRadius:8, padding:'8px 10px', fontSize:14 },
  card: { background:'#1e293b', border:'1px solid #334155', borderRadius:12, padding:14, marginBottom:12 },
  cardTitle: { fontSize:14, fontWeight:700, marginBottom:10, color:'#94a3b8' },
  fileRow: { marginBottom:10 },
  fileLabel: { fontSize:13, fontWeight:700, color:'#f1f5f9', marginBottom:3 },
  fileHint: { fontSize:11, color:'#475569', marginBottom:6 },
  fileInput: { display:'block', marginBottom:4, color:'#f1f5f9', fontSize:13, width:'100%' },
  fileName: { fontSize:12, color:'#38bdf8', marginTop:2 },
  divider: { borderTop:'1px solid #334155', margin:'10px 0' },
  btn: { width:'100%', padding:'11px 14px', background:'#3b82f6', color:'#fff', border:'none', borderRadius:9, fontSize:15, fontWeight:700, minHeight:44, cursor:'pointer', marginTop:8 },
  table: { width:'100%', borderCollapse:'collapse', fontSize:13, marginBottom:8 },
  th: { padding:'5px 4px', borderBottom:'1px solid #334155', color:'#64748b', textAlign:'left', fontSize:12 },
  td: { padding:'5px 4px', borderBottom:'1px solid #1e293b', color:'#e2e8f0' },
  kpiGrid: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 },
  kpiItem: { background:'#0f172a', borderRadius:8, padding:'10px 12px' },
  kpiLabel: { fontSize:11, color:'#64748b', marginBottom:3 },
  kpiValue: { fontSize:16, fontWeight:700 },
  subTitle: { fontSize:12, fontWeight:700, color:'#94a3b8', marginBottom:6 },
  summary: { display:'flex', gap:16, fontSize:12, color:'#e2e8f0', marginTop:4 },
  msg: { marginTop:12, padding:'10px 12px', background:'#0f2231', borderRadius:9, fontSize:14, color:'#7dd3fc' },
};
