import { Html, Head, Main, NextScript } from 'next/document';
import { getCSSVariables } from '../lib/design-tokens';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
        />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Noto+Sans+KR:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <style dangerouslySetInnerHTML={{ __html: getCSSVariables() }} />
        <style>{`
          html {
            scroll-behavior: smooth;
          }
          body {
            margin: 0;
            padding: 0;
            font-family: var(--font-body);
            background-color: var(--color-bg-primary);
            color: var(--color-text-primary);
          }
          * {
            box-sizing: border-box;
          }
          a {
            color: var(--color-accent-cyan);
            text-decoration: none;
            transition: color var(--transition-base);
          }
          a:hover {
            color: var(--color-accent-cyan-200);
          }
          h1, h2, h3, h4, h5, h6 {
            margin: 0;
          }
          p {
            margin: 0;
          }
          button {
            font-family: var(--font-body);
          }
          input, textarea, select {
            font-family: var(--font-body);
          }
        `}</style>
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
