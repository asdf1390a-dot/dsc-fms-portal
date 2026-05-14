import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import AssetForm from '../../../components/AssetForm';
import { useAuth } from '../../../lib/use-auth';
import { supabase } from '../../../lib/supabase';

export default function EditAssetPage() {
  const router = useRouter();
  const { id } = router.query;
  const { isAuthed, loading: authLoading } = useAuth();
  const [asset, setAsset] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!authLoading && !isAuthed) {
      router.replace(`/login?next=${encodeURIComponent(`/assets/edit/${id}`)}`);
    }
  }, [authLoading, isAuthed, id, router]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data, error } = await supabase.from('assets')
        .select('*')
        .eq('machine_asset_number', id)
        .maybeSingle();
      if (error) { setError(error.message); setLoading(false); return; }
      if (!data) { setError('찾을 수 없습니다'); setLoading(false); return; }
      setAsset(data);
      setLoading(false);
    })();
  }, [id]);

  async function handleSave(payload) {
    const { error } = await supabase.from('assets')
      .update(payload)
      .eq('id', asset.id);
    if (error) throw error;
    router.push(`/assets/${encodeURIComponent(payload.machine_asset_number || asset.machine_asset_number)}`);
  }

  return (
    <>
      <Head>
        <title>{asset ? `${asset.machine_asset_number} 편집` : '자산 편집'} | DSC FMS</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </Head>
      <main style={S.page}>
        <header style={S.header}>
          <Link href={`/assets/${encodeURIComponent(id || '')}`} style={S.backLink}>← 상세</Link>
          <h1 style={S.title}>자산 편집</h1>
        </header>
        {loading || authLoading ? (
          <div style={S.loading}>불러오는 중…</div>
        ) : error ? (
          <div style={S.error}>{error}</div>
        ) : asset && isAuthed ? (
          <AssetForm
            mode="edit"
            initial={asset}
            onSave={handleSave}
            onCancel={() => router.push(`/assets/${encodeURIComponent(id)}`)}
          />
        ) : null}
      </main>
    </>
  );
}

const S = {
  page: {
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    background: '#f8fafc', minHeight: '100vh', color: '#0f172a', paddingBottom: 60,
  },
  header: {
    position: 'sticky', top: 0, zIndex: 10,
    background: '#0f172a', color: '#fff', padding: '14px 16px',
    display: 'flex', alignItems: 'center', gap: 12,
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  backLink: { color: '#94a3b8', textDecoration: 'none', fontSize: 14 },
  title: { fontSize: 18, fontWeight: 600, flex: 1, margin: 0 },
  loading: { padding: 32, textAlign: 'center', color: '#64748b' },
  error: { margin: 16, padding: 14, background: '#fee2e2', color: '#991b1b', borderRadius: 10 },
};
