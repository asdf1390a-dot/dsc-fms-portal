import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) {
        const next = router.query.next || '/assets';
        router.replace(typeof next === 'string' ? next : '/assets');
      }
    });
  }, [router]);

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      let email = identifier.trim();
      if (!email) throw new Error('이메일 또는 직원 ID를 입력하세요');
      if (!email.includes('@')) {
        // looks like an employee ID — resolve to email server-side
        setInfo('직원 ID 조회 중…');
        const r = await fetch('/api/auth/find-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ employee_id: email }),
        });
        if (!r.ok) throw new Error(`직원 ID를 찾을 수 없습니다: ${email}`);
        const j = await r.json();
        email = j.email;
        setInfo(`변환됨 → ${email}`);
      }

      const { error: authErr } = await supabase.auth.signInWithPassword({ email, password });
      if (authErr) throw authErr;

      const next = router.query.next || '/assets';
      router.push(typeof next === 'string' ? next : '/assets');
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Head>
        <title>로그인 | DSC FMS</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </Head>
      <main style={S.page}>
        <div style={S.card}>
          <div style={S.brand}>DSC FMS</div>
          <h1 style={S.title}>로그인</h1>
          <p style={S.subtitle}>직원 ID 또는 이메일 + 비밀번호</p>

          <form onSubmit={onSubmit}>
            <label style={S.label}>직원 ID / 이메일</label>
            <input
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="직원 ID 또는 이메일"
              autoComplete="username"
              autoFocus
              inputMode="email"
              style={S.input}
            />

            <label style={S.label}>비밀번호</label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              style={S.input}
            />

            {error && <div style={S.error}>{error}</div>}
            {info && !error && <div style={S.info}>{info}</div>}

            <button type="submit" disabled={busy || !identifier || !password} style={{
              ...S.button,
              ...((busy || !identifier || !password) ? S.buttonDisabled : null),
            }}>
              {busy ? '로그인 중…' : '로그인'}
            </button>
          </form>

          <div style={S.footer}>
            <Link href="/assets" style={S.link}>로그인 없이 둘러보기 →</Link>
          </div>
        </div>
      </main>
    </>
  );
}

const S = {
  page: {
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    background: '#0f172a',
    minHeight: '100vh',
    color: '#0f172a',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%', maxWidth: 380,
    background: '#fff', borderRadius: 16, padding: 28,
    boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
  },
  brand: { fontSize: 13, fontWeight: 700, letterSpacing: 1.5, color: '#94a3b8', textTransform: 'uppercase' },
  title: { fontSize: 24, fontWeight: 700, margin: '8px 0 4px' },
  subtitle: { fontSize: 13, color: '#64748b', marginBottom: 20 },

  label: { display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginTop: 14, marginBottom: 6 },
  input: {
    width: '100%', padding: '12px 14px',
    border: '1px solid #cbd5e1', borderRadius: 10,
    fontSize: 16, outline: 'none', boxSizing: 'border-box',
    background: '#f8fafc',
  },

  error: {
    marginTop: 14, padding: 10,
    background: '#fee2e2', color: '#991b1b',
    borderRadius: 8, fontSize: 13,
  },
  info: {
    marginTop: 14, padding: 10,
    background: '#dbeafe', color: '#1e40af',
    borderRadius: 8, fontSize: 13,
  },

  button: {
    marginTop: 20, width: '100%',
    padding: '13px 20px', border: 'none', borderRadius: 10,
    background: '#0f172a', color: '#fff',
    fontSize: 15, fontWeight: 600, cursor: 'pointer',
  },
  buttonDisabled: { background: '#cbd5e1', cursor: 'not-allowed' },

  footer: { marginTop: 18, textAlign: 'center', fontSize: 13 },
  link: { color: '#64748b', textDecoration: 'none' },
};
