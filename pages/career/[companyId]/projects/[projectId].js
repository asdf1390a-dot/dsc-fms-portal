import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useAuth } from '../../../../lib/use-auth';
import BottomNav from '../../../../components/BottomNav';
import ProjectForm from '../../../../components/career/ProjectForm';
import { C } from '../../../../components/career/careerStyles';

export default function EditProjectPage() {
  const router = useRouter();
  const { companyId, projectId } = router.query;
  const { isAuthed, loading: authLoading } = useAuth();

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!authLoading && !isAuthed) {
      router.replace(`/login?next=${encodeURIComponent(`/career/${companyId || ''}/projects/${projectId || ''}`)}`);
    }
  }, [authLoading, isAuthed, router, companyId, projectId]);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true); setError(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      const r = await fetch(`/api/career/projects/${projectId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setProject(j.project);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (isAuthed && projectId) load();
  }, [isAuthed, projectId, load]);

  return (
    <>
      <Head>
        <title>프로젝트 편집 | 커리어</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#0f172a" />
      </Head>
      <main style={C.page}>
        <header style={C.header}>
          <Link href={`/career/${companyId || ''}`} style={C.backLink}>← 회사</Link>
          <h1 style={C.title}>프로젝트 편집</h1>
          <div style={{ width: 44 }} />
        </header>

        {authLoading || loading ? (
          <div style={C.loading}>…</div>
        ) : !project ? (
          <div style={C.body}>
            <div style={C.errorBox}>{error || '프로젝트를 찾을 수 없습니다'}</div>
          </div>
        ) : (
          <div style={C.body}>
            <ProjectForm
              companyId={companyId}
              initial={project}
              onSaved={() => router.replace(`/career/${companyId}`)}
            />
          </div>
        )}
      </main>
      <BottomNav />
    </>
  );
}
