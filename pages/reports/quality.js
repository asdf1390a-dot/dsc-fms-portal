import Head from 'next/head';
import Link from 'next/link';
import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/use-auth';
import BottomNav from '../../components/BottomNav';

const MONTHS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];

export default function QualityPage() {
  const { isAuthed } = useAuth();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [msg, setMsg] = useState('');

  async function handleUpload() {
    if (!file) return alert('파일을 선택해주세요');
    setUploading(true); setMsg(''); setResult(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch(`/api/reports/${year}/${month}/extract`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || '업로드 실패');
      setResult(json.extracted || {});
      setMsg('✅ 품질 데이터 추출 완료');
    } catch (e) {
      setMsg('❌ ' + e.message);
    } finally { setUploading(false); }
  }

  async function handleGenExcel() {
    setGenerating(true); setMsg('');
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      const r = await fetch(`/api/reports/${year}/${month}/generate/excel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error('생성 실패');
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `만누르공장_${year}_${month}월_품질지수.xlsx`;
      a.click(); URL.revokeObjectURL(url);
      setMsg('✅ Excel 파일 다운로드 완료');
    } catch (e) {
      setMsg('❌ ' + e.message);
    } finally { setGenerating(false); }
  }

  return (
    <>
      <Head><title>품질지수 | DSC FMS</title></Head>
      <div style={S.page}>
        <div style={S.wrap}>
          <div style={S.header}>
            <Link href="/reports" style={S.back}>← 경영실적</Link>
            <h1 style={S.h1}>📊 품질지수</h1>
          </div>

          {/* 월 선택 */}
          <div style={S.row}>
            <select value={year} onChange={e => setYear(+e.target.value)} style={S.sel}>
              {[2025,2026,2027].map(y => <option key={y} value={y}>{y}년</option>)}
            </select>
            <select value={month} onChange={e => setMonth(+e.target.value)} style={S.sel}>
              {MONTHS.map((m,i) => <option key={i+1} value={i+1}>{m}</option>)}
            </select>
          </div>

          {/* 파일 업로드 */}
          <div style={S.card}>
            <div style={S.cardTitle}>1번 파일 업로드 (Korea Report)</div>
            <input type="file" accept=".xlsx,.xls" onChange={e => setFile(e.target.files[0])} style={S.fileInput} />
            <button onClick={handleUpload} disabled={uploading || !isAuthed} style={S.btn}>
              {uploading ? '추출 중…' : '업로드 → 데이터 추출'}
            </button>
          </div>

          {/* 추출 결과 */}
          {result && (
            <div style={S.card}>
              <div style={S.cardTitle}>추출된 품질 데이터</div>
              <table style={S.table}>
                <tbody>
                  {Object.entries(result).map(([k, v]) => (
                    <tr key={k}>
                      <td style={S.td}>{k}</td>
                      <td style={{...S.td, textAlign:'right', color:'#38bdf8'}}>{v ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 파일 생성 */}
          <div style={S.card}>
            <div style={S.cardTitle}>파일 생성</div>
            <button onClick={handleGenExcel} disabled={generating || !isAuthed} style={S.btn}>
              {generating ? '생성 중…' : '2번 Excel 다운로드'}
            </button>
            <button disabled style={{...S.btn, background:'#334155', marginTop:8}}>
              3번 PPT 생성 (준비 중)
            </button>
          </div>

          {msg && <div style={S.msg}>{msg}</div>}
        </div>
        <BottomNav />
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
  fileInput: { display:'block', marginBottom:10, color:'#f1f5f9', fontSize:14 },
  btn: { width:'100%', padding:'11px 14px', background:'#3b82f6', color:'#fff', border:'none', borderRadius:9, fontSize:15, fontWeight:700, minHeight:44, cursor:'pointer' },
  table: { width:'100%', borderCollapse:'collapse', fontSize:13 },
  td: { padding:'5px 4px', borderBottom:'1px solid #1e293b', color:'#e2e8f0' },
  msg: { marginTop:12, padding:'10px 12px', background:'#0f2231', borderRadius:9, fontSize:14, color:'#7dd3fc' },
};
