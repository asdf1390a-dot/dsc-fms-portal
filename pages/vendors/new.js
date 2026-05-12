import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/use-auth';
import BottomNav from '../../components/BottomNav';
import VendorForm from '../../components/vendors/VendorForm';

export default function VendorNewPage() {
  const router = useRouter();
  const { isAuthed, loading: authLoading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!authLoading && !isAuthed) router.replace(`/login?next=${encodeURIComponent('/vendors/new')}`);
  }, [authLoading, isAuthed, router]);

  async function handleSubmit(payload) {
    setBusy(true);
    setError(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      const res = await fetch('/api/vendors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'save failed');
      router.push(`/vendors/${json.item.id}`);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <>
      <Head>
        <title>공급업체 등록 | DSC FMS</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </Head>
      <main style={S.page}>
        <header style={S.header}>
          <Link href="/vendors" style={S.backLink}>← 공급업체</Link>
          <h1 style={S.title}>공급업체 등록</h1>
          <div style={{ minWidth: 40 }} />
        </header>
        {error && <div style={S.errorBox}>{error}</div>}
        <VendorForm onSubmit={handleSubmit} onCancel={() => router.push('/vendors')} busy={busy} />
      </main>
      <BottomNav />
    </>
  );
}

const S = {
  page: { fontFamily: 'system-ui,-apple-system,sans-serif', background: '#0f172a', minHeight: '100vh', color: '#e2e8f0', paddingBottom: 'calc(60px + env(safe-area-inset-bottom,0px) + 24px)', maxWidth: 480, margin: '0 auto' },
  header: { position: 'sticky', top: 0, zIndex: 20, background: '#0f172a', borderBottom: '1px solid #1f2937', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.4)' },
  backLink: { color: '#94a3b8', textDecoration: 'none', fontSize: 14, minWidth: 80 },
  title: { fontSize: 18, fontWeight: 700, flex: 1, margin: 0, textAlign: 'center', color: '#f8fafc' },
  errorBox: { margin: 14, padding: 14, background: 'rgba(220,38,38,0.15)', color: '#fca5a5', border: '1px solid rgba(220,38,38,0.4)', borderRadius: 10 },
};
