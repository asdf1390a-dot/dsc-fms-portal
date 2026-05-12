import dynamic from 'next/dynamic';

const TrendChartInner = dynamic(() => import('./KpiTrendChartInner'), { ssr: false });

export default function KpiTrendChart(props) {
  return <TrendChartInner {...props} />;
}
