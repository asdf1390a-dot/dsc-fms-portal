import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/use-auth';
import BottomNav from '../../components/BottomNav';

// ── Category tabs ─────────────────────────────────────────────────────
const CAT_LABELS = {
  all:        '전체',
  consumable: '소모품',
  mechanical: '기계',
  electrical: '전기',
  hydraulic:  '유압',
  other:      '기타',
};
const CAT_ORDER = ['all', 'consumable', 'mechanical', 'electrical', 'hydraulic', 'other'];

const CAT_CHIP_COLOR = {
  consumable: { fg: '#fcd34d', bg: 'rgba(234,179,8,0.18)',  border: 'rgba(234,179,8,0.5)' },
  mechanical: { fg: '#93c5fd', bg: 'rgba(37,99,235,0.18)',  border: 'rgba(37,99,235,0.5)' },
  electrical: { fg: '#c4b5fd', bg: 'rgba(139,92,246,0.18)', border: 'rgba(139,92,246,0.5)' },
  hydraulic:  { fg: '#5eead4', bg: 'rgba(20,184,166,0.18)', border: 'rgba(20,184,166,0.5)' },
  other:      { fg: '#cbd5e1', bg: 'rgba(100,116,139,0.2)', border: 'rgba(100,116,139,0.5)' },
};

