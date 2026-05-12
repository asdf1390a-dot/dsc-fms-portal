import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/use-auth';
import BottomNav from '../../components/BottomNav';
import VendorForm from '../../components/vendors/VendorForm';

export default function VendorDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const { isAuthed } = useAuth();
  const [vendor, setVendor] = useState(null);
  const [parts, setParts] = useState([]);
  const [tab, setTab] = useState('info');
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function load() {
    if (!id) return;
    setLoading(true);
    const { data: v, error: e1 } = await supabase.from('vendors').select('*').eq('id', id).maybeSingle();
    if (e1) { setError(e1.message); setLoading(false); return; }
    setVendor(v);
    const { data: ps } = await supabase.from('spare_parts')
      .select('id, part_number, name_ko, quantity, min_quantity, unit')
      .eq('vendor_id', id)
      .order('name_ko');
    setParts(ps || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [id]);

  async function handleSave(payload) {
    setBusy(true);
    setError(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      const res = await fetch(`/api/vendors/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'save failed');
      setVendor(json.item);
      setEditMode(false);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  return (
    <>
      <Head>
        <title>{vendor?.name || '공급업체'} | DSC FMS</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </Head>
      <main style={S.page}>
        <header style={S.header}>
          <Link href="/vendors" style={S.backLink}>← 공급업체</Link>
          <h1 style={S.title}>{vendor?.name || ''}</h1>
          <div style={{ minWidth: 40 }} />
        </header>

        {loading ? (
          <div style={S.loading}>불러오는 중…</div>
        ) : !vendor ? (
          <div style={S.errorBox}>공급업체를 찾을 수 없습니다</div>
        ) : editMode ? (
          <>
            {error && <div style={S.errorBox}>{error}</div>}
            <VendorForm initial={vendor} onSubmit={handleSave} onCancel={() => setEditMode(false)} busy={busy} />
          </>
        ) : (
          <>
            <div style={S.tabBar}>
              <button onClick={() => setTab('info')} style={tab==='info' ? S.tabActive : S.tab}>정보</button>
              <button onClick={() => setTab('parts')} style={tab==='parts' ? S.tabActive : S.tab}>담당 부품 ({parts.length})</button>
            </div>

            {error && <div style={S.errorBox}>{error}</div>}

            {tab === 'info' && (
              <div style={S.section}>
                <Row label="업체명" value={vendor.name} />
                <Row label="단축명" value={vendor.name_short} />
                <Row label="국가/도시" value={[vendor.country, vendor.city].filter(Boolean).join(' / ')} />
                <Row label="담당자" value={vendor.contact_name} />
                <Row label="전화" value={vendor.contact_phone} />
                <Row label="이메일" value={vendor.contact_email} />
                <Row label="납기" value={vendor.lead_time_days != null ? `${vendor.lead_time_days}일` : null} />
                <Row label="결제 조건" value={vendor.payment_terms} />
                <Row label="통화" value={vendor.currency} />
                <Row label="상태" value={vendor.is_active ? '활성' : '비활성'} />
                <Row label="비고" value={vendor.notes} />
                {isAuthed && (
                  <div style={S.actions}>
                    <button onClick={() => setEditMode(true)} style={S.btnPrimary}>편집</button>
                  </div>
                )}
              </div>
            )}

            {tab === 'parts' && (
              <ul style={S.list}>
                {parts.length === 0 ? (
                  <li style={S.empty}>담당 부품 없음</li>
                ) : parts.map(p => {
                  const low = (p.quantity ?? 0) <= (p.min_quantity ?? 0);
                  return (
                    <li key={p.id} style={S.partCard}>
                      <Link href={`/inventory/${p.id}`} style={S.partLink}>
                        <div style={S.partName}>{p.name_ko}</div>
                        {p.part_number && <div style={S.partNo}>{p.part_number}</div>}
                        <div style={S.partQty}>
                          현재 {p.quantity ?? 0} / 최소 {p.min_quantity ?? 0} {p.unit || 'EA'}
                          {low && <span style={S.lowBadge}>재고부족</span>}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </main>
      <BottomNav />
    </>
  );
}

function Row({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', gap: 12, padding: '10px 0', fontSize: 14, borderBottom: '1px solid #1f2937' }}>
      <span style={{ color: '#64748b', minWidth: 100, flexShrink: 0 }}>{label}</span>
      <span style={{ color: '#e2e8f0', flex: 1, wordBreak: 'break-word' }}>{value}</span>
    </div>
  );
}

const S = {
  page: { fontFamily: 'system-ui,-apple-system,sans-serif', background: '#0f172a', minHeight: '100vh', color: '#e2e8f0', paddingBottom: 'calc(60px + env(safe-area-inset-bottom,0px) + 24px)', maxWidth: 480, margin: '0 auto' },
  header: { position: 'sticky', top: 0, zIndex: 20, background: '#0f172a', borderBottom: '1px solid #1f2937', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.4)' },
  backLink: { color: '#94a3b8', textDecoration: 'none', fontSize: 14, minWidth: 80 },
  title: { fontSize: 17, fontWeight: 700, flex: 1, margin: 0, textAlign: 'center', color: '#f8fafc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  tabBar: { display: 'flex', borderBottom: '1px solid #1f2937' },
  tab: { flex: 1, padding: '12px', background: 'transparent', border: 'none', color: '#94a3b8', fontSize: 13, fontWeight: 700, cursor: 'pointer', minHeight: 48, borderBottom: '2px solid transparent' },
  tabActive: { flex: 1, padding: '12px', background: 'transparent', border: 'none', color: '#f8fafc', fontSize: 13, fontWeight: 800, cursor: 'pointer', minHeight: 48, borderBottom: '2px solid #2563eb' },
  section: { padding: 16 },
  actions: { paddingTop: 16 },
  btnPrimary: { width: '100%', padding: 14, borderRadius: 12, border: 'none', fontSize: 15, fontWeight: 700, cursor: 'pointer', minHeight: 52, background: '#2563eb', color: '#fff' },
  list: { listStyle: 'none', margin: 0, padding: '8px 14px 16px' },
  partCard: { background: '#1e293b', borderRadius: 10, marginBottom: 8, border: '1px solid #1f2937' },
  partLink: { display: 'block', padding: 12, textDecoration: 'none', color: 'inherit' },
  partName: { fontSize: 15, fontWeight: 700, color: '#f8fafc', marginBottom: 2 },
  partNo: { fontSize: 11, color: '#64748b', fontFamily: 'ui-monospace,Menlo,monospace', marginBottom: 4 },
  partQty: { fontSize: 12, color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: 8 },
  lowBadge: { fontSize: 10, fontWeight: 800, color: '#fca5a5', background: 'rgba(220,38,38,0.2)', border: '1px solid rgba(220,38,38,0.5)', padding: '2px 6px', borderRadius: 999 },
  loading: { padding: 48, textAlign: 'center', color: '#64748b' },
  empty: { padding: 32, textAlign: 'center', color: '#64748b' },
  errorBox: { margin: 14, padding: 14, background: 'rgba(220,38,38,0.15)', color: '#fca5a5', border: '1px solid rgba(220,38,38,0.4)', borderRadius: 10 },
};
