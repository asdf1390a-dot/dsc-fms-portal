'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/i18n/context';
import { t } from '@/lib/i18n/translations';
import { LanguageSelector } from '@/components/LanguageSelector';

type StatsData = {
  total_assets: number;
  by_status: Record<string, number>;
  by_category: Record<string, number>;
  by_class: Record<string, number>;
  top_makes: Array<{ make: string; count: number }>;
  last_updated: string | null;
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-500',
  idle: 'bg-yellow-500',
  maintenance: 'bg-blue-500',
  sold: 'bg-gray-500',
  scrapped: 'bg-red-500',
  unknown: 'bg-purple-500',
};

export default function AssetStatisticsPage() {
  const router = useRouter();
  const { language } = useLanguage();

  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const response = await fetch('/api/assets/statistics');
        const json = await response.json();
        if (!response.ok || !json.success) {
          throw new Error(json.error?.message || 'Failed to load statistics');
        }
        setStats(json.data as StatsData);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load statistics');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const renderBar = (count: number, total: number, color: string) => {
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return (
      <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
        <div
          className={`h-full ${color}`}
          style={{ width: `${pct}%` }}
          aria-label={`${pct}%`}
        />
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8 flex justify-end">
          <LanguageSelector />
        </div>

        <div className="mb-8 flex justify-between items-start gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {t('assets.stats_title', language)}
            </h1>
            <p className="text-gray-600 mt-2">
              {t('assets.stats_subtitle', language)}
            </p>
          </div>
          <button
            onClick={() => router.push('/assets')}
            className="px-4 py-3 bg-gray-200 text-gray-800 rounded-lg font-medium hover:bg-gray-300 transition text-sm"
          >
            {t('common.back', language)}
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-600">{t('assets.loading', language)}</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            {error}
          </div>
        ) : stats ? (
          <>
            {/* Total Card */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6 flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500 mb-1">
                  {t('assets.stats_total', language)}
                </div>
                <div className="text-4xl font-bold text-gray-900">
                  {stats.total_assets.toLocaleString()}
                </div>
              </div>
              {stats.last_updated && (
                <div className="text-right">
                  <div className="text-xs text-gray-500">
                    {t('assets.stats_last_updated', language)}
                  </div>
                  <div className="text-sm text-gray-700">
                    {new Date(stats.last_updated).toLocaleString(
                      language === 'ko' ? 'ko-KR' : 'en-US'
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-6 mb-6">
              {/* By Status */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  {t('assets.stats_by_status', language)}
                </h2>
                <div className="space-y-3">
                  {Object.entries(stats.by_status)
                    .sort((a, b) => b[1] - a[1])
                    .map(([status, count]) => (
                      <div key={status}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium text-gray-700">{status}</span>
                          <span className="text-gray-600">{count}</span>
                        </div>
                        {renderBar(
                          count,
                          stats.total_assets,
                          STATUS_COLORS[status] || 'bg-gray-400'
                        )}
                      </div>
                    ))}
                  {Object.keys(stats.by_status).length === 0 && (
                    <p className="text-sm text-gray-500">No data</p>
                  )}
                </div>
              </div>

              {/* By Category */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  {t('assets.stats_by_category', language)}
                </h2>
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {Object.entries(stats.by_category)
                    .sort((a, b) => b[1] - a[1])
                    .map(([cat, count]) => (
                      <div key={cat}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium text-gray-700">{cat}</span>
                          <span className="text-gray-600">{count}</span>
                        </div>
                        {renderBar(count, stats.total_assets, 'bg-blue-500')}
                      </div>
                    ))}
                  {Object.keys(stats.by_category).length === 0 && (
                    <p className="text-sm text-gray-500">No data</p>
                  )}
                </div>
              </div>
            </div>

            {/* Top Makes */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                {t('assets.stats_top_makes', language)}
              </h2>
              {stats.top_makes.length === 0 ? (
                <p className="text-sm text-gray-500">No data</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">
                          Rank
                        </th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">
                          Make
                        </th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-700">
                          Count
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.top_makes.map((m, i) => (
                        <tr key={m.make} className="border-b border-gray-100">
                          <td className="px-3 py-2 text-gray-700">{i + 1}</td>
                          <td className="px-3 py-2 text-gray-900 font-medium">
                            {m.make}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-700">
                            {m.count}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
