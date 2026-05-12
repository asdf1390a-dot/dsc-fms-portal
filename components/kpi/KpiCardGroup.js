// KpiCardGroup — group header + list of KpiCard
import KpiCard from './KpiCard';

export default function KpiCardGroup({ groupName, items = [] }) {
  if (!items.length) return null;
  return (
    <section style={S.section}>
      <div style={S.head}>
        <span style={S.title}>{groupName}</span>
        <span style={S.count}>{items.length}</span>
      </div>
      <div style={S.list}>
        {items.map(it => (
          <KpiCard
            key={it.category_id}
            category={{
              label:     it.label,
              unit:      it.unit,
              direction: it.direction,
              is_auto:   it.is_auto,
            }}
            target={it.target_value}
            actual={it.actual_value}
          />
        ))}
      </div>
    </section>
  );
}

const S = {
  section: { padding: '12px 14px 4px' },
  head:    { display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 },
  title:   { fontSize: 12, fontWeight: 800, letterSpacing: 1, color: '#94a3b8', textTransform: 'uppercase' },
  count:   { fontSize: 10, color: '#475569', fontFamily: 'ui-monospace,Menlo,Consolas,monospace' },
  list:    { display: 'grid', gridTemplateColumns: '1fr', gap: 8 },
};
