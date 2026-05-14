import JeepneyLayout from '../../../components/jeepney/JeepneyLayout';
import DscHubMenu from '../../../components/jeepney/DscHubMenu';

// L2: DSC HUB dashboard.
// Entry point for FMS + Travel + future modules.
export default function DscHubHome() {
  return (
    <JeepneyLayout
      title="DSC HUB"
      level={2}
      backHref="/jeepney-personal"
      backLabel="Personal"
      crumbs={[
        { label: 'Personal', href: '/jeepney-personal' },
        { label: 'DSC HUB' },
      ]}
    >
      <section style={S.hero}>
        <h2 style={S.heroTitle}>DSC HUB</h2>
        <p style={S.heroSub}>Operations modules for Daechang Seat Chennai.</p>
      </section>

      <DscHubMenu />
    </JeepneyLayout>
  );
}

const S = {
  hero: { padding: '8px 4px 16px' },
  heroTitle: { margin: 0, fontSize: 22, fontWeight: 800, color: '#f8fafc' },
  heroSub: { margin: '6px 0 0', fontSize: 13, color: '#94a3b8' },
};
