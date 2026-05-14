import Head from 'next/head';
import JeepneyHeader from './JeepneyHeader';
import BreadcrumbNav from './BreadcrumbNav';

// Root layout for /jeepney-personal/** pages.
// Props:
//   title       — page title (Head + header)
//   level       — 1 | 2 | 3 — visual accent
//   backHref    — optional back link
//   backLabel   — back button label
//   crumbs      — [{ label, href }] breadcrumb items (last = current)
//   children    — page content
export default function JeepneyLayout({
  title,
  level = 1,
  backHref,
  backLabel = 'Back',
  crumbs = [],
  children,
}) {
  return (
    <>
      <Head>
        <title>{title} | Jeepney Personal</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#0f172a" />
      </Head>
      <div style={S.shell}>
        <JeepneyHeader title={title} level={level} backHref={backHref} backLabel={backLabel} />
        {crumbs.length > 0 && <BreadcrumbNav items={crumbs} />}
        <main style={S.main}>
          <div style={S.inner}>
            {children}
          </div>
        </main>
      </div>
    </>
  );
}

const S = {
  shell: {
    minHeight: '100vh',
    background: '#0b1220',
    color: '#e2e8f0',
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    paddingBottom: 'env(safe-area-inset-bottom, 0)',
  },
  main: {
    padding: '16px 12px 80px',
  },
  inner: {
    maxWidth: 960, margin: '0 auto',
  },
};