export default function InventoryIndexPage() {
  useAuth(); // session bootstrap (not gated — list readable by anon for now)

  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');

  // ── Fetch ───────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error: fetchErr } = await supabase
        .from('spare_parts')
        .select('id, part_number, name_ko, name_en, category, quantity, min_quantity, unit, location')
        .order('created_at', { ascending: false })
        .limit(500);
      if (cancelled) return;
      if (fetchErr) {
        setError(fetchErr.message);
      } else {
        setParts(data || []);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const lowCount = useMemo(
    () => parts.filter(p => (p.min_quantity ?? 0) > 0 && (p.quantity ?? 0) <= (p.min_quantity ?? 0)).length,
    [parts]
  );

  // ── Client-side filter ──────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return parts.filter(p => {
      if (category !== 'all' && p.category !== category) return false;
      if (!q) return true;
      const pn = (p.part_number || '').toLowerCase();
      const nm = (p.name_ko || '').toLowerCase();
      const en = (p.name_en || '').toLowerCase();
      return pn.includes(q) || nm.includes(q) || en.includes(q);
    });
  }, [parts, category, query]);

  // ── Counts per category ─────────────────────────────────────────────
  const counts = useMemo(() => {
    const c = { all: parts.length, consumable: 0, mechanical: 0, electrical: 0, hydraulic: 0, other: 0 };
    for (const p of parts) {
      if (c[p.category] !== undefined) c[p.category]++;
    }
    return c;
  }, [parts]);

  return (
    <>
      <Head>
        <title>예비품 재고 | DSC FMS</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#0f172a" />
      </Head>

      <main style={S.page}>
        <header style={S.header}>
          <h1 style={S.title}>예비품 재고</h1>
          <Link href="/inventory/new" style={S.fab} aria-label="새 예비품 등록">+</Link>
        </header>

        {lowCount > 0 && (
          <Link href="/inventory/dashboard" style={S.lowBanner}>
            <span>⚠ 재고부족 <strong>{lowCount}건</strong></span>
            <span style={S.lowBannerArrow}>대시보드 →</span>
          </Link>
        )}

        <div style={S.searchWrap}>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="품번 또는 품목명 검색"
            style={S.searchInput}
          />
        </div>

        <div style={S.tabBar}>
          {CAT_ORDER.map(key => {
            const active = category === key;
            const count = counts[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => setCategory(key)}
                style={{
                  ...S.tab,
                  borderBottom: active ? '2px solid #2563eb' : '2px solid transparent',
                  color: active ? '#f8fafc' : '#94a3b8',
                }}
                aria-pressed={active}
              >
                <span style={S.tabLabel}>{CAT_LABELS[key]}</span>
                <span style={{
                  ...S.tabCount,
                  background: active ? 'rgba(37,99,235,0.25)' : 'rgba(100,116,139,0.2)',
                  color: active ? '#93c5fd' : '#94a3b8',
                }}>{count}</span>
              </button>
            );
          })}
        </div>

        {error && <div style={S.errorBox}>{error}</div>}

        {loading ? (
          <div style={S.loading}>불러오는 중…</div>
        ) : filtered.length === 0 ? (
          <div style={S.empty}>
            {parts.length === 0 ? '등록된 예비품이 없습니다' : '해당 조건의 예비품이 없습니다'}
          </div>
        ) : (
          <ul style={S.list}>
            {filtered.map(p => {
              const low = (p.quantity ?? 0) <= (p.min_quantity ?? 0);
              const barColor = low ? '#ef4444' : '#16a34a';
              const chip = CAT_CHIP_COLOR[p.category] || CAT_CHIP_COLOR.other;
              return (
                <li
                  key={p.id}
                  style={{
                    ...S.card,
                    borderColor: low ? 'rgba(220,38,38,0.55)' : '#1f2937',
                  }}
                >
                  <span style={{ ...S.statusBar, background: barColor }} />
                  <Link href={`/inventory/${p.id}`} style={S.cardLink}>
                    <div style={S.cardTopRow}>
                      <div style={S.cardLeft}>
                        {p.part_number && <div style={S.partNumber}>{p.part_number}</div>}
                        <div style={S.partName}>{p.name_ko}</div>
                      </div>
                      <div style={S.qtyWrap}>
                        <div style={{ ...S.qtyMain, color: low ? '#fca5a5' : '#f8fafc' }}>
                          {p.quantity ?? 0}
                          <span style={S.qtySlash}> / {p.min_quantity ?? 0}</span>
                        </div>
                        <div style={S.qtyUnit}>{p.unit || 'EA'}</div>
                      </div>
                    </div>
                    <div style={S.metaRow}>
                      <span style={{
                        ...S.catChip,
                        color: chip.fg,
                        background: chip.bg,
                        border: `1px solid ${chip.border}`,
                      }}>
                        {CAT_LABELS[p.category] || '기타'}
                      </span>
                      {low && <span style={S.lowBadge}>재고부족</span>}
                      {p.location && <span style={S.locText}>· {p.location}</span>}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        <div style={S.footerLinks}>
          <Link href="/inventory/dashboard" style={S.footerLink}>📊 재고 현황 대시보드</Link>
          <Link href="/vendors" style={S.footerLink}>🏢 공급업체 관리</Link>
        </div>
      </main>

      <BottomNav />
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────
const S = {
  page: { fontFamily: 'system-ui,-apple-system,sans-serif', background: '#0f172a', minHeight: '100vh', color: '#e2e8f0', paddingBottom: 'calc(60px + env(safe-area-inset-bottom,0px) + 24px)', maxWidth: 480, margin: '0 auto' },
  header: { position: 'sticky', top: 0, zIndex: 20, background: '#0f172a', borderBottom: '1px solid #1f2937', padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 2px 8px rgba(0,0,0,0.4)' },
  title: { fontSize: 18, fontWeight: 700, margin: 0, color: '#f8fafc' },
  fab: { width: 44, height: 44, borderRadius: '50%', background: '#2563eb', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', fontSize: 28, fontWeight: 300, boxShadow: '0 4px 12px rgba(37,99,235,0.5)' },
  searchWrap: { padding: '10px 14px 8px', background: '#0f172a', position: 'sticky', top: 65, zIndex: 16, borderBottom: '1px solid #1f2937' },
  searchInput: { width: '100%', padding: '11px 14px', border: '1px solid #334155', borderRadius: 10, fontSize: 16, outline: 'none', boxSizing: 'border-box', background: '#0b1220', color: '#f1f5f9', minHeight: 44 },
  tabBar: { position: 'sticky', top: 128, zIndex: 15, background: '#0f172a', borderBottom: '1px solid #1f2937', display: 'flex', overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' },
  tab: { flex: '1 0 auto', background: 'transparent', border: 'none', padding: '12px 12px 14px', cursor: 'pointer', minHeight: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 },
  tabLabel: { fontSize: 12, fontWeight: 700 },
  tabCount: { fontSize: 11, fontWeight: 800, padding: '1px 6px', borderRadius: 999 },
  list: { listStyle: 'none', margin: 0, padding: '8px 14px 16px' },
  card: { position: 'relative', background: '#1e293b', borderRadius: 12, marginBottom: 10, overflow: 'hidden', border: '1px solid #1f2937', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' },
  statusBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  cardLink: { display: 'block', padding: '12px 14px 12px 18px', textDecoration: 'none', color: 'inherit' },
  cardTopRow: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 8 },
  cardLeft: { flex: 1, minWidth: 0 },
  partNumber: { fontSize: 11, color: '#64748b', fontFamily: 'ui-monospace,Menlo,monospace', marginBottom: 2 },
  partName: { fontSize: 15, fontWeight: 700, color: '#f8fafc', wordBreak: 'break-word' },
  qtyWrap: { flexShrink: 0, textAlign: 'right' },
  qtyMain: { fontSize: 18, fontWeight: 800, fontFamily: 'ui-monospace,Menlo,monospace', lineHeight: 1 },
  qtySlash: { fontSize: 12, color: '#64748b', fontWeight: 600 },
  qtyUnit: { fontSize: 10, color: '#64748b', marginTop: 2, fontWeight: 600 },
  metaRow: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  catChip: { fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 999 },
  lowBadge: { fontSize: 11, fontWeight: 800, color: '#fca5a5', background: 'rgba(220,38,38,0.2)', border: '1px solid rgba(220,38,38,0.5)', padding: '3px 8px', borderRadius: 999 },
  locText: { fontSize: 12, color: '#64748b' },
  loading: { padding: 48, textAlign: 'center', color: '#64748b' },
  empty: { padding: 48, textAlign: 'center', color: '#64748b', fontSize: 14 },
  errorBox: { margin: 14, padding: 14, background: 'rgba(220,38,38,0.15)', color: '#fca5a5', border: '1px solid rgba(220,38,38,0.4)', borderRadius: 10, fontSize: 14 },
  lowBanner: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'rgba(220,38,38,0.15)', borderBottom: '1px solid rgba(220,38,38,0.45)', color: '#fca5a5', fontSize: 13, fontWeight: 700, textDecoration: 'none' },
  lowBannerArrow: { fontSize: 12, color: '#fca5a5', fontWeight: 700 },
  footerLinks: { display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 14px 16px' },
  footerLink: { padding: '12px 14px', background: '#1e293b', border: '1px solid #1f2937', borderRadius: 10, color: '#60a5fa', textDecoration: 'none', fontSize: 13, fontWeight: 700, textAlign: 'center' },
};
