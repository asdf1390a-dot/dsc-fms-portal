import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/use-auth';
import BottomNav from '../../components/BottomNav';
import { C, normalizeSlug } from '../../components/career/careerStyles';

export default function CareerSetupPage() {
  const router = useRouter();
  const { isAuthed, loading: authLoading, fullName, user } = useAuth();

  const [form, setForm] = useState({
    slug:          '',
    display_name:  '',
    headline:      '',
    bio:           '',
    contact_email: '',
    linkedin_url:  '',
  });
  const [existing, setExisting] = useState(null);
  const [slugStatus, setSlugStatus] = useState({ checking: false, available: null });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [bootstrapping, setBootstrapping] = useState(true);

  // Redirect when unauthed
  useEffect(() => {
    if (!authLoading && !isAuthed) {
      router.replace(`/login?next=${encodeURIComponent('/career/setup')}`);
    }
  }, [authLoading, isAuthed, router]);

  // Load existing profile (if any) to allow edit
  useEffect(() => {
    if (!isAuthed) return;
    let cancel = false;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data?.session?.access_token;
        const r = await fetch('/api/career/profile', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const j = await r.json().catch(() => ({}));
        if (cancel) return;
        if (j.profile) {
          setExisting(j.profile);
          setForm({
            slug:          j.profile.slug || '',
            display_name:  j.profile.display_name || '',
            headline:      j.profile.headline || '',
            bio:           j.profile.bio || '',
            contact_email: j.profile.contact_email || '',
            linkedin_url:  j.profile.linkedin_url || '',
          });
        } else {
          // Default slug suggestion from email local part
          const email = user?.email || '';
          const suggested = normalizeSlug(email.split('@')[0] || 'me');
          setForm(p => ({
            ...p,
            slug: suggested,
            display_name: fullName || '',
            contact_email: email,
          }));
        }
      } finally {
        if (!cancel) setBootstrapping(false);
      }
    })();
    return () => { cancel = true; };
  }, [isAuthed, fullName, user]);

  // Debounced slug availability check
  useEffect(() => {
    const slug = normalizeSlug(form.slug);
    if (!slug) { setSlugStatus({ checking: false, available: null }); return; }
    if (existing && existing.slug === slug) {
      setSlugStatus({ checking: false, available: true });
      return;
    }
    setSlugStatus({ checking: true, available: null });
    const t = setTimeout(async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data?.session?.access_token;
        const r = await fetch(`/api/career/profile/check-slug?slug=${encodeURIComponent(slug)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const j = await r.json().catch(() => ({}));
        setSlugStatus({ checking: false, available: !!j.available });
      } catch {
        setSlugStatus({ checking: false, available: null });
      }
    }, 350);
    return () => clearTimeout(t);
  }, [form.slug, existing]);

  function upd(k, v) { setForm(p => ({ ...p, [k]: v })); }
  function onSlugChange(e) {
    setForm(p => ({ ...p, slug: normalizeSlug(e.target.value) }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    const slug = normalizeSlug(form.slug);
    if (!slug)                       { setError('슬러그를 입력하세요'); return; }
    if (slugStatus.available === false) { setError('이미 사용 중인 슬러그입니다'); return; }

    setSubmitting(true); setError(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      const r = await fetch('/api/career/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          slug,
          display_name:  form.display_name.trim() || null,
          headline:      form.headline.trim() || null,
          bio:           form.bio.trim() || null,
          contact_email: form.contact_email.trim() || null,
          linkedin_url:  form.linkedin_url.trim() || null,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      router.replace('/career');
    } catch (err) {
      setError(err.message || String(err));
      setSubmitting(false);
    }
  }

  return (
    <>
      <Head>
        <title>포트폴리오 설정 | DSC FMS</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#0f172a" />
      </Head>
      <main style={C.page}>
        <header style={C.header}>
          <Link href="/career" style={C.backLink}>← 커리어</Link>
          <h1 style={C.title}>{existing ? '포트폴리오 편집' : '포트폴리오 설정'}</h1>
          <div style={{ width: 44 }} />
        </header>

        {authLoading || bootstrapping ? (
          <div style={C.loading}>…</div>
        ) : (
          <form onSubmit={onSubmit} style={C.body}>
            <section style={C.card}>
              <Field label="공개 URL 슬러그 *">
                <input type="text" value={form.slug} onChange={onSlugChange}
                  required style={C.input}
                  placeholder="예: ktna" />
                <div style={S.slugHint}>
                  공개 URL: <span style={S.slugDomain}>/p/{form.slug || '...'}</span>
                </div>
                <div style={{ marginTop: 4 }}>
                  {slugStatus.checking && <span style={{ ...S.slugStatus, color: '#94a3b8' }}>확인 중…</span>}
                  {!slugStatus.checking && slugStatus.available === true &&
                    <span style={{ ...S.slugStatus, color: '#86efac' }}>사용 가능</span>}
                  {!slugStatus.checking && slugStatus.available === false &&
                    <span style={{ ...S.slugStatus, color: '#fca5a5' }}>이미 사용 중</span>}
                </div>
              </Field>

              <Field label="표시 이름">
                <input type="text" value={form.display_name}
                  onChange={(e) => upd('display_name', e.target.value)} style={C.input}
                  placeholder="예: 나경태" />
              </Field>

              <Field label="헤드라인">
                <input type="text" value={form.headline}
                  onChange={(e) => upd('headline', e.target.value)} style={C.input}
                  placeholder="예: 자동차 부품 공장 생산/기술/보전 총괄" />
              </Field>

              <Field label="자기소개 (bio)">
                <textarea rows={5} value={form.bio}
                  onChange={(e) => upd('bio', e.target.value)} style={C.textarea} />
              </Field>

              <Field label="공개 이메일">
                <input type="email" value={form.contact_email}
                  onChange={(e) => upd('contact_email', e.target.value)} style={C.input} />
              </Field>

              <Field label="LinkedIn URL">
                <input type="url" value={form.linkedin_url}
                  onChange={(e) => upd('linkedin_url', e.target.value)} style={C.input}
                  placeholder="https://www.linkedin.com/in/..." />
              </Field>
            </section>

            {error && <div style={C.errorBox}>{error}</div>}

            <button type="submit" disabled={submitting || slugStatus.available === false}
              style={C.primaryBtn}>
              {submitting ? '저장 중…' : '저장'}
            </button>
          </form>
        )}
      </main>
      <BottomNav />
    </>
  );
}

function Field({ label, children }) {
  return (
    <label style={C.field}>
      <span style={C.fieldLabel}>{label}</span>
      {children}
    </label>
  );
}

const S = {
  slugHint:   { fontSize: 12, color: '#94a3b8', marginTop: 6 },
  slugDomain: { color: '#cbd5e1', fontFamily: 'ui-monospace, Menlo, Consolas, monospace' },
  slugStatus: { fontSize: 12, fontWeight: 600 },
};
