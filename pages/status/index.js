import Head from 'next/head';
import Link from 'next/link';
import { useMemo } from 'react';
import BottomNav from '../../components/BottomNav';

// ── Status data (hardcoded; matches STATUS.md as of 2026-05-11) ──────
const STATUS_ITEMS = [
  { status: 'done',    label: 'BM 모듈 DB 스키마 설계', owner: '비서' },
  { status: 'done',    label: 'BM 테이블 필드 확장 (priority/cause_code/downtime)', owner: '비서' },
  { status: 'done',    label: 'KPI RPC 함수 (MTTR/MTBF/get_monthly_kpi)', owner: '비서' },
  { status: 'done',    label: 'BM 신고 폼 4언어 + 4단계 계층 선택', owner: '웹빌더' },
  { status: 'done',    label: '설비 마스터 Excel → DB 임포트 전체', owner: '데이터분석가' },
  { status: 'done',    label: 'JIG/Mould 공정 분류 DB 정리 (extra.process)', owner: '데이터분석가' },
  { status: 'done',    label: 'BM 이력 목록/상세 다크 테마 리디자인 + BottomNav', owner: '웹빌더' },
  { status: 'done',    label: 'KPI 대시보드 (MTTR/MTBF/OEE/원인분포)', owner: '웹빌더' },
  { status: 'done',    label: 'PM 계획 모듈 (/pm, /pm/new, /pm/[id])', owner: '웹빌더' },
  { status: 'done',    label: '전체 페이지 모바일 UI 수정', owner: '웹빌더' },
  { status: 'done',    label: '현황판 /status 페이지 + 다운로드', owner: '웹빌더' },
  { status: 'done',    label: '예비품/재고 모듈 (/inventory + DB)', owner: '웹빌더' },
  { status: 'done',    label: '작업지시 모듈 (/wo + DB)', owner: '웹빌더' },
  { status: 'done',    label: '자산 QR코드 (BM 신고 링크)', owner: '웹빌더' },
  { status: 'done',    label: 'Discord 웹훅 API + BM/PM 연동 코드', owner: '웹빌더' },
  { status: 'confirm', label: 'Discord 웹훅 URL 입력 (서버 생성 후)', owner: 'Discord URL 필요' },
  { status: 'confirm', label: 'DB 마이그레이션 SQL 실행 (07, 08)', owner: 'Supabase 실행 필요' },
  { status: 'confirm', label: '팀 관리 technicians 데이터 입력', owner: '팀원 명단 필요' },
  { status: 'confirm', label: 'Excel 임포트 실패 26건 CWJ-501~539', owner: '추가 여부 결정 필요' },
  { status: 'confirm', label: 'GitHub PAT 보안 교체 + git push', owner: 'PAT 갱신 권고' },
];

const HISTORY = [
  { date: '2026-05-11', time: '17:40', label: '예비품/재고 모듈 + 작업지시 + QR + Discord', change: '⚪→🟢 완료 (4건)' },
  { date: '2026-05-11', time: '16:46', label: '전체 페이지 모바일 UI 수정', change: '⚪→🟢 완료' },
  { date: '2026-05-11', time: '16:30', label: 'PM 계획 모듈', change: '⚪→🟢 완료 (평가자 100점)' },
  { date: '2026-05-11', time: '16:15', label: 'KPI 대시보드', change: '⚪→🟢 완료 (평가자 93점)' },
  { date: '2026-05-11', time: '15:53', label: 'BM 이력 목록/상세 리디자인', change: '⚪→🟢 완료' },
  { date: '2026-05-11', time: '15:30', label: 'BM 신고 폼 4단계 계층 선택', change: '업데이트 완료' },
  { date: '2026-05-11', time: '14:00', label: 'JIG/Mould 공정 분류 DB 정리', change: '⚪→🟢 완료' },
  { date: '2026-05-11', time: '13:00', label: '설비 마스터 Excel → DB 임포트', change: '⚪→🟢 완료 (353건)' },
  { date: '2026-05-11', time: '12:00', label: 'KPI RPC 함수', change: '⚪→🟢 완료' },
  { date: '2026-05-11', time: '11:00', label: 'BM 모듈 DB 스키마 + 테이블 확장', change: '⚪→🟢 완료' },
];

// ── Status color/emoji metadata ──────────────────────────────────────
const STATUS_META = {
  done:    { emoji: '🟢', label: '완료',     color: '#22c55e', bg: 'rgba(34,197,94,0.12)',   border: 'rgba(34,197,94,0.3)' },
  pending: { emoji: '⚪', label: '시작 전',  color: '#94a3b8', bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.2)' },
  confirm: { emoji: '🔴', label: '컨펌필요', color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.3)' },
  inprog:  { emoji: '🟡', label: '진행중',   color: '#eab308', bg: 'rgba(234,179,8,0.12)',   border: 'rgba(234,179,8,0.3)' },
};

