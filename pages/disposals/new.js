import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/use-auth';
import BottomNav from '../../components/BottomNav';

const ACCOUNT_TYPES = ['기계장치', '비품', '차량운반구', '공기구', '시설장치', '기타'];
const DISPOSAL_CODES = ['폐기', '매각', '등록'];

function todayISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fmtINR(n) {
  if (n == null || isNaN(Number(n))) return '₹0';
  return '₹' + Number(n).toLocaleString('en-IN');
}

const STORAGE_BUCKET = 'asset-docs';

export default function DisposalNewPage() {
  const router = useRouter();
  const { isAuthed, loading: authLoading } = useAuth();

  // 양식 필드
  const [form, setForm] = useState({
    asset_no: '',
    account_type: '기계장치',
    asset_name: '',
    spec: '',
    disposal_code: '폐기',
    disposal_amount: '',
    disposal_qty: 1,
    disposal_date: todayISO(),
    disposal_destination: '',
    acquisition_cost: '',
    accumulated_depreciation: '',
    acquisition_year: '',
    disposal_reason_user: '',
    material_reuse: '',
    review_opinion: '',
  });

  const [photos, setPhotos]   = useState([]); // string[] of public URLs
  const [files, setFiles]     = useState([]); // {name, url}[]
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]     = useState(null);
  const [uploadBusy, setUploadBusy] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthed) {
      router.replace(`/login?next=${encodeURIComponent('/disposals/new')}`);
    }
  }, [authLoading, isAuthed, router]);

  // 자동 계산: 장부금액 = 취득가액 - 감가상각총당금
  const bookValue = useMemo(() => {
    const a = Number(form.acquisition_cost) || 0;
    const b = Number(form.accumulated_depreciation) || 0;
    return a - b;
  }, [form.acquisition_cost, form.accumulated_depreciation]);

  // 자동 계산: 처분가액 - 장부가액 (양수=이익, 음수=손실)
  const disposalVsBook = useMemo(() => {
    const d = Number(form.disposal_amount) || 0;
    return d - bookValue;
  }, [form.disposal_amount, bookValue]);

  // 자동 계산: 경과년수
  const yearsElapsed = useMemo(() => {
    const y = Number(form.acquisition_year);
    if (!y || y < 1900) return null;
    return new Date().getFullYear() - y;
  }, [form.acquisition_year]);

  function update(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  // ── Storage 업로드 (사진/파일 공통) ─────────────────────────────────
  async function uploadOne(file, prefix) {
    const ts = Date.now();
    const safe = (file.name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${prefix}/${ts}_${safe}`;
    const { error: upErr } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, file, { cacheControl: '3600', upsert: false });
    if (upErr) throw upErr;
    const { data: pub } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    return { name: file.name, url: pub.publicUrl, path };
  }

  async function onPhotoPick(e) {
    const list = Array.from(e.target.files || []);
    if (!list.length) return;
    setUploadBusy(true); setError(null);
    try {
      const results = [];
      for (const f of list) {
        if (!/^image\//.test(f.type)) continue;
        const r = await uploadOne(f, 'disposals/photos');
        results.push(r.url);
      }
      setPhotos(prev => [...prev, ...results]);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setUploadBusy(false);
      e.target.value = '';
    }
  }

  async function onFilePick(e) {
    const list = Array.from(e.target.files || []);
    if (!list.length) return;
    setUploadBusy(true); setError(null);
    try {
      const results = [];
      for (const f of list) {
        const r = await uploadOne(f, 'disposals/files');
        results.push({ name: f.name, url: r.url });
      }
      setFiles(prev => [...prev, ...results]);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setUploadBusy(false);
      e.target.value = '';
    }
  }

  function removePhoto(url) {
    setPhotos(prev => prev.filter(p => p !== url));
  }
  function removeFile(url) {
    setFiles(prev => prev.filter(f => f.url !== url));
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!form.asset_name.trim()) { setError('자산명은 필수입니다'); return; }
    if (!form.disposal_code)     { setError('처분코드를 선택하세요'); return; }

    setSubmitting(true); setError(null);
    try {
      const payload = {
        asset_no: form.asset_no.trim() || null,
        account_type: form.account_type || null,
        asset_name: form.asset_name.trim(),
        spec: form.spec.trim() || null,
        disposal_code: form.disposal_code,
        disposal_amount: Number(form.disposal_amount) || 0,
        disposal_qty: Number(form.disposal_qty) || 1,
        disposal_date: form.disposal_date || null,
        disposal_destination: form.disposal_destination.trim() || null,
        acquisition_cost: Number(form.acquisition_cost) || 0,
        accumulated_depreciation: Number(form.accumulated_depreciation) || 0,
        acquisition_year: form.acquisition_year ? Number(form.acquisition_year) : null,
        disposal_reason_user: form.disposal_reason_user.trim() || null,
        material_reuse: form.material_reuse.trim() || null,
        review_opinion: form.review_opinion.trim() || null,
        photos,
        files,
        status: 'pending',
      };

      const { data, error: insErr } = await supabase
        .from('fixed_asset_disposals')
        .insert(payload)
        .select('id')
        .single();
      if (insErr) throw insErr;

      router.replace(`/disposals/${data.id}`);
    } catch (err) {
      setError(err.message || String(err));
      setSubmitting(false);
    }
  }

  return (
    <>
      <Head>
        <title>처분 신청 | DSC FMS</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#0f172a" />
      </Head>
      <main style={S.page}>
        <header style={S.header}>
          <Link href="/disposals" style={S.backLink}>← 목록</Link>
          <h1 style={S.title}>고정자산 처분 신청</h1>
          <div style={{ width: 44 }} />
        </header>

        {authLoading ? (
          <div style={S.loading}>…</div>
        ) : (
          <form onSubmit={onSubmit} style={S.form}>
            {/* ── 1. 기본정보 ─────────────────────────────────────── */}
            <section style={S.section}>
              <h2 style={S.sectionTitle}>1. 기본 정보</h2>

              <Field label="자산NO">
                <input type="text" value={form.asset_no} onChange={(e) => update('asset_no', e.target.value)}
                  placeholder="예: DCMI-PRS-02" style={S.input} />
              </Field>

              <Field label="계정구분">
                <select value={form.account_type} onChange={(e) => update('account_type', e.target.value)} style={S.input}>
                  {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>

              <Field label="자산명 *">
                <input type="text" value={form.asset_name} onChange={(e) => update('asset_name', e.target.value)}
                  required placeholder="자산명 입력" style={S.input} />
              </Field>

              <Field label="규격">
                <input type="text" value={form.spec} onChange={(e) => update('spec', e.target.value)}
                  placeholder="예: 200TON" style={S.input} />
              </Field>
            </section>

            {/* ── 2. 처분정보 ─────────────────────────────────────── */}
            <section style={S.section}>
              <h2 style={S.sectionTitle}>2. 처분 정보</h2>

              <Field label="처분코드 *">
                <div style={S.segGroup}>
                  {DISPOSAL_CODES.map(code => {
                    const active = form.disposal_code === code;
                    return (
                      <button key={code} type="button" onClick={() => update('disposal_code', code)}
                        style={{ ...S.segBtn, ...(active ? S.segBtnActive : null) }}>
                        {code}
                      </button>
                    );
                  })}
                </div>
              </Field>

              <Field label="처분예정금액 (INR)">
                <input type="number" inputMode="decimal" min="0" value={form.disposal_amount}
                  onChange={(e) => update('disposal_amount', e.target.value)}
                  placeholder="0" style={S.input} />
              </Field>

              <Field label="처분수량">
                <input type="number" inputMode="numeric" min="1" value={form.disposal_qty}
                  onChange={(e) => update('disposal_qty', e.target.value)} style={S.input} />
              </Field>

              <Field label="처분예정일">
                <input type="date" value={form.disposal_date} onChange={(e) => update('disposal_date', e.target.value)} style={S.input} />
              </Field>

              <Field label="처분처">
                <input type="text" value={form.disposal_destination} onChange={(e) => update('disposal_destination', e.target.value)}
                  placeholder="예: 폐기물업체 / 매각처" style={S.input} />
              </Field>
            </section>

            {/* ── 3. 장부금액내역 ─────────────────────────────────── */}
            <section style={S.section}>
              <h2 style={S.sectionTitle}>3. 장부금액 내역</h2>

              <Field label="취득가액 (INR)">
                <input type="number" inputMode="decimal" min="0" value={form.acquisition_cost}
                  onChange={(e) => update('acquisition_cost', e.target.value)}
                  placeholder="0" style={S.input} />
              </Field>

              <Field label="감가상각총당금 (INR)">
                <input type="number" inputMode="decimal" min="0" value={form.accumulated_depreciation}
                  onChange={(e) => update('accumulated_depreciation', e.target.value)}
                  placeholder="0" style={S.input} />
              </Field>

              <Field label="취득연도">
                <input type="number" inputMode="numeric" min="1900" max="2100" value={form.acquisition_year}
                  onChange={(e) => update('acquisition_year', e.target.value)}
                  placeholder="예: 2015" style={S.input} />
              </Field>

              {/* 자동 계산 결과 */}
              <div style={S.computedBox}>
                <div style={S.computedRow}>
                  <span style={S.computedLabel}>장부금액 (자동)</span>
                  <span style={S.computedValue}>{fmtINR(bookValue)}</span>
                </div>
                <div style={S.computedRow}>
                  <span style={S.computedLabel}>처분가액 비교</span>
                  <span style={{
                    ...S.computedValue,
                    color: disposalVsBook >= 0 ? '#86efac' : '#fca5a5',
                  }}>
                    {disposalVsBook >= 0 ? '+' : ''}{fmtINR(disposalVsBook)}
                    <span style={S.computedHint}>
                      {' '}({disposalVsBook >= 0 ? '이익' : '손실'})
                    </span>
                  </span>
                </div>
                {yearsElapsed != null && (
                  <div style={S.computedRow}>
                    <span style={S.computedLabel}>경과년수 (자동)</span>
                    <span style={S.computedValue}>{yearsElapsed}년</span>
                  </div>
                )}
              </div>
            </section>

            {/* ── 4. 사유 및 의견 ─────────────────────────────────── */}
            <section style={S.section}>
              <h2 style={S.sectionTitle}>4. 사유 및 의견</h2>

              <Field label="처분사유 (사용부서)">
                <textarea value={form.disposal_reason_user}
                  onChange={(e) => update('disposal_reason_user', e.target.value)}
                  rows={3} placeholder="예: 노후화로 인한 정밀도 저하…" style={S.textarea} />
              </Field>

              <Field label="자재재활용 내용">
                <textarea value={form.material_reuse}
                  onChange={(e) => update('material_reuse', e.target.value)}
                  rows={2} placeholder="예: 모터, 베어링 재활용 가능" style={S.textarea} />
              </Field>

              <Field label="검토의견 (집행부서)">
                <textarea value={form.review_opinion}
                  onChange={(e) => update('review_opinion', e.target.value)}
                  rows={2} placeholder="예: 폐기 처리 적정" style={S.textarea} />
              </Field>
            </section>

            {/* ── 5. 첨부 ────────────────────────────────────────── */}
            <section style={S.section}>
              <h2 style={S.sectionTitle}>5. 첨부 파일</h2>

              <Field label="사진">
                {photos.length > 0 && (
                  <div style={S.photoGrid}>
                    {photos.map((url, i) => (
                      <div key={url} style={S.photoTile}>
                        <a href={url} target="_blank" rel="noopener">
                          <img src={url} alt={`photo ${i+1}`} style={S.photoImg} />
                        </a>
                        <button type="button" onClick={() => removePhoto(url)} style={S.tileDelBtn} aria-label="삭제">×</button>
                      </div>
                    ))}
                  </div>
                )}
                <label style={S.uploadBtn}>
                  {uploadBusy ? '업로드 중…' : '📷 사진 추가'}
                  <input type="file" accept="image/*" capture="environment" multiple
                    onChange={onPhotoPick} disabled={uploadBusy} style={{ display: 'none' }} />
                </label>
              </Field>

              <Field label="파일 (Excel · PDF 등)">
                {files.length > 0 && (
                  <ul style={S.fileList}>
                    {files.map(f => (
                      <li key={f.url} style={S.fileItem}>
                        <a href={f.url} target="_blank" rel="noopener" style={S.fileLink}>📄 {f.name}</a>
                        <button type="button" onClick={() => removeFile(f.url)} style={S.fileDelBtn} aria-label="삭제">×</button>
                      </li>
                    ))}
                  </ul>
                )}
                <label style={S.uploadBtn}>
                  {uploadBusy ? '업로드 중…' : '📎 파일 추가'}
                  <input type="file" multiple onChange={onFilePick} disabled={uploadBusy} style={{ display: 'none' }} />
                </label>
              </Field>
            </section>

            {error && <div style={S.errorBox}>{error}</div>}

            <div style={S.actionBar}>
              <button type="button" onClick={() => router.push('/disposals')} style={S.cancelBtn}>취소</button>
              <button type="submit" disabled={submitting || uploadBusy} style={S.submitBtn}>
                {submitting ? '제출 중…' : '신청 제출'}
              </button>
            </div>
          </form>
        )}
      </main>
      <BottomNav />
    </>
  );
}

function Field({ label, children }) {
  return (
    <label style={S.field}>
      <span style={S.fieldLabel}>{label}</span>
      {children}
    </label>
  );
}

const S = {
  page: {
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans Tamil", "Noto Sans KR", sans-serif',
    background: '#0f172a', minHeight: '100vh', color: '#e2e8f0',
    paddingBottom: 'calc(60px + env(safe-area-inset-bottom, 0px) + 24px)',
    maxWidth: 480, margin: '0 auto',
  },
  header: {
    position: 'sticky', top: 0, zIndex: 20,
    background: '#0f172a', borderBottom: '1px solid #1f2937',
    padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10,
  },
  backLink: { color: '#94a3b8', textDecoration: 'none', fontSize: 14, minHeight: 44,
    display: 'inline-flex', alignItems: 'center', padding: '0 4px' },
  title: { flex: 1, fontSize: 17, fontWeight: 700, margin: 0, color: '#f8fafc', textAlign: 'center' },
  loading: { padding: 48, textAlign: 'center', color: '#64748b' },

  form: { padding: '8px 14px 16px' },

  section: {
    background: '#1e293b', border: '1px solid #334155', borderRadius: 12,
    padding: 14, marginBottom: 12,
  },
  sectionTitle: { fontSize: 14, fontWeight: 700, margin: '0 0 12px', color: '#f8fafc' },

  field: { display: 'block', marginBottom: 12 },
  fieldLabel: { display: 'block', fontSize: 12, color: '#94a3b8',
    fontWeight: 600, marginBottom: 6, letterSpacing: 0.3 },

  input: {
    width: '100%', padding: '11px 12px',
    background: '#0f172a', color: '#f1f5f9',
    border: '1px solid #334155', borderRadius: 8,
    fontSize: 16, outline: 'none', boxSizing: 'border-box', minHeight: 44,
  },
  textarea: {
    width: '100%', padding: '11px 12px',
    background: '#0f172a', color: '#f1f5f9',
    border: '1px solid #334155', borderRadius: 8,
    fontSize: 16, outline: 'none', boxSizing: 'border-box',
    fontFamily: 'inherit', resize: 'vertical',
  },

  segGroup: { display: 'flex', gap: 6 },
  segBtn: {
    flex: 1, padding: '11px 8px',
    background: '#0f172a', color: '#94a3b8',
    border: '1px solid #334155', borderRadius: 8,
    fontSize: 14, fontWeight: 600, cursor: 'pointer', minHeight: 44,
  },
  segBtnActive: { background: '#dc2626', color: '#fff', borderColor: '#dc2626' },

  computedBox: {
    marginTop: 8, padding: 12,
    background: '#0f172a', border: '1px dashed #334155', borderRadius: 8,
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  computedRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    fontSize: 13,
  },
  computedLabel: { color: '#94a3b8' },
  computedValue: {
    color: '#fbbf24', fontWeight: 700,
    fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
  },
  computedHint: { fontSize: 11, fontWeight: 500, opacity: 0.85 },

  photoGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6,
    marginBottom: 8,
  },
  photoTile: { position: 'relative' },
  photoImg: { width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 6, display: 'block' },
  tileDelBtn: {
    position: 'absolute', top: 4, right: 4,
    background: 'rgba(0,0,0,0.65)', color: '#fff',
    width: 24, height: 24, borderRadius: '50%', border: 'none',
    fontSize: 16, lineHeight: '20px', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },

  fileList: { listStyle: 'none', margin: '0 0 8px', padding: 0,
    display: 'flex', flexDirection: 'column', gap: 6 },
  fileItem: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '8px 10px', background: '#0f172a',
    border: '1px solid #334155', borderRadius: 8,
  },
  fileLink: { flex: 1, color: '#93c5fd', textDecoration: 'none', fontSize: 13,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  fileDelBtn: {
    background: '#334155', color: '#cbd5e1', border: 'none',
    width: 24, height: 24, borderRadius: '50%', cursor: 'pointer',
    fontSize: 14, lineHeight: '20px',
  },

  uploadBtn: {
    display: 'block', textAlign: 'center',
    padding: '12px', border: '2px dashed #334155', borderRadius: 8,
    background: '#0f172a', color: '#94a3b8',
    fontSize: 14, fontWeight: 600, cursor: 'pointer', minHeight: 44,
  },

  errorBox: {
    margin: '12px 0', padding: 12,
    background: 'rgba(220,38,38,0.15)', color: '#fca5a5',
    border: '1px solid rgba(220,38,38,0.4)', borderRadius: 10, fontSize: 13,
  },

  actionBar: {
    display: 'flex', gap: 8, marginTop: 16,
    position: 'sticky', bottom: 'calc(60px + env(safe-area-inset-bottom, 0px))',
    background: '#0f172a', paddingTop: 8,
  },
  cancelBtn: {
    flex: 1, padding: '14px', background: '#334155', color: '#cbd5e1',
    border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700,
    cursor: 'pointer', minHeight: 48,
  },
  submitBtn: {
    flex: 2, padding: '14px', background: '#dc2626', color: '#fff',
    border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700,
    cursor: 'pointer', minHeight: 48,
    boxShadow: '0 4px 12px rgba(220,38,38,0.4)',
  },
};
