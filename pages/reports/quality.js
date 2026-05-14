import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/use-auth';
import BottomNav from '../../components/BottomNav';
import FileDropZone from '../../components/reports/FileDropZone';

export default function QualityReportPage() {
  const { user, isAuthed } = useAuth();

  const today = new Date();
  const [year,  setYear ] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  const [prevExcel, setPrevExcel] = useState(null);
  const [prevPpt,   setPrevPpt]   = useState(null);
  const [dataExcel, setDataExcel] = useState(null);

  const [busy,   setBusy]   = useState(false);
  const [step,   setStep]   = useState('');
  const [error,  setError]  = useState(null);
  const [result, setResult] = useState(null); // { excel:{url,filename}, ppt:{...} }

  const [history, setHistory] = useState([]);
  const [histLoading, setHistLoading] = useState(true);

  const targetMonth = `${year}-${String(month).padStart(2, '0')}-01`;
  const monthLabel  = `${year}년 ${String(month).padStart(2, '0')}월`;
  const canGenerate = prevExcel && prevPpt && dataExcel && !busy && isAuthed;

  function prevM() { if (month === 1) { setYear(y => y - 1); setMonth(12); } else setMonth(m => m - 1); }
  function nextM() { if (month === 12) { setYear(y => y + 1); setMonth(1); } else setMonth(m => m + 1); }

  async function loadHistory() {
    setHistLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) { setHistLoading(false); return; }
    try {
      const r = await fetch('/api/reports/quality/history', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) setHistory(j.items || []);
    } catch (_) {}
    setHistLoading(false);
  }

  useEffect(() => {
    if (user) loadHistory();
  }, [user]);

  // ── Chunked upload (Vercel free tier 4.5MB body limit workaround) ──
  // Slice each file into ≤4MB chunks, POST sequentially to chunk-upload,
  // then finalize. Retries 3× per chunk before giving up.
  const CHUNK_SIZE = 4 * 1024 * 1024; // 4 MB
  const MAX_RETRY = 3;

  function newUploadId() {
    return 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  async function postChunk(token, body) {
    let lastErr = null;
    for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
      try {
        const r = await fetch('/api/reports/quality/chunk-upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body,
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.detail || j.error || `HTTP ${r.status}`);
        return j;
      } catch (e) {
        lastErr = e;
        if (attempt < MAX_RETRY) {
          await new Promise(res => setTimeout(res, 400 * attempt));
        }
      }
    }
    throw lastErr;
  }

  async function uploadFileInChunks({ token, uploadId, fileKey, file, onProgress }) {
    const total = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));
    for (let i = 0; i < total; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const blob = file.slice(start, end);
      const fd = new FormData();
      fd.append('upload_id', uploadId);
      fd.append('file_key', fileKey);
      fd.append('chunk_index', String(i));
      fd.append('total_chunks', String(total));
      if (i === 0) fd.append('file_name', file.name || '');
      fd.append('chunk', blob, `${fileKey}.${i}.bin`);
      // eslint-disable-next-line no-await-in-loop
      await postChunk(token, fd);
      if (onProgress) onProgress(i + 1, total);
    }
  }

  async function onGenerate() {
    if (!canGenerate) return;
    setBusy(true); setError(null); setResult(null);
    try {
      setStep('인증 확인 중…');
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('로그인이 필요합니다');

      const uploadId = newUploadId();
      const fileList = [
        { key: 'prev_excel', file: prevExcel, label: '① 전월 Excel' },
        { key: 'prev_ppt',   file: prevPpt,   label: '② 전월 PPT'   },
        { key: 'data_excel', file: dataExcel, label: '③ 현월 데이터' },
      ];

      for (let fi = 0; fi < fileList.length; fi++) {
        const { key, file, label } = fileList[fi];
        const sizeMB = (file.size / 1024 / 1024).toFixed(1);
        setStep(`${label} 업로드 중… (${sizeMB} MB)`);
        // eslint-disable-next-line no-await-in-loop
        await uploadFileInChunks({
          token,
          uploadId,
          fileKey: key,
          file,
          onProgress: (done, total) => {
            setStep(`${label} 업로드 중… ${done}/${total} 청크 (${sizeMB} MB)`);
          },
        });
      }

      setStep('보고서 생성 중… (수십초 소요)');
      const finalizeFd = new FormData();
      finalizeFd.append('upload_id', uploadId);
      finalizeFd.append('finalize', 'true');
      finalizeFd.append('target_month', targetMonth);
      const r = await fetch('/api/reports/quality/chunk-upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: finalizeFd,
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.detail || j.error || `HTTP ${r.status}`);

      setResult(j);
      setStep('완료');
      loadHistory();
    } catch (e) {
      setError(String(e.message || e));
      setStep('');
    } finally {
      setBusy(false);
    }
  }

  async function downloadFromHistory(id, type) {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    const r = await fetch(`/api/reports/quality/download?id=${id}&type=${type}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.url) { alert(j.error || '다운로드 실패'); return; }
    window.location.href = j.url;
  }

  return (
    <>
      <Head>
        <title>품질 월보고서 | DSC FMS</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#0f172a" />
      </Head>
      <main style={S.page}>
        <header style={S.header}>
          <Link href="/" style={S.backBtn} aria-label="홈으로">←</Link>
          <h1 style={S.title}>품질 월보고서</h1>
          <div style={{ width: 44 }} />
        </header>

        {/* 대상 월 */}
        <section style={S.section}>
          <div style={S.sectionLabel}>대상 월</div>
          <div style={S.monthPicker}>
            <button onClick={prevM} style={S.monthBtn} disabled={busy}>‹</button>
            <span style={S.monthLabel}>{monthLabel}</span>
            <button onClick={nextM} style={S.monthBtn} disabled={busy}>›</button>
          </div>
        </section>

        {/* 파일 업로드 */}
        <section style={S.section}>
          <div style={S.sectionLabel}>파일 업로드 (3개)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <FileDropZone
              label="① 전월 완성본 Excel"
              subLabel="경영실적 성과지표 보고양식(품질).xlsx"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              file={prevExcel}
              onFile={setPrevExcel}
              onClear={() => setPrevExcel(null)}
              disabled={busy}
            />
            <FileDropZone
              label="② 전월 완성본 PPT"
              subLabel="월간 전사 품질현황 보고서.pptx"
              accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
              file={prevPpt}
              onFile={setPrevPpt}
              onClear={() => setPrevPpt(null)}
              disabled={busy}
            />
            <FileDropZone
              label="③ 현월 기초데이터 Excel"
              subLabel="Korea Report 등 raw data .xlsx"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              file={dataExcel}
              onFile={setDataExcel}
              onClear={() => setDataExcel(null)}
              disabled={busy}
            />
          </div>
        </section>

        {/* 생성 버튼 */}
        <section style={S.section}>
          <button
            onClick={onGenerate}
            disabled={!canGenerate}
            style={{
              ...S.genBtn,
              opacity: canGenerate ? 1 : 0.5,
              cursor: canGenerate ? 'pointer' : 'not-allowed',
            }}
          >
            {busy ? '생성 중…' : '보고서 생성'}
          </button>
          {!isAuthed && <div style={S.errorBox}>로그인 후 보고서 생성이 가능합니다.</div>}
          {step && <div style={S.stepText}>{step}</div>}
          {error && <div style={S.errorBox}>{error}</div>}
        </section>

        {/* 결과 */}
        {result && (
          <section style={S.section}>
            <div style={S.sectionLabel}>다운로드</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <a href={result.excel?.url} style={S.dlCard} download={result.excel?.filename}>
                <span style={S.dlIcon}>XLSX</span>
                <span style={S.dlName}>{result.excel?.filename}</span>
                <span style={S.dlArrow}>↓</span>
              </a>
              <a href={result.ppt?.url} style={S.dlCard} download={result.ppt?.filename}>
                <span style={{ ...S.dlIcon, background: '#b91c1c' }}>PPTX</span>
                <span style={S.dlName}>{result.ppt?.filename}</span>
                <span style={S.dlArrow}>↓</span>
              </a>
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 8 }}>
              링크는 10분 후 만료됩니다. 이력에서 다시 받을 수 있습니다.
            </div>
          </section>
        )}

        {/* 이력 */}
        <section style={S.section}>
          <div style={S.sectionLabel}>생성 이력 (최근)</div>
          {histLoading && <div style={S.emptyText}>불러오는 중…</div>}
          {!histLoading && history.length === 0 && <div style={S.emptyText}>이력이 없습니다</div>}
          {!histLoading && history.map(h => (
            <div key={h.id} style={S.histRow}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>
                  {h.target_month?.slice(0, 7) || '-'}
                  <span style={{ ...S.pill, ...(h.status === 'done' ? S.pillOk : h.status === 'error' ? S.pillErr : S.pillRun) }}>
                    {h.status}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                  {new Date(h.created_at).toLocaleString('ko-KR')}
                </div>
                {h.error_msg && (
                  <div style={{ fontSize: 11, color: '#fca5a5', marginTop: 2 }}>{h.error_msg}</div>
                )}
              </div>
              {h.status === 'done' && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => downloadFromHistory(h.id, 'excel')} style={S.histBtn}>XLSX</button>
                  <button onClick={() => downloadFromHistory(h.id, 'ppt')} style={{ ...S.histBtn, borderColor: '#b91c1c', color: '#fca5a5' }}>PPTX</button>
                </div>
              )}
            </div>
          ))}
        </section>
      </main>
      <BottomNav />
    </>
  );
}

const S = {
  page:    { fontFamily: 'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif', background: '#0f172a', minHeight: '100vh', color: '#e2e8f0', paddingBottom: 'calc(60px + env(safe-area-inset-bottom,0px) + 24px)', maxWidth: 480, margin: '0 auto' },
  header:  { position: 'sticky', top: 0, zIndex: 20, background: '#0f172a', borderBottom: '1px solid #1f2937', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 2px 8px rgba(0,0,0,0.4)' },
  backBtn: { width: 44, height: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0', fontSize: 20, textDecoration: 'none' },
  title:   { fontSize: 17, fontWeight: 700, margin: 0, color: '#f8fafc' },
  section: { padding: '14px 14px 0' },
  sectionLabel: { fontSize: 12, fontWeight: 700, color: '#94a3b8', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  monthPicker:  { display: 'flex', alignItems: 'center', gap: 10 },
  monthBtn:     { width: 44, height: 44, background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0', fontSize: 22, cursor: 'pointer' },
  monthLabel:   { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: 700, color: '#f1f5f9', fontFamily: 'ui-monospace,Menlo,Consolas,monospace' },
  genBtn:  { width: '100%', height: 52, borderRadius: 10, border: 'none', background: '#dc2626', color: '#fff', fontSize: 16, fontWeight: 700, boxShadow: '0 2px 8px rgba(220,38,38,0.4)' },
  stepText:{ fontSize: 12, color: '#fbbf24', marginTop: 10, textAlign: 'center' },
  errorBox:{ margin: '10px 0 0', padding: 12, background: 'rgba(220,38,38,0.15)', color: '#fca5a5', border: '1px solid rgba(220,38,38,0.4)', borderRadius: 10, fontSize: 13, whiteSpace: 'pre-wrap', wordBreak: 'break-word' },
  dlCard:  { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: '#1e293b', border: '1px solid #334155', borderRadius: 10, textDecoration: 'none', color: '#e2e8f0' },
  dlIcon:  { background: '#16a34a', color: '#fff', fontSize: 11, fontWeight: 800, padding: '4px 8px', borderRadius: 5, flexShrink: 0 },
  dlName:  { flex: 1, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  dlArrow: { color: '#94a3b8', fontSize: 18 },
  histRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderBottom: '1px solid #1f2937' },
  histBtn: { height: 36, padding: '0 12px', borderRadius: 6, border: '1px solid #16a34a', background: 'transparent', color: '#86efac', fontSize: 12, fontWeight: 700, cursor: 'pointer' },
  pill:    { marginLeft: 8, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, verticalAlign: 'middle' },
  pillOk:  { background: 'rgba(22,163,74,0.2)',  color: '#86efac', border: '1px solid #16a34a' },
  pillErr: { background: 'rgba(220,38,38,0.2)',  color: '#fca5a5', border: '1px solid #dc2626' },
  pillRun: { background: 'rgba(234,179,8,0.2)',  color: '#fcd34d', border: '1px solid #eab308' },
  emptyText: { padding: '16px 0', textAlign: 'center', color: '#475569', fontSize: 13 },
};
