import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/use-auth';
import BottomNav from '../../components/BottomNav';
import AttachmentManager from '../../components/AttachmentManager';

const CODE_PILL = {
  '폐기': { bg: 'rgba(220,38,38,0.18)',  fg: '#fca5a5', border: 'rgba(220,38,38,0.6)' },
  '매각': { bg: 'rgba(249,115,22,0.18)', fg: '#fdba74', border: 'rgba(249,115,22,0.6)' },
  '등록': { bg: 'rgba(34,197,94,0.18)',  fg: '#86efac', border: 'rgba(34,197,94,0.6)' },
};

const STATUS_PILL = {
  draft:    { bg: 'rgba(100,116,139,0.2)', fg: '#cbd5e1', border: 'rgba(100,116,139,0.6)', label: 'DRAFT' },
  pending:  { bg: 'rgba(234,179,8,0.18)',  fg: '#fde68a', border: 'rgba(234,179,8,0.6)',  label: 'PENDING' },
  approved: { bg: 'rgba(34,197,94,0.18)',  fg: '#86efac', border: 'rgba(34,197,94,0.6)',  label: 'APPROVED' },
  rejected: { bg: 'rgba(220,38,38,0.18)',  fg: '#fca5a5', border: 'rgba(220,38,38,0.6)',  label: 'REJECTED' },
};

const STATUS_NEXT = {
  draft:    [{ to: 'pending',  label: '제출' },                              { to: 'approved', label: '바로 승인' }],
  pending:  [{ to: 'approved', label: '승인' }, { to: 'rejected', label: '반려' }],
  approved: [{ to: 'pending',  label: '되돌리기' }],
  rejected: [{ to: 'pending',  label: '재검토' }],
};

