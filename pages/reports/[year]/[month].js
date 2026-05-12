// 경영실적 월별 상세 — 3탭(생산성/품질/주간업무) + 파일생성 섹션
import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../lib/use-auth';
import BottomNav from '../../../components/BottomNav';

const FX_2026 = 15.5;

const PROD_FIELDS = [
  { key: 'plan_qty',       label: '생산량 계획 (EA)' },
  { key: 'actual_qty',     label: '생산량 실적 (EA)' },
  { key: 'plan_eff',       label: '생산효율 계획 (%)' },
  { key: 'actual_eff',     label: '생산효율 실적 (%)' },
  { key: 'plan_uptime',    label: '설비가동률 계획 (%)' },
  { key: 'actual_uptime',  label: '설비가동률 실적 (%)' },
  { key: 'plan_oee',       label: 'OEE 계획 (%)' },
  { key: 'actual_oee',     label: 'OEE 실적 (%)' },
  { key: 'direct_hc',      label: '직접인원 (명)' },
  { key: 'indirect_hc',    label: '간접인원 (명)' },
  { key: 'plan_rev_pp',    label: '인당매출 계획 (천원)' },
  { key: 'actual_rev_pp',  label: '인당매출 실적 (천원)' },
];

const QUALITY_FIELDS = [
  { key: 'customer_count',  label: '고객불량 건수' },
  { key: 'customer_ppm',    label: '고객불량 PPM' },
  { key: 'inprocess_count', label: '공정불량 건수' },
  { key: 'inprocess_ppm',   label: '공정불량 PPM' },
  { key: 'incoming_count',  label: '입고불량 건수' },
  { key: 'incoming_ppm',    label: '입고불량 PPM' },
  { key: 'claim_cost',      label: '클레임비 (백만원)' },
  { key: 'scrap_cost',      label: '폐기비 (백만원)' },
  { key: 'revenue_inr',     label: '매출액 (INR)' },
  { key: 'cost_save',       label: '원가절감 실적 (백만원)' },
];