const SECTION_ORDER = ['done', 'inprog', 'pending', 'confirm'];

// ── Group history by date ────────────────────────────────────────────
function groupByDate(items) {
  const map = new Map();
  for (const it of items) {
    if (!map.has(it.date)) map.set(it.date, []);
    map.get(it.date).push(it);
  }
  return [...map.entries()];
}

// ── Markdown export ──────────────────────────────────────────────────
function downloadStatus() {
  const lines = [];
  lines.push('# DSC FMS 포털 — 프로젝트 현황판');
  lines.push(`> 생성: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} KST`);
  lines.push('');
  lines.push('## 현재 상태');
  lines.push('');
  lines.push('| 상태 | 항목 | 담당 |');
  lines.push('|------|------|------|');
  STATUS_ITEMS.forEach(item => {
    const m = STATUS_META[item.status];
    lines.push(`| ${m.emoji} ${m.label} | ${item.label} | ${item.owner} |`);
  });
  lines.push('');
  lines.push('## 변경 히스토리');
  lines.push('');
  HISTORY.forEach(h => {
    lines.push(`- **${h.date} ${h.time}** — ${h.label}: ${h.change}`);
  });

  const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `DSC-FMS-Status-${new Date().toISOString().slice(0,10)}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function StatusPage() {
  // ── Counts ────────────────────────────────────────────────────────
  const counts = useMemo(() => {
    const c = { done: 0, pending: 0, confirm: 0, inprog: 0 };
    for (const it of STATUS_ITEMS) {
      if (c[it.status] != null) c[it.status]++;
    }
    return c;
  }, []);

  // ── Group items by status section ─────────────────────────────────
  const sections = useMemo(() => {
    const out = {};
    for (const key of SECTION_ORDER) out[key] = [];
    for (const it of STATUS_ITEMS) {
      if (out[it.status]) out[it.status].push(it);
    }
    return out;
  }, []);

  const historyByDate = useMemo(() => groupByDate(HISTORY), []);

  return (
    <>
      <Head>
        <title>현황판 | DSC FMS</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#0f172a" />
      </Head>

      <main style={S.page}>
        <header style={S.header}>
          <Link href="/" style={S.backBtn} aria-label="홈으로">←</Link>
          <h1 style={S.title}>DSC FMS 현황</h1>
          <button type="button" onClick={downloadStatus} style={S.downloadBtn} aria-label="현황 다운로드">
            <DownloadIcon />
            <span style={S.downloadLabel}>다운로드</span>
          </button>
        </header>

        {/* Summary cards */}
        <section style={S.summaryGrid}>
          <SummaryCard meta={STATUS_META.done}    count={counts.done} />
          <SummaryCard meta={STATUS_META.inprog}  count={counts.inprog} />
          <SummaryCard meta={STATUS_META.pending} count={counts.pending} />
          <SummaryCard meta={STATUS_META.confirm} count={counts.confirm} />
        </section>

        {/* Status sections */}
        <section style={S.body}>
          {SECTION_ORDER.map(key => {
            const items = sections[key];
            if (!items || items.length === 0) return null;
            const meta = STATUS_META[key];
            return (
              <div key={key} style={S.section}>
                <div style={S.sectionHead}>
                  <span style={{ ...S.sectionDot, background: meta.color }} />
                  <span style={S.sectionTitle}>{meta.emoji} {meta.label}</span>
                  <span style={{ ...S.sectionCount, color: meta.color, background: meta.bg, border: `1px solid ${meta.border}` }}>
                    {items.length}
                  </span>
                </div>
                <ul style={S.list}>
                  {items.map((item, idx) => (
                    <li key={idx} style={{ ...S.itemCard, borderColor: meta.border }}>
                      <span style={{ ...S.itemBar, background: meta.color }} />
                      <div style={S.itemBody}>
                        <div style={S.itemLabel}>{item.label}</div>
                        <span style={{ ...S.ownerChip, color: meta.color, background: meta.bg, border: `1px solid ${meta.border}` }}>
                          {item.owner}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </section>

        {/* History timeline */}
        <section style={S.body}>
          <div style={S.section}>
            <div style={S.sectionHead}>
              <span style={{ ...S.sectionDot, background: '#60a5fa' }} />
              <span style={S.sectionTitle}>변경 히스토리</span>
              <span style={{ ...S.sectionCount, color: '#60a5fa', background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.3)' }}>
                {HISTORY.length}
              </span>
            </div>

            {historyByDate.map(([date, items]) => (
              <div key={date} style={S.dateGroup}>
                <div style={S.dateLabel}>{date} (KST)</div>
                <ul style={S.timeline}>
                  {items.map((h, idx) => (
                    <li key={idx} style={S.timelineItem}>
                      <span style={S.timelineDot} />
                      {idx < items.length - 1 && <span style={S.timelineLine} />}
                      <div style={S.timelineBody}>
                        <div style={S.timelineTop}>
                          <span style={S.timelineTime}>{h.time}</span>
                          <span style={S.timelineLabel}>{h.label}</span>
                        </div>
                        <div style={S.timelineChange}>{h.change}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <div style={S.footer}>DSC Mannur FMS Portal · 자동 생성 · 수동 편집 금지</div>
      </main>

      <BottomNav />
    </>
  );
}

// ── Sub-components ───────────────────────────────────────────────────
function SummaryCard({ meta, count }) {
  return (
    <div style={{ ...S.summaryCard, background: meta.bg, border: `1px solid ${meta.border}` }}>
      <div style={S.summaryEmoji}>{meta.emoji}</div>
      <div style={{ ...S.summaryCount, color: meta.color }}>{count}</div>
      <div style={{ ...S.summaryLabel, color: meta.color }}>{meta.label}</div>
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12" />
      <path d="M7 10l5 5 5-5" />
      <path d="M4 21h16" />
    </svg>
  );
}

// ── Styles ───────────────────────────────────────────────────────────
const S = {
  page: { fontFamily: 'system-ui,-apple-system,sans-serif', background: '#0f172a', minHeight: '100vh', color: '#e2e8f0', paddingBottom: 'calc(60px + env(safe-area-inset-bottom,0px) + 24px)', maxWidth: 480, margin: '0 auto' },
  header: { position: 'sticky', top: 0, zIndex: 20, background: '#0f172a', borderBottom: '1px solid #1f2937', padding: '10px 12px', display: 'grid', gridTemplateColumns: '44px 1fr auto', alignItems: 'center', gap: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.4)' },
  backBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, borderRadius: 10, color: '#e2e8f0', textDecoration: 'none', fontSize: 22, background: 'rgba(148,163,184,0.08)' },
  title: { fontSize: 17, fontWeight: 700, margin: 0, color: '#f8fafc', textAlign: 'center' },
  downloadBtn: { display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44, padding: '0 12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 8px rgba(37,99,235,0.4)' },
  downloadLabel: { whiteSpace: 'nowrap' },

  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, padding: '12px 12px 4px' },
  summaryCard: { borderRadius: 12, padding: '10px 6px', textAlign: 'center', minHeight: 76, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 },
  summaryEmoji: { fontSize: 14, lineHeight: 1 },
  summaryCount: { fontSize: 22, fontWeight: 800, lineHeight: 1.1, fontFamily: 'ui-monospace,Menlo,monospace' },
  summaryLabel: { fontSize: 10, fontWeight: 700, letterSpacing: 0.2 },

  body: { padding: '0 12px' },
  section: { marginTop: 16 },
  sectionHead: { display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px 10px' },
  sectionDot: { width: 8, height: 8, borderRadius: '50%' },
  sectionTitle: { fontSize: 14, fontWeight: 800, color: '#f8fafc', flex: 1 },
  sectionCount: { fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 999, fontFamily: 'ui-monospace,Menlo,monospace' },

  list: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 },
  itemCard: { position: 'relative', display: 'flex', background: '#1e293b', borderRadius: 10, border: '1px solid #1f2937', overflow: 'hidden', minHeight: 56 },
  itemBar: { width: 4, flexShrink: 0 },
  itemBody: { flex: 1, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 },
  itemLabel: { fontSize: 14, fontWeight: 600, color: '#e2e8f0', lineHeight: 1.35, wordBreak: 'keep-all' },
  ownerChip: { alignSelf: 'flex-start', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999 },

  dateGroup: { marginBottom: 14 },
  dateLabel: { fontSize: 12, fontWeight: 700, color: '#94a3b8', padding: '4px 6px 8px', fontFamily: 'ui-monospace,Menlo,monospace' },
  timeline: { listStyle: 'none', margin: 0, padding: 0, position: 'relative' },
  timelineItem: { position: 'relative', paddingLeft: 24, paddingBottom: 12, minHeight: 36 },
  timelineDot: { position: 'absolute', left: 6, top: 6, width: 10, height: 10, borderRadius: '50%', background: '#60a5fa', boxShadow: '0 0 0 3px rgba(96,165,250,0.2)' },
  timelineLine: { position: 'absolute', left: 10, top: 18, bottom: 0, width: 2, background: 'rgba(96,165,250,0.2)' },
  timelineBody: { background: '#1e293b', borderRadius: 10, padding: '8px 12px', border: '1px solid #1f2937' },
  timelineTop: { display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 3, flexWrap: 'wrap' },
  timelineTime: { fontSize: 11, fontWeight: 800, color: '#60a5fa', fontFamily: 'ui-monospace,Menlo,monospace' },
  timelineLabel: { fontSize: 13, fontWeight: 600, color: '#e2e8f0' },
  timelineChange: { fontSize: 12, color: '#94a3b8' },

  footer: { padding: '24px 12px 8px', textAlign: 'center', fontSize: 11, color: '#475569' },
};
