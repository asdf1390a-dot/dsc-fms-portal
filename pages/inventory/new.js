import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/use-auth';
import BottomNav from '../../components/BottomNav';

const CATEGORY_OPTIONS = [
  { value: 'consumable', label: '소모품' },
  { value: 'mechanical', label: '기계부품' },
  { value: 'electrical', label: '전기부품' },
  { value: 'hydraulic',  label: '유압부품' },
  { value: 'other',      label: '기타' },
];

export default function NewInventoryPage() {
  const router = useRouter();
  const { isAuthed, loading: authLoading } = useAuth();

  const [assets, setAssets] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loadingMaster, setLoadingMaster] = useState(true);

  const [nameKo, setNameKo] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [partNumber, setPartNumber] = useState('');
  const [category, setCategory] = useState('consumable');
  const [assetId, setAssetId] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [maker, setMaker] = useState('');
  const [specs, setSpecs] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [quantity, setQuantity] = useState('0');
  const [minQuantity, setMinQuantity] = useState('5');
  const [unit, setUnit] = useState('EA');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // ── Auth gate ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && !isAuthed) {
      router.replace(`/login?next=${encodeURIComponent('/inventory/new')}`);
    }
  }, [authLoading, isAuthed, router]);

  // ── Load assets ─────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingMaster(true);
      const [assetsRes, vendorsRes] = await Promise.all([
        supabase.from('assets').select('id, machine_asset_number, name_en').eq('status', 'active').order('machine_asset_number'),
        supabase.from('vendors').select('id, name, currency').eq('is_active', true).order('name'),
      ]);
      if (cancelled) return;
      if (assetsRes.error) { setError(assetsRes.error.message); setLoadingMaster(false); return; }
      setAssets(assetsRes.data || []);
      setVendors(vendorsRes.data || []);
      setLoadingMaster(false);
    })();
    return () => { cancelled = true; };
  }, []);

  async function submit(e) {
    e.preventDefault();
    if (!nameKo.trim()) { setError('품목명(한국어)을 입력하세요'); return; }
    if (!category) { setError('카테고리를 선택하세요'); return; }

    const qty = parseInt(quantity, 10);
    const minQty = parseInt(minQuantity, 10);
    if (Number.isNaN(qty) || qty < 0) { setError('현재 수량을 올바르게 입력하세요'); return; }
    if (Number.isNaN(minQty) || minQty < 0) { setError('최소 수량을 올바르게 입력하세요'); return; }

    setBusy(true);
    setError(null);
    try {
      const { error: insErr } = await supabase
        .from('spare_parts')
        .insert({
          name_ko: nameKo.trim(),
          name_en: nameEn.trim() || null,
          part_number: partNumber.trim() || null,
          category,
          asset_id: assetId || null,
          vendor_id: vendorId || null,
          maker: maker.trim() || null,
          specs: specs.trim() || null,
          unit_price: unitPrice ? Number(unitPrice) : null,
          currency: currency || 'INR',
          quantity: qty,
          min_quantity: minQty,
          unit: unit.trim() || 'EA',
          location: location.trim() || null,
          notes: notes.trim() || null,
        });
      if (insErr) throw insErr;

      await router.push('/inventory');
    } catch (err) {
      setError(err.message || String(err));
      setBusy(false);
    }
  }

  const submitDisabled = !nameKo.trim() || !category || busy;

  return (
    <>
      <Head>
        <title>예비품 등록 | DSC FMS</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#0f172a" />
      </Head>

      <main style={S.page}>
        <header style={S.header}>
          <Link href="/inventory" style={S.backLink}>← 재고</Link>
          <h1 style={S.title}>예비품 등록</h1>
        </header>

        {authLoading || !isAuthed ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#64748b' }}>…</div>
        ) : (
          <form onSubmit={submit} style={S.form}>
            <Section title="품목명 (한국어) *">
              <input
                type="text"
                value={nameKo}
                onChange={e => setNameKo(e.target.value)}
                placeholder="예: 베어링 6205"
                style={S.input}
                required
              />
            </Section>

            <Section title="품목명 (영어)">
              <input
                type="text"
                value={nameEn}
                onChange={e => setNameEn(e.target.value)}
                placeholder="e.g. Bearing 6205"
                style={S.input}
              />
            </Section>

            <Section title="품번">
              <input
                type="text"
                value={partNumber}
                onChange={e => setPartNumber(e.target.value)}
                placeholder="예: SKF-6205-2RS"
                style={S.input}
              />
            </Section>

            <Section title="카테고리 *">
              <div style={S.catGrid}>
                {CATEGORY_OPTIONS.map(opt => {
                  const active = category === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setCategory(opt.value)}
                      style={{
                        ...S.catBtn,
                        borderColor: active ? '#2563eb' : '#334155',
                        background: active ? 'rgba(37,99,235,0.2)' : '#0b1220',
                        color: active ? '#93c5fd' : '#cbd5e1',
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </Section>

            <Section title="제조사">
              <input type="text" value={maker} onChange={e => setMaker(e.target.value)} placeholder="예: SKF, NSK" style={S.input} />
            </Section>

            <Section title="규격/사양">
              <input type="text" value={specs} onChange={e => setSpecs(e.target.value)} placeholder="예: 60x110x22mm, C3" style={S.input} />
            </Section>

            <Section title="공급업체">
              <select value={vendorId} onChange={e => {
                setVendorId(e.target.value);
                const v = vendors.find(x => x.id === e.target.value);
                if (v?.currency) setCurrency(v.currency);
              }} style={S.input} disabled={loadingMaster}>
                <option value="">{vendors.length === 0 ? '공급업체 없음 — /vendors/new에서 먼저 등록' : '— 선택 안 함 —'}</option>
                {vendors.map(v => (
                  <option key={v.id} value={v.id}>{v.name}{v.currency ? ` (${v.currency})` : ''}</option>
                ))}
              </select>
            </Section>

            <Section title="관련 자산">
              <select
                value={assetId}
                onChange={e => setAssetId(e.target.value)}
                style={S.input}
                disabled={loadingMaster}
              >
                <option value="">{loadingMaster ? '불러오는 중…' : '— 선택 안 함 —'}</option>
                {assets.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.machine_asset_number} — {a.name_en}
                  </option>
                ))}
              </select>
            </Section>

            <Section title="현재 수량 *">
              <input
                type="number"
                min="0"
                step="1"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                style={S.input}
                required
              />
            </Section>

            <Section title="최소 수량 *">
              <input
                type="number"
                min="0"
                step="1"
                value={minQuantity}
                onChange={e => setMinQuantity(e.target.value)}
                style={S.input}
                required
              />
            </Section>

            <Section title="단위">
              <input
                type="text"
                value={unit}
                onChange={e => setUnit(e.target.value)}
                placeholder="EA, SET, L, m 등"
                style={S.input}
              />
            </Section>

            <Section title="단가">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 8 }}>
                <input type="number" min="0" step="0.01" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} placeholder="예: 1250" style={S.input} />
                <select value={currency} onChange={e => setCurrency(e.target.value)} style={S.input}>
                  <option value="INR">INR</option>
                  <option value="KRW">KRW</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </Section>

            <Section title="보관 위치">
              <input
                type="text"
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="예: 자재창고 A-3"
                style={S.input}
              />
            </Section>

            <Section title="비고">
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="공급처, 규격, 호환정보 등"
                style={{ ...S.input, height: 100, fontFamily: 'inherit', resize: 'vertical' }}
              />
            </Section>

            {error && <div style={S.error}>{error}</div>}

            <div style={S.actions}>
              <button
                type="button"
                onClick={() => router.push('/inventory')}
                style={{ ...S.btn, ...S.btnSecondary }}
                disabled={busy}
              >
                취소
              </button>
              <button
                type="submit"
                disabled={submitDisabled}
                style={{
                  ...S.btn,
                  ...(submitDisabled ? S.btnDisabled : S.btnPrimary),
                }}
              >
                {busy ? '등록 중…' : '등록'}
              </button>
            </div>
          </form>
        )}
      </main>

      <BottomNav />
    </>
  );
}

