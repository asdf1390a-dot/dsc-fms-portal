import Link from 'next/link';

// BreadcrumbNav — shows the current path hierarchy.
// Props: items = [{ label, href }, ...]
// Last item is rendered as plain text (current page).
export default function BreadcrumbNav({ items = [] }) {
  if (!items.length) return null;
  return (
    <nav style={S.bar} aria-label="Breadcrumb">
      <ol style={S.list}>
        {items.map((it, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={`${it.label}-${i}`} style={S.li}>
              {isLast || !it.href ? (
                <span style={S.current}>{it.label}</span>
              ) : (
                <Link href={it.href} style={S.link}>{it.label}</Link>
              )}
              {!isLast && <span style={S.sep} aria-hidden="true">/</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

const S = {
  bar: {
    background: '#0b1220',
    borderBottom: '1px solid #1f2937',
    padding: '8px 12px',
  },
  list: {
    listStyle: 'none', margin: 0, padding: 0,
    maxWidth: 960, marginLeft: 'auto', marginRight: 'auto',
    display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2,
    fontSize: 12,
  },
  li: { display: 'inline-flex', alignItems: 'center', gap: 6 },
  link: {
    color: '#7dd3fc', textDecoration: 'none', fontWeight: 600,
    padding: '4px 2px',
  },
  current: { color: '#e2e8f0', fontWeight: 700, padding: '4px 2px' },
  sep: { color: '#475569', fontSize: 12, margin: '0 4px' },
};
