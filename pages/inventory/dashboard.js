import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/use-auth';
import BottomNav from '../../components/BottomNav';

const CAT_LABELS = {
  consumable: '소모품', mechanical: '기계부품', electrical: '전기부품',
  hydraulic: '유압부품', other: '기타',
};
const CAT_COLORS = {
  consumable: '#eab308', mechanical: '#2563eb', electrical: '#8b5cf6',
  hydraulic: '#14b8a6', other: '#64748b',
};

export default function InventoryDashboardPage() {
  const { isAuthed } = useAuth();
  const [totalParts, setTotalParts] = useState(0);
  const [lowStock, setLowStock] = useState([]);
  const [vendorCount, setVendorCount] = useState(0);
  const [catCounts, setCatCounts] = useState({});
  const [monthly, setMonthly] = useState({ in_count: 0, out_count: 0, in_value: 0 });
  const [loading, setLoading] = useState(true);
  const [alertBusy, setAlertBusy] = useState(false);
  const [alertMsg, setAlertMsg] = useState(null);

  async function load() {
    setLoading(true);
    const [partsRes, lowRes, vendorRes, monthlyRes] = await Promise.all([
      supabase.from('spare_parts').select('category', { count: 'exact' }),
      supabase.from('v_low_stock').select('*'),
      supabase.from('vendors').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('v_stock_monthly').select('*'),
    ]);
    setTotalParts(partsRes.count || 0);
    setLowStock(lowRes.data || []);
    setVendorCount(vendorRes.count || 0);
    const cc = {};
    for (const p of partsRes.data || []) {
      cc[p.category] = (cc[p.category] || 0) + 1;
    }
    setCatCounts(cc);

    // Aggregate this month
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    let inC = 0, outC = 0, inV = 0;
    for (const row of monthlyRes.data || []) {
      const m = (row.month || '').toString().slice(0, 7);
      if (m !== thisMonth) continue;
      if (row.movement_type === 'IN') { inC += row.tx_count || 0; inV += Number(row.total_value || 0); }
      else if (row.movement_type === 'OUT') { outC += row.tx_count || 0; }
    }
    setMonthly({ in_count: inC, out_count: outC, in_value: inV });
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function sendAlert() {
    setAlertBusy(true);
    setAlertMsg(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) { setAlertMsg('로그인이 필요합니다'); return; }
      const res = await fetch('/api/inventory/low-stock-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'send failed');
      setAlertMsg(`✓ Discord 알림 발송 완료 (${json.count}건)`);
      setTimeout(() => setAlertMsg(null), 3500);
    } catch (e) { setAlertMsg('에러: ' + e.message); }
    finally { setAlertBusy(false); }
  }

  const maxCount = Math.max(1, ...Object.values(catCounts));

  return (
    <>
      <Head>
        <title>재고 현황 대시보드 | DSC FMS</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </Head>
      <main style={S.page}>
        <header style={S.header}>
          <Link href="/inventory" style={S.backLink}>← 재고</Link>
          <h1 style={S.title}>재고 현황 대시보드</h1>
          <div style={{ minWidth: 40 }} />
        </header>

        {loading ? (
          <div style={S.loading}>불러오는 중…</div>
        ) : (
          <>
            <section style={S.summaryGrid}>
              <SummaryCard label="전체 품목" value={totalParts} color="#60a5fa" />
              <SummaryCard label="재고부족" value={lowStock.length} color={lowStock.length > 0 ? '#fca5a5' : '#86efac'} />
              <Link href="/vendors" style={{ textDecoration: 'none', color: 'inherit' }}>
                <SummaryCard label="공급업체" value={vendorCount} color="#fcd34d" />
              </Link>
            </section>

            <section style={S.block}>
              <div style={S.sectionTitle}>재고 부족 품목</div>
              {lowStock.length === 0 ? (
                <div style={S.emptySmall}>모든 품목이 충분합니다 👍</div>
              ) : (
                <ul style={S.list}>
                  {lowStock.slice(0, 10).map(item => (
                    <li key={item.id} style={S.lowCard}>
                      <Link href={`/inventory/${item.id}`} style={S.lowLink}>
                        <div style={S.lowName}>{item.name_ko}</div>
                        <div style={S.lowMeta}>
                          현재 {item.quantity} / 최소 {item.min_quantity} {item.unit || 'EA'}
                          <span style={S.shortBadge}>부족 {item.shortage}</span>
                        </div>
                        {item.vendor_name && (
                          <div style={S.lowVendor}>공급: {item.vendor_name}{item.lead_time_days ? ` · 납기 ${item.lead_time_days}일` : ''}</div>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {isAuthed && lowStock.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <button onClick={sendAlert} disabled={alertBusy} style={alertBusy ? S.btnDisabled : S.btnAlert}>
                    {alertBusy ? '발송 중…' : '📢 Discord 알림 발송'}
                  </button>
                  {alertMsg && <div style={S.alertMsg}>{alertMsg}</div>}
                </div>
              )}
            </section>

            <section style={S.block}>
              <div style={S.sectionTitle}>이번 달 입출고</div>
              <div style={S.monthlyRow}>
                <div style={{ ...S.monthlyCard, borderLeft: '4px solid #16a34a' }}>
                  <div style={S.monthlyLabel}>입고</div>
                  <div style={{ ...S.monthlyValue, color: '#86efac' }}>+{monthly.in_count}건</div>
                  {monthly.in_value > 0 && <div style={S.monthlySub}>{monthly.in_value.toLocaleString()} (총액)</div>}
                </div>
                <div style={{ ...S.monthlyCard, borderLeft: '4px solid #dc2626' }}>
                  <div style={S.monthlyLabel}>출고</div>
                  <div style={{ ...S.monthlyValue, color: '#fca5a5' }}>-{monthly.out_count}건</div>
                </div>
              </div>
            </section>

            <section style={S.block}>
              <div style={S.sectionTitle}>카테고리별 현황</div>
              {Object.keys(catCounts).length === 0 ? (
                <div style={S.emptySmall}>데이터 없음</div>
              ) : (
                <div>
                  {Object.entries(catCounts).sort((a,b) => b[1]-a[1]).map(([k, n]) => (
                    <div key={k} style={S.catRow}>
                      <div style={S.catLabel}>{CAT_LABELS[k] || k}</div>
                      <div style={S.catBarTrack}>
                        <div style={{ ...S.catBarFill, width: `${(n/maxCount)*100}%`, background: CAT_COLORS[k] || '#64748b' }} />
                      </div>
                      <div style={S.catCount}>{n}</div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
      <BottomNav />
    </>
  );
}

function SummaryCard({ label, value, color }) {
  return (
    <div style={{ background: '#1e293b', borderRadius: 12, padding: 14, border: '1px solid #1f2937', textAlign: 'center', borderTop: `3px solid ${color}` }}>
      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color, fontFamily: 'ui-monospace,Menlo,monospace' }}>{value}</div>
    </div>
  );
}

const S = {
  page: { fontFamily: 'system-ui,-apple-system,sans-serif', background: '#0f172a', minHeight: '100vh', color: '#e2e8f0', paddingBottom: 'calc(60px + env(safe-area-inset-bottom,0px) + 24px)', maxWidth: 480, margin: '0 auto' },
  header: { position: 'sticky', top: 0, zIndex: 20, background: '#0f172a', borderBottom: '1px solid #1f2937', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.4)' },
  backLink: { color: '#94a3b8', textDecoration: 'none', fontSize: 14, minWidth: 60 },
  title: { fontSize: 17, fontWeight: 700, flex: 1, margin: 0, textAlign: 'center', color: '#f8fafc' },
  loading: { padding: 48, textAlign: 'center', color: '#64748b' },
  summaryGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, padding: 14 },
  block: { padding: '4px 14px 16px' },
  sectionTitle: { fontSize: 11, fontWeight: 800, letterSpacing: 1, color: '#64748b', marginBottom: 10, textTransform: 'uppercase' },
  list: { listStyle: 'none', margin: 0, padding: 0 },
  lowCard: { background: 'rgba(220,38,38,0.10)', borderRadius: 10, marginBottom: 8, border: '1px solid rgba(220,38,38,0.35)' },
  lowLink: { display: 'block', padding: 12, textDecoration: 'none', color: 'inherit' },
  lowName: { fontSize: 15, fontWeight: 700, color: '#f8fafc', marginBottom: 4 },
  lowMeta: { fontSize: 12, color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 },
  shortBadge: { fontSize: 11, fontWeight: 800, color: '#fca5a5', background: 'rgba(220,38,38,0.25)', padding: '2px 8px', borderRadius: 999 },
  lowVendor: { fontSize: 11, color: '#94a3b8' },
  emptySmall: { padding: 24, textAlign: 'center', color: '#64748b', fontSize: 13 },
  btnAlert: { width: '100%', padding: 12, background: '#ef4444', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', minHeight: 48 },
  btnDisabled: { width: '100%', padding: 12, background: '#1f2937', color: '#475569', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'not-allowed', minHeight: 48 },
  alertMsg: { marginTop: 8, fontSize: 12, color: '#86efac', textAlign: 'center' },
  monthlyRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  monthlyCard: { background: '#1e293b', borderRadius: 10, padding: 12, border: '1px solid #1f2937' },
  monthlyLabel: { fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 },
  monthlyValue: { fontSize: 22, fontWeight: 800, fontFamily: 'ui-monospace,Menlo,monospace' },
  monthlySub: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  catRow: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 },
  catLabel: { fontSize: 12, color: '#cbd5e1', width: 70, flexShrink: 0 },
  catBarTrack: { flex: 1, height: 18, background: '#0b1220', borderRadius: 4, overflow: 'hidden' },
  catBarFill: { height: '100%', borderRadius: 4, transition: 'width 0.4s ease' },
  catCount: { fontSize: 12, color: '#e2e8f0', width: 32, textAlign: 'right', fontFamily: 'ui-monospace,Menlo,monospace', fontWeight: 700 },
};