export default function ReportDetail() {
  const router = useRouter();
  const { year, month } = router.query;
  const { isAuthed } = useAuth();

  const [tab, setTab] = useState('production'); // production | quality | weekly
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  const [prod, setProd] = useState({});
  const [quality, setQuality] = useState({});
  const [weekly, setWeekly] = useState([]);
  const [extracting, setExtracting] = useState(false);
  const [generatingXlsx, setGeneratingXlsx] = useState(false);
  const [generatingPpt, setGeneratingPpt] = useState(false);
  const fileRef = useRef(null);

  async function load() {
    if (!year || !month) return;
    setLoading(true); setErr(null);
    try {
      const res = await fetch(`/api/reports/${year}/${month}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'load failed');
      setItem(json.item);
      setProd(json.item.production || {});
      setQuality(json.item.quality || {});
      const w = Array.isArray(json.item.weekly_tasks) ? json.item.weekly_tasks : [];
      const filled = [1,2,3,4,5].map((n) => {
        const hit = w.find((t) => t.week === n);
        return { week: n, content: hit?.content || '' };
      });
      setWeekly(filled);
    } catch (e) {
      setErr(e.message);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [year, month]);

  function flash(text) {
    setMsg(text);
    setTimeout(() => setMsg(null), 2200);
  }

  async function patch(payload) {
    if (!isAuthed) { alert('로그인이 필요합니다'); return null; }
    setSaving(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      const res = await fetch(`/api/reports/${year}/${month}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'save failed');
      setItem(json.item);
      return json.item;
    } catch (e) {
      alert('저장 실패: ' + e.message);
      return null;
    } finally { setSaving(false); }
  }

  async function saveProduction() {
    const out = await patch({ production: prod });
    if (out) flash('생산성 저장 완료');
  }
  async function saveQuality() {
    const out = await patch({ quality });
    if (out) flash('품질지수 저장 완료');
  }
  async function saveWeekly() {
    const out = await patch({ weekly_tasks: weekly.filter((w) => w.content && w.content.trim() !== '') });
    if (out) flash('주간업무 저장 완료');
  }

  async function uploadAndExtract(file) {
    if (!file) return;
    if (!isAuthed) { alert('로그인이 필요합니다'); return; }
    setExtracting(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/reports/${year}/${month}/extract`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'extract failed');
      setItem(json.item);
      setQuality(json.item.quality || {});
      const found = Object.keys(json.extracted || {});
      flash(found.length ? `자동 추출: ${found.length}개 항목` : '추출된 값 없음 - 수동 입력 필요');
    } catch (e) {
      alert('추출 실패: ' + e.message);
    } finally { setExtracting(false); }
  }

  async function generateExcel() {
    setGeneratingXlsx(true);
    try {
      const res = await fetch(`/api/reports/${year}/${month}/generate/excel`, { method: 'POST' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'generate failed');
      }
      const blob = await res.blob();
      const cd = res.headers.get('Content-Disposition') || '';
      const fname = decodeURIComponent((cd.match(/filename\*=UTF-8''([^;]+)/) || [])[1] || `report_${year}_${month}.xlsx`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = fname; a.click();
      URL.revokeObjectURL(url);
      flash('Excel 다운로드 시작');
      load();
    } catch (e) {
      alert('Excel 생성 실패: ' + e.message);
    } finally { setGeneratingXlsx(false); }
  }

  async function generatePpt() {
    setGeneratingPpt(true);
    try {
      const res = await fetch(`/api/reports/${year}/${month}/generate/ppt`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'ppt failed');
      flash(json.message || 'PPT 작업 요청됨');
      load();
    } catch (e) {
      alert('PPT 요청 실패: ' + e.message);
    } finally { setGeneratingPpt(false); }
  }

  const revInr = parseFloat(quality.revenue_inr);
  const revKrwMil = !isNaN(revInr) ? (revInr * FX_2026 / 1_000_000) : null;

  return (
    <>
      <Head><title>{year}년 {month}월 경영실적 | DSC FMS</title></Head>
      <div style={S.page}>
        <div style={S.wrap}>
          <div style={S.bread}>
            <Link href="/reports" style={S.breadLink}>← 경영실적</Link>
          </div>
          <h1 style={S.h1}>{year}년 {month}월</h1>

          {loading && <div style={S.muted}>불러오는 중…</div>}
          {err && <div style={S.err}>에러: {err}</div>}

          {item && (
            <>
              <div style={S.tabs}>
                <TabBtn active={tab === 'production'} onClick={() => setTab('production')}>생산성</TabBtn>
                <TabBtn active={tab === 'quality'} onClick={() => setTab('quality')}>품질지수</TabBtn>
                <TabBtn active={tab === 'weekly'} onClick={() => setTab('weekly')}>주간업무</TabBtn>
              </div>

              {tab === 'production' && (
                <div style={S.panel}>
                  {PROD_FIELDS.map((f) => (
                    <FieldNum key={f.key} label={f.label}
                      value={prod[f.key] ?? ''}
                      onChange={(v) => setProd({ ...prod, [f.key]: v })}
                    />
                  ))}
                  <FieldText label="비고"
                    value={prod.note || ''}
                    onChange={(v) => setProd({ ...prod, note: v })}
                  />
                  <button onClick={saveProduction} disabled={saving || !isAuthed} style={S.saveBtn}>
                    {saving ? '저장 중…' : '저장'}
                  </button>
                </div>
              )}

              {tab === 'quality' && (
                <div style={S.panel}>
                  <div style={S.uploadRow}>
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".xlsx,.xls"
                      style={{ display: 'none' }}
                      onChange={(e) => uploadAndExtract(e.target.files?.[0])}
                    />
                    <button
                      onClick={() => fileRef.current?.click()}
                      disabled={extracting || !isAuthed}
                      style={S.uploadBtn}
                    >
                      {extracting ? '추출 중…' : '1번 파일 업로드 (자동 채움)'}
                    </button>
                    {item.source_file?.filename && (
                      <div style={S.srcInfo}>최근: {item.source_file.filename}</div>
                    )}
                  </div>

                  {QUALITY_FIELDS.map((f) => (
                    <FieldNum key={f.key} label={f.label}
                      value={quality[f.key] ?? ''}
                      onChange={(v) => setQuality({ ...quality, [f.key]: v })}
                    />
                  ))}
                  <div style={S.fxRow}>
                    환율 {FX_2026} 적용 매출액:&nbsp;
                    <b style={{ color: '#22c55e' }}>
                      {revKrwMil != null ? revKrwMil.toFixed(1) + ' 백만원' : '—'}
                    </b>
                  </div>
                  <FieldText label="비고"
                    value={quality.note || ''}
                    onChange={(v) => setQuality({ ...quality, note: v })}
                  />
                  <button onClick={saveQuality} disabled={saving || !isAuthed} style={S.saveBtn}>
                    {saving ? '저장 중…' : '저장'}
                  </button>
                </div>
              )}

              {tab === 'weekly' && (
                <div style={S.panel}>
                  {weekly.map((w, idx) => (
                    <div key={w.week} style={{ marginBottom: 12 }}>
                      <label style={S.fieldLabel}>{w.week}주차</label>
                      <textarea
                        value={w.content}
                        onChange={(e) => {
                          const next = [...weekly];
                          next[idx] = { ...w, content: e.target.value };
                          setWeekly(next);
                        }}
                        placeholder="주요 업무, 이슈, 계획"
                        rows={4}
                        style={S.textarea}
                      />
                    </div>
                  ))}
                  <button onClick={saveWeekly} disabled={saving || !isAuthed} style={S.saveBtn}>
                    {saving ? '저장 중…' : '저장'}
                  </button>
                </div>
              )}

              {/* 파일 생성 섹션 */}
              <div style={S.fileBlock}>
                <div style={S.fileBlockTitle}>파일 생성</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button onClick={generateExcel} disabled={generatingXlsx} style={S.fileBtn}>
                    {generatingXlsx ? '생성 중…' : '2번 파일 생성 (Excel)'}
                  </button>
                  <div style={S.fileMeta}>
                    {item.file_status?.excel
                      ? `최근: ${new Date(item.file_status.excel.generated_at).toLocaleString()} — ${item.file_status.excel.filename}`
                      : '아직 생성되지 않음'}
                  </div>
                  <button onClick={generatePpt} disabled={generatingPpt} style={{ ...S.fileBtn, background: '#475569' }}>
                    {generatingPpt ? '요청 중…' : '3번 파일 생성 (PPT)'}
                  </button>
                  <div style={S.fileMeta}>
                    {item.file_status?.ppt
                      ? `상태: ${item.file_status.ppt.status} (${new Date(item.file_status.ppt.requested_at).toLocaleString()})`
                      : 'PPT 생성은 서버 작업으로 처리됩니다'}
                  </div>
                </div>
              </div>
            </>
          )}

          {msg && <div style={S.toast}>{msg}</div>}
        </div>
        <BottomNav />
      </div>
    </>
  );
}

function TabBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: '10px 8px', background: 'transparent',
      color: active ? '#f1f5f9' : '#94a3b8', fontWeight: active ? 700 : 500,
      border: 'none', borderBottom: active ? '2px solid #3b82f6' : '2px solid transparent',
      fontSize: 14, cursor: 'pointer', minHeight: 44,
    }}>{children}</button>
  );
}

function FieldNum({ label, value, onChange }) {
  return (
    <div style={S.field}>
      <label style={S.fieldLabel}>{label}</label>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value === '' ? '' : e.target.value)}
        style={S.input}
      />
    </div>
  );
}

function FieldText({ label, value, onChange }) {
  return (
    <div style={S.field}>
      <label style={S.fieldLabel}>{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        style={S.textarea}
      />
    </div>
  );
}

const S = {
  page: { minHeight: '100vh', background: '#0f172a', color: '#f1f5f9', paddingBottom: 90 },
  wrap: { maxWidth: 480, margin: '0 auto', padding: '12px 14px 0' },
  bread: { marginBottom: 4 },
  breadLink: { color: '#94a3b8', textDecoration: 'none', fontSize: 13 },
  h1: { fontSize: 22, margin: '4px 0 12px', fontWeight: 800 },
  muted: { color: '#94a3b8' },
  err: { color: '#fca5a5' },
  tabs: {
    display: 'flex', gap: 0, borderBottom: '1px solid #334155', marginBottom: 12,
  },
  panel: { marginTop: 4 },
  field: { marginBottom: 12 },
  fieldLabel: {
    display: 'block', fontSize: 13, color: '#cbd5e1', marginBottom: 4, fontWeight: 600,
  },
  input: {
    width: '100%', padding: '10px 12px',
    background: '#0f172a', color: '#f1f5f9',
    border: '1px solid #334155', borderRadius: 8,
    fontSize: 16, minHeight: 44, boxSizing: 'border-box',
  },
  textarea: {
    width: '100%', padding: '10px 12px',
    background: '#0f172a', color: '#f1f5f9',
    border: '1px solid #334155', borderRadius: 8,
    fontSize: 16, boxSizing: 'border-box', resize: 'vertical',
    fontFamily: 'inherit',
  },
  saveBtn: {
    width: '100%', padding: '12px 14px', background: '#3b82f6', color: '#fff',
    border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 700,
    minHeight: 44, cursor: 'pointer', marginTop: 6,
  },
  uploadRow: {
    background: '#1e293b', border: '1px solid #334155', borderRadius: 10,
    padding: 10, marginBottom: 14,
  },
  uploadBtn: {
    width: '100%', padding: '10px 12px', background: '#22c55e', color: '#0f172a',
    border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 14, minHeight: 44,
    cursor: 'pointer',
  },
  srcInfo: { marginTop: 6, fontSize: 12, color: '#94a3b8' },
  fxRow: {
    margin: '4px 0 12px', padding: '8px 10px',
    background: '#0b1220', border: '1px solid #334155', borderRadius: 8, fontSize: 13,
  },
  fileBlock: {
    marginTop: 18, padding: 12,
    background: '#1e293b', border: '1px solid #334155', borderRadius: 10,
  },
  fileBlockTitle: { fontSize: 14, fontWeight: 700, marginBottom: 8, color: '#cbd5e1' },
  fileBtn: {
    width: '100%', padding: '11px 14px', background: '#3b82f6', color: '#fff',
    border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700,
    minHeight: 44, cursor: 'pointer',
  },
  fileMeta: { fontSize: 11, color: '#94a3b8', marginBottom: 4 },
  toast: {
    position: 'fixed', left: '50%', bottom: 78,
    transform: 'translateX(-50%)',
    background: '#22c55e', color: '#0f172a',
    padding: '8px 16px', borderRadius: 999, fontSize: 13, fontWeight: 700,
    zIndex: 60,
  },
};