function Section({ title, children }) {
  return (
    <section style={{ marginBottom: 4, padding: '16px 16px 8px' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>{title}</div>
      {children}
    </section>
  );
}

const S = {
  page: { fontFamily: 'system-ui,-apple-system,sans-serif', background: '#0f172a', minHeight: '100vh', color: '#e2e8f0', paddingBottom: 'calc(60px + env(safe-area-inset-bottom,0px) + 24px)', maxWidth: 480, margin: '0 auto' },
  header: { position: 'sticky', top: 0, zIndex: 20, background: '#0f172a', borderBottom: '1px solid #1f2937', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.4)' },
  backLink: { color: '#94a3b8', textDecoration: 'none', fontSize: 14, minWidth: 40 },
  title: { fontSize: 18, fontWeight: 700, flex: 1, margin: 0, color: '#f8fafc' },
  form: { paddingTop: 8 },
  input: { width: '100%', padding: '12px 14px', border: '1px solid #334155', borderRadius: 10, fontSize: 16, outline: 'none', boxSizing: 'border-box', background: '#0b1220', color: '#f1f5f9', minHeight: 48 },
  catGrid: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 },
  catBtn: { padding: '14px 8px', borderRadius: 10, border: '2px solid', cursor: 'pointer', fontSize: 13, fontWeight: 700, minHeight: 52, transition: 'all 0.15s' },
  actions: { display: 'flex', gap: 10, padding: '16px 16px 0' },
  btn: { flex: 1, padding: '16px', borderRadius: 12, border: 'none', fontSize: 16, fontWeight: 700, cursor: 'pointer', minHeight: 52 },
  btnSecondary: { background: '#334155', color: '#e2e8f0' },
  btnPrimary: { background: '#2563eb', color: '#fff', boxShadow: '0 4px 12px rgba(37,99,235,0.4)' },
  btnDisabled: { background: '#1f2937', color: '#475569', cursor: 'not-allowed', boxShadow: 'none' },
  error: { margin: '0 16px 16px', padding: 14, background: 'rgba(220,38,38,0.15)', color: '#fca5a5', border: '1px solid rgba(220,38,38,0.4)', borderRadius: 10, fontSize: 14 },
};
