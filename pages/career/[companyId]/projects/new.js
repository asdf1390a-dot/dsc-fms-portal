import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { useAuth } from '../../../../lib/use-auth';
import BottomNav from '../../../../components/BottomNav';
import ProjectForm from '../../../../components/career/ProjectForm';
import { C } from '../../../../components/career/careerStyles';

export default function NewProjectPage() {
  const router = useRouter();
  const { companyId } = router.query;
  const { isAuthed, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !isAuthed) {
      router.replace(`/login?next=${encodeURIComponent(`/career/${companyId}/projects/new`)}`);
    }
  }, [authLoading, isAuthed, router, companyId]);

  return (
    <>
      <Head>
        <title>프로젝트 추가 | 커리어</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#0f172a" />
      </Head>
      <main style={C.page}>
        <header style={C.header}>
          <Link href={`/career/${companyId || ''}`} style={C.backLink}>← 회사</Link>
          <h1 style={C.title}>프로젝트 추가</h1>
          <div style={{ width: 44 }} />
        </header>

        {authLoading || !companyId ? (
          <div style={C.loading}>…</div>
        ) : (
          <div style={C.body}>
            <ProjectForm
              companyId={companyId}
              onSaved={() => router.replace(`/career/${companyId}`)}
            />
          </div>
        )}
      </main>
      <BottomNav />
    </>
  );
}
