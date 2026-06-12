import { Suspense } from 'react';
import AssetsClient from './AssetsClient';

// Route segment config — must live in a Server Component to be honored by Next.js 14.
// These directives prevent Vercel from caching a stale (or errored) HTML payload at the edge.
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';

export default function AssetsPage() {
  // useSearchParams() inside the client component REQUIRES a Suspense boundary in Next.js 14 App Router.
  // Without it the build emits an error and Vercel serves the cached __next_error__ page (root cause of the
  // recurring HTTP 200 + 404 content regression observed since 2026-06-10).
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Loading…</div>}>
      <AssetsClient />
    </Suspense>
  );
}
