import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import AssetForm from '../../components/AssetForm';
import { useAuth } from '../../lib/use-auth';
import { supabase } from '../../lib/supabase';

export default function NewAssetPage() {
  const router = useRouter();
  const { isAuthed, loading } = useAuth();

  useEffect(() => {
    if (!loading && !isAuthed) {
      router.replace(`/login?next=${encodeURIComponent('/assets/new')}`);
    }
  }, [loading, isAuthed, router]);

  async function handleSave(payload) {
    const { data, error } = await supabase.from('assets').insert(payload).select().single();
    if (error) throw error;
    router.push(`/assets/${encodeURIComponent(data.machine_asset_number)}`);
  }

  return (
    <>
      <Head>
        <title>New Asset | DSC FMS</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </Head>
      <main style={S.page}>
        <header style={S.header}>
          <Link href="/assets" style={S.backLink}>← Assets</Link>
          <h1 style={S.title}>New Asset</h1>
        </header>
        {loading ? (
          <div style={S.loading}>…</div>
        ) : isAuthed ? (
          <AssetForm
            mode="new"
            onSave={handleSave}
            onCancel={() => router.push('/assets')}
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
};
