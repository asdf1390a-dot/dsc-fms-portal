import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../lib/use-auth';
import BottomNav from '../../../components/BottomNav';

const CATEGORY_OPTIONS = [
  { value: 'consumable', label: '소모품' },
  { value: 'mechanical', label: '기계부품' },
  { value: 'electrical', label: '전기부품' },
  { value: 'hydraulic',  label: '유압부품' },
  { value: 'other',      label: '기타' },
];

export default function EditInventoryPage() {
  const router = useRouter();
  const { id } = router.query;
  const { isAuthed, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [assets, setAssets] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const [form, setForm] = useState({
    name_ko: '', name_en: '', part_number: '', category: 'consumable',
    asset_id: '', vendor_id: '', maker: '', specs: '',
    unit_price: '', currency: 'INR', quantity: '0', min_quantity: '5',
    unit: 'EA', location: '', notes: '',
  });

  useEffect(() => {
    if (!authLoading && !isAuthed) router.replace(`/login?next=${encodeURIComponent(`/inventory/edit/${id||''}`)}`);
  }, [authLoading, isAuthed, router, id]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [partRes, assetsRes, vendorsRes] = await Promise.all([
        supabase.from('spare_parts').select('*').eq('id', id).maybeSingle(),
        supabase.from('assets').select('id, machine_asset_number, name_en').eq('status', 'active').order('machine_asset_number'),
        supabase.from('vendors').select('id, name, currency').eq('is_active', true).order('name'),
      ]);
      if (cancelled) return;
      if (partRes.error) { setError(partRes.error.message); setLoading(false); return; }
      const p = partRes.data;
      if (!p) { setError('예비품을 찾을 수 없습니다'); setLoading(false); return; }
      setForm({
        name_ko: p.name_ko || '',
        name_en: p.name_en || '',
        part_number: p.part_number || '',
        category: p.category || 'consumable',
        asset_id: p.asset_id || '',
        vendor_id: p.vendor_id || '',
        maker: p.maker || '',
        specs: p.specs || '',
        unit_price: p.unit_price != null ? String(p.unit_price) : '',
        currency: p.currency || 'INR',
        quantity: p.quantity != null ? String(p.quantity) : '0',
        min_quantity: p.min_quantity != null ? String(p.min_quantity) : '5',
        unit: p.unit || 'EA',
        location: p.location || '',
        notes: p.notes || '',
      });
      setAssets(assetsRes.data || []);
      setVendors(vendorsRes.data || []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id]);

  function up(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function submit(e) {
    e.preventDefault();
    if (!form.name_ko.trim()) { setError('품목명(한국어)을 입력하세요'); return; }
    const qty = parseInt(form.quantity, 10);
    const minQty = parseInt(form.min_quantity, 10);
    if (Number.isNaN(qty) || qty < 0 || Number.isNaN(minQty) || minQty < 0) {
      setError('수량을 올바르게 입력하세요'); return;
    }
    setBusy(true);
    setError(null);
    try {
      const { error: updErr } = await supabase.from('spare_parts').update({
        name_ko: form.name_ko.trim(),
        name_en: form.name_en.trim() || null,
        part_number: form.part_number.trim() || null,
        category: form.category,
        asset_id: form.asset_id || null,
        vendor_id: form.vendor_id || null,
        maker: form.maker.trim() || null,
        specs: form.specs.trim() || null,
        unit_price: form.unit_price ? Number(form.unit_price) : null,
        currency: form.currency,
        quantity: qty,
        min_quantity: minQty,
        unit: form.unit.trim() || 'EA',
        location: form.location.trim() || null,
        notes: form.notes.trim() || null,
      }).eq('id', id);
      if (updErr) throw updErr;
      router.push(`/inventory/${id}`);
    } catch (err) {
      setError(err.message || String(err));
      setBusy(false);
    }
  }

  return (
    <>
      <Head>
        <title>예비품 편집 | DSC FMS</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </Head>
      <main style={S.page}>
        <header style={S.header}>
          <Link href={`/inventory/${id||''}`} style={S.backLink}>← 상세</Link>
          <h1 style={S.title}>예비품 편집</h1>
          <div style={{ minWidth: 40 }} />
        </header>

        {loading ? <div style={S.loading}>불러오는 중…</div> : (
          <form onSubmit={submit}>
            <Sec title="품목명 (한국어) *"><input style={S.input} value={form.name_ko} onChange={e=>up('name_ko', e.target.value)} required /></Sec>
            <Sec title="품목명 (영어)"><input style={S.input} value={form.name_en} onChange={e=>up('name_en', e.target.value)} /></Sec>
            <Sec title="품번"><input style={S.input} value={form.part_number} onChange={e=>up('part_number', e.target.value)} /></Sec>
            <Sec title="카테고리">
              <div style={S.catGrid}>
                {CATEGORY_OPTIONS.map(opt => (
                  <button key={opt.value} type="button" onClick={()=>up('category', opt.value)}
                    style={{ ...S.catBtn, borderColor: form.category===opt.value?'#2563eb':'#334155',
                      background: form.category===opt.value?'rgba(37,99,235,0.2)':'#0b1220',
                      color: form.category===opt.value?'#93c5fd':'#cbd5e1' }}>{opt.label}</button>
                ))}
              </div>
            </Sec>
            <Sec title="제조사"><input style={S.input} value={form.maker} onChange={e=>up('maker', e.target.value)} /></Sec>
            <Sec title="규격/사양"><input style={S.input} value={form.specs} onChange={e=>up('specs', e.target.value)} /></Sec>
            <Sec title="공급업체">
              <select style={S.input} value={form.vendor_id} onChange={e=>up('vendor_id', e.target.value)}>
                <option value="">— 선택 안 함 —</option>
                {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </Sec>
            <Sec title="관련 자산">
              <select style={S.input} value={form.asset_id} onChange={e=>up('asset_id', e.target.value)}>
                <option value="">— 선택 안 함 —</option>
                {assets.map(a => <option key={a.id} value={a.id}>{a.machine_asset_number} — {a.name_en}</option>)}
              </select>
            </Sec>
            <Sec title="현재 수량"><input style={S.input} type="number" min="0" value={form.quantity} onChange={e=>up('quantity', e.target.value)} /></Sec>
            <Sec title="최소 수량"><input style={S.input} type="number" min="0" value={form.min_quantity} onChange={e=>up('min_quantity', e.target.value)} /></Sec>
            <Sec title="단위"><input style={S.input} value={form.unit} onChange={e=>up('unit', e.target.value)} /></Sec>
            <Sec title="단가">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 8 }}>
                <input style={S.input} type="number" min="0" step="0.01" value={form.unit_price} onChange={e=>up('unit_price', e.target.value)} />
                <select style={S.input} value={form.currency} onChange={e=>up('currency', e.target.value)}>
                  <option value="INR">INR</option><option value="KRW">KRW</option><option value="USD">USD</option>
                </select>
              </div>
            </Sec>
            <Sec title="보관 위치"><input style={S.input} value={form.location} onChange={e=>up('location', e.target.value)} /></Sec>
            <Sec title="비고"><textarea style={{...S.input, height: 90, fontFamily:'inherit', resize:'vertical'}} value={form.notes} onChange={e=>up('notes', e.target.value)} /></Sec>

            {error && <div style={S.error}>{error}</div>}

            <div style={S.actions}>
              <button type="button" onClick={()=>router.push(`/inventory/${id}`)} style={{...S.btn, ...S.btnSecondary}} disabled={busy}>취소</button>
              <button type="submit" style={{...S.btn, ...(busy?S.btnDisabled:S.btnPrimary)}} disabled={busy}>{busy?'저장 중…':'저장'}</button>
            </div>
          </form>
        )}
      </main>
      <BottomNav />
    </>
  );
}

function Sec({ title, children }) {
  return (
    <section style={{ padding: '14px 16px 4px' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.4 }}>{title}</div>
      {children}
    </section>
  );
}

const S = {
  page: { fontFamily: 'system-ui,-apple-system,sans-serif', background: '#0f172a', minHeight: '100vh', color: '#e2e8f0', paddingBottom: 'calc(60px + env(safe-area-inset-bottom,0px) + 24px)', maxWidth: 480, margin: '0 auto' },
  header: { position: 'sticky', top: 0, zIndex: 20, background: '#0f172a', borderBottom: '1px solid #1f2937', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.4)' },
  backLink: { color: '#94a3b8', textDecoration: 'none', fontSize: 14, minWidth: 60 },
  title: { fontSize: 17, fontWeight: 700, flex: 1, margin: 0, textAlign: 'center', color: '#f8fafc' },
  input: { width: '100%', padding: '12px 14px', border: '1px solid #334155', borderRadius: 10, fontSize: 16, outline: 'none', boxSizing: 'border-box', background: '#0b1220', color: '#f1f5f9', minHeight: 48 },
  catGrid: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 },
  catBtn: { padding: '14px 8px', borderRadius: 10, border: '2px solid', cursor: 'pointer', fontSize: 13, fontWeight: 700, minHeight: 52 },
  actions: { display: 'flex', gap: 10, padding: '16px' },
  btn: { flex: 1, padding: '16px', borderRadius: 12, border: 'none', fontSize: 16, fontWeight: 700, cursor: 'pointer', minHeight: 52 },
  btnSecondary: { background: '#334155', color: '#e2e8f0' },
  btnPrimary: { background: '#2563eb', color: '#fff', boxShadow: '0 4px 12px rgba(37,99,235,0.4)' },
  btnDisabled: { background: '#1f2937', color: '#475569', cursor: 'not-allowed' },
  error: { margin: '0 16px 12px', padding: 14, background: 'rgba(220,38,38,0.15)', color: '#fca5a5', border: '1px solid rgba(220,38,38,0.4)', borderRadius: 10 },
  loading: { padding: 48, textAlign: 'center', color: '#64748b' },
};