function fmtINR(n) {
  if (n == null || isNaN(Number(n))) return '—';
  return '₹' + Number(n).toLocaleString('en-IN');
}
function fmtDate(s) {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function DisposalDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const { isAuthed } = useAuth();
  const [row, setRow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('fixed_asset_disposals')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (cancelled) return;
      if (error) { setError(error.message); setLoading(false); return; }
      setRow(data);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id]);

  const bookValue = useMemo(() => {
    if (!row) return 0;
    return (Number(row.acquisition_cost) || 0) - (Number(row.accumulated_depreciation) || 0);
  }, [row]);

  const disposalVsBook = useMemo(() => {
    if (!row) return 0;
    return (Number(row.disposal_amount) || 0) - bookValue;
  }, [row, bookValue]);

  const yearsElapsed = useMemo(() => {
    if (!row?.acquisition_year) return null;
    return new Date().getFullYear() - Number(row.acquisition_year);
  }, [row]);

  async function changeStatus(next) {
    if (!row) return;
    if (!confirm(`상태를 "${next}"(으)로 변경하시겠습니까?`)) return;
    setBusy(true); setError(null);
    try {
      const { error: upErr } = await supabase
        .from('fixed_asset_disposals')
        .update({ status: next })
        .eq('id', row.id);
      if (upErr) throw upErr;
      setRow({ ...row, status: next });
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!row) return;
    if (!confirm('이 처분 신청을 삭제하시겠습니까?')) return;
    setBusy(true); setError(null);
    try {
      const { error: delErr } = await supabase
        .from('fixed_asset_disposals')
        .delete()
        .eq('id', row.id);
      if (delErr) throw delErr;
      router.replace('/disposals');
    } catch (err) {
      setError(err.message || String(err));
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main style={S.page}>
        <header style={S.header}>
          <Link href="/disposals" style={S.backLink}>← 목록</Link>
          <h1 style={S.title}>처분 상세</h1>
        </header>
        <div style={S.loading}>불러오는 중…</div>
      </main>
    );
  }

  if (!row) {
    return (
      <main style={S.page}>
        <header style={S.header}>
          <Link href="/disposals" style={S.backLink}>← 목록</Link>
          <h1 style={S.title}>처분 상세</h1>
        </header>
        <div style={S.empty}>존재하지 않는 항목입니다</div>
      </main>
    );
  }

  const code = CODE_PILL[row.disposal_code] || CODE_PILL['폐기'];
  const st = STATUS_PILL[row.status] || STATUS_PILL.draft;
  const nextActions = STATUS_NEXT[row.status] || [];

  return (
    <>
      <Head>
        <title>처분 상세 — {row.asset_name} | DSC FMS</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#0f172a" />
      </Head>
      <main style={S.page}>
        <header style={S.header}>
          <Link href="/disposals" style={S.backLink}>← 목록</Link>
          <h1 style={S.title}>고정자산 처분 승인서</h1>
          <div style={{ width: 44 }} />
        </header>

        <div style={S.body}>
          {/* 상단 요약 */}
          <section style={S.summaryCard}>
            <div style={S.pillRow}>
              <span style={{ ...S.pill, background: code.bg, color: code.fg, borderColor: code.border }}>
                {row.disposal_code}
              </span>
              <span style={{ ...S.pill, background: st.bg, color: st.fg, borderColor: st.border }}>
                {st.label}
              </span>
            </div>
            <div style={S.summaryName}>{row.asset_name}</div>
            {row.asset_no && <div style={S.summaryNo}>{row.asset_no}</div>}
          </section>

          {/* 다운로드 버튼 */}
          <div style={S.downloadRow}>
            <a
              href={`/api/disposals/${row.id}/download`}
              style={S.downloadBtn}
              download
            >
              📊 Excel 다운로드
            </a>
            {(row.disposal_code === '매각' || row.disposal_code === '폐기') && (
              <a
                href={`/api/disposals/report/${row.id}`}
                target="_blank"
                rel="noopener"
                style={S.reportBtn}
              >
                📄 처분신청서 다운로드
              </a>
            )}
          </div>

          {/* 1. 기본 정보 */}
          <Section title="1. 기본 정보">
            <Row label="자산NO"   value={row.asset_no} />
            <Row label="계정구분" value={row.account_type} />
            <Row label="자산명"   value={row.asset_name} />
            <Row label="규격"     value={row.spec} />
          </Section>

          {/* 2. 처분 정보 */}
          <Section title="2. 처분 정보">
            <Row label="처분코드"     value={row.disposal_code} />
            <Row label="처분예정금액" value={fmtINR(row.disposal_amount)} highlight />
            <Row label="처분수량"     value={row.disposal_qty} />
            <Row label="처분예정일"   value={fmtDate(row.disposal_date)} />
            <Row label="처분처"       value={row.disposal_destination} />
          </Section>

          {/* 3. 장부금액 내역 */}
          <Section title="3. 장부금액 내역">
            <Row label="취득가액"       value={fmtINR(row.acquisition_cost)} />
            <Row label="감가상각총당금" value={fmtINR(row.accumulated_depreciation)} />
            <Row label="장부금액"       value={fmtINR(bookValue)} highlight />
            <Row label="처분가액 비교"
              value={
                <span style={{ color: disposalVsBook >= 0 ? '#86efac' : '#fca5a5', fontWeight: 700 }}>
                  {disposalVsBook >= 0 ? '+' : ''}{fmtINR(disposalVsBook)} ({disposalVsBook >= 0 ? '이익' : '손실'})
                </span>
              }
            />
            <Row label="취득연도" value={row.acquisition_year} />
            {yearsElapsed != null && <Row label="경과년수" value={`${yearsElapsed}년`} />}
          </Section>

          {/* 4. 사유 및 의견 */}
          <Section title="4. 사유 및 의견">
            <LongRow label="처분사유 (사용부서)" value={row.disposal_reason_user} />
            <LongRow label="자재재활용 내용"     value={row.material_reuse} />
            <LongRow label="검토의견 (집행부서)" value={row.review_opinion} />
          </Section>

          {/* 5. 첨부 사진 */}
          {Array.isArray(row.photos) && row.photos.length > 0 && (
            <Section title="5. 첨부 사진">
              <div style={S.photoGrid}>
                {row.photos.map((url, i) => (
                  <a key={url} href={url} target="_blank" rel="noopener" style={S.photoTile}>
                    <img src={url} alt={`photo ${i+1}`} style={S.photoImg} />
                  </a>
                ))}
              </div>
            </Section>
          )}

          {/* 6. 첨부 파일 */}
          {Array.isArray(row.files) && row.files.length > 0 && (
            <Section title="6. 첨부 파일">
              <ul style={S.fileList}>
                {row.files.map(f => (
                  <li key={f.url} style={S.fileItem}>
                    <a href={f.url} target="_blank" rel="noopener" style={S.fileLink}>
                      📄 {f.name || f.url.split('/').pop()}
                    </a>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* 추가 첨부 (사진·파일 이력관리) */}
          <Section title="추가 첨부 (이력 관리)">
            <AttachmentManager
              target="disposal"
              targetId={row.id}
              context={row.disposal_code === '매각' ? 'sale' : row.disposal_code === '폐기' ? 'scrap' : 'other'}
              readOnly={!isAuthed}
            />
          </Section>

          {/* 메타 */}
          <Section title="메타">
            <Row label="생성일시" value={row.created_at ? new Date(row.created_at).toLocaleString('ko-KR') : '—'} />
            <Row label="수정일시" value={row.updated_at ? new Date(row.updated_at).toLocaleString('ko-KR') : '—'} />
            <Row label="상태"     value={row.status} />
          </Section>

          {/* 액션 */}
          {isAuthed && (
            <section style={S.actionSection}>
              <h3 style={S.actionTitle}>상태 변경</h3>
              <div style={S.actionRow}>
                {nextActions.map(act => (
                  <button key={act.to} type="button" onClick={() => changeStatus(act.to)}
                    disabled={busy} style={S.actionBtn}>
                    {act.label}
                  </button>
                ))}
              </div>

              <button type="button" onClick={onDelete} disabled={busy} style={S.deleteBtn}>
                삭제
              </button>
            </section>
          )}

          {error && <div style={S.errorBox}>{error}</div>}
        </div>
      </main>
      <BottomNav />
    </>
  );
}

function Section({ title, children }) {
  return (
    <section style={S.section}>
      <h2 style={S.sectionTitle}>{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, value, highlight }) {
  return (
    <div style={S.row}>
      <span style={S.rowLabel}>{label}</span>
      <span style={{ ...S.rowValue, ...(highlight ? S.rowValueHighlight : null) }}>
        {value == null || value === '' ? '—' : value}
      </span>
    </div>
  );
}

function LongRow({ label, value }) {
  return (
    <div style={S.longRow}>
      <div style={S.rowLabel}>{label}</div>
      <div style={S.longValue}>{value || '—'}</div>
    </div>
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

  body: { padding: '12px 14px 16px' },
  loading: { padding: 48, textAlign: 'center', color: '#64748b' },
  empty:   { padding: 48, textAlign: 'center', color: '#64748b' },

  summaryCard: {
    background: '#1e293b', border: '1px solid #334155', borderRadius: 12,
    padding: 14, marginBottom: 12,
  },
  pillRow: { display: 'flex', gap: 6, marginBottom: 10 },
  pill: {
    padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 800,
    letterSpacing: 0.5, border: '1px solid',
  },
  summaryName: { fontSize: 18, fontWeight: 700, color: '#f8fafc', marginBottom: 4 },
  summaryNo: { fontSize: 12, color: '#94a3b8',
    fontFamily: 'ui-monospace, Menlo, Consolas, monospace' },

  downloadRow: {
    display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12,
  },
  downloadBtn: {
    display: 'block', textAlign: 'center',
    background: '#16a34a', color: '#fff',
    padding: '14px', borderRadius: 10, fontSize: 15, fontWeight: 700,
    textDecoration: 'none', minHeight: 48,
    boxShadow: '0 4px 12px rgba(22,163,74,0.4)',
  },
  reportBtn: {
    display: 'block', textAlign: 'center',
    background: '#2563eb', color: '#fff',
    padding: '14px', borderRadius: 10, fontSize: 15, fontWeight: 700,
    textDecoration: 'none', minHeight: 48,
    boxShadow: '0 4px 12px rgba(37,99,235,0.4)',
  },

  section: {
    background: '#1e293b', border: '1px solid #334155', borderRadius: 12,
    padding: 14, marginBottom: 12,
  },
  sectionTitle: { fontSize: 14, fontWeight: 700, margin: '0 0 10px', color: '#f8fafc' },

  row: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '8px 0', borderBottom: '1px solid #334155', gap: 10,
  },
  rowLabel: { fontSize: 12, color: '#94a3b8', fontWeight: 600, flexShrink: 0, minWidth: 110 },
  rowValue: { fontSize: 13, color: '#e2e8f0', fontWeight: 500, textAlign: 'right',
    wordBreak: 'break-word', flex: 1 },
  rowValueHighlight: { color: '#fbbf24', fontWeight: 700,
    fontFamily: 'ui-monospace, Menlo, Consolas, monospace' },

  longRow: { padding: '8px 0', borderBottom: '1px solid #334155' },
  longValue: { fontSize: 13, color: '#e2e8f0', marginTop: 6,
    whiteSpace: 'pre-wrap', wordBreak: 'break-word' },

  photoGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 },
  photoTile: { display: 'block' },
  photoImg: { width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 6 },

  fileList: { listStyle: 'none', margin: 0, padding: 0,
    display: 'flex', flexDirection: 'column', gap: 6 },
  fileItem: {
    padding: '10px 12px', background: '#0f172a',
    border: '1px solid #334155', borderRadius: 8,
  },
  fileLink: { color: '#93c5fd', textDecoration: 'none', fontSize: 13 },

  actionSection: {
    background: '#1e293b', border: '1px solid #334155', borderRadius: 12,
    padding: 14, marginBottom: 12,
  },
  actionTitle: { fontSize: 13, fontWeight: 700, margin: '0 0 10px', color: '#94a3b8' },
  actionRow: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 },
  actionBtn: {
    flex: '1 1 100px', padding: '12px', background: '#dc2626', color: '#fff',
    border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700,
    cursor: 'pointer', minHeight: 44,
  },
  deleteBtn: {
    width: '100%', padding: '12px',
    background: 'transparent', color: '#fca5a5',
    border: '1px solid rgba(220,38,38,0.4)', borderRadius: 8,
    fontSize: 13, fontWeight: 600, cursor: 'pointer', minHeight: 44,
  },

  errorBox: {
    margin: '12px 0', padding: 12,
    background: 'rgba(220,38,38,0.15)', color: '#fca5a5',
    border: '1px solid rgba(220,38,38,0.4)', borderRadius: 10, fontSize: 13,
  },
};
