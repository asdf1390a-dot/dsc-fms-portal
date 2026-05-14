import JeepneyLayout from '../../../../components/jeepney/JeepneyLayout';

// L3: Travel Records module landing (skeleton).
// Tables (travel_records, travel_schedules, travel_costs, travel_routes)
// are designed in ARCHITECTURE_DSC_HUB.md §4.2 — Phase 2 will implement.
export default function TravelHome() {
  return (
    <JeepneyLayout
      title="Travel Records"
      level={3}
      backHref="/jeepney-personal/dsc-hub"
      backLabel="DSC HUB"
      crumbs={[
        { label: 'Personal', href: '/jeepney-personal' },
        { label: 'DSC HUB', href: '/jeepney-personal/dsc-hub' },
        { label: 'Travel' },
      ]}
    >
      <section style={S.placeholder}>
        <h2 style={S.title}>Travel Records</h2>
        <p style={S.desc}>
          This module is scheduled for Phase 2. It will track trips, schedules,
          costs (INR/KRW) and route maps.
        </p>
        <ul style={S.list}>
          <li>Trip list with status (planning / ongoing / completed)</li>
          <li>Per-trip schedule editor</li>
          <li>Cost tracker with INR↔KRW conversion (rate 15.5)</li>
          <li>Route map with Google Directions polylines</li>
        </ul>
        <div style={S.badge}>Phase 2 — Not yet implemented</div>
      </section>
    </JeepneyLayout>
  );
}

const S = {
  placeholder: {
    background: '#111827', border: '1px solid #1f2937', borderRadius: 12,
    padding: 18,
  },
  title: { margin: 0, fontSize: 18, fontWeight: 700, color: '#f8fafc' },
  desc: { margin: '8px 0 12px', fontSize: 13, color: '#cbd5e1', lineHeight: 1.5 },
  list: {
    margin: '0 0 16px', paddingLeft: 18,
    fontSize: 13, color: '#94a3b8', lineHeight: 1.7,
  },
  badge: {
    display: 'inline-block', padding: '6px 10px',
    background: '#422006', color: '#fbbf24',
    border: '1px solid #78350f', borderRadius: 6,
    fontSize: 11, fontWeight: 700, letterSpacing: 0.4,
  },
};
