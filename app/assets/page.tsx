'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Asset } from '@/lib/assets/types';
import { useLanguage } from '@/lib/i18n/context';
import { t } from '@/lib/i18n/translations';
import { LanguageSelector } from '@/components/LanguageSelector';

export default function AssetsPage() {
  const router = useRouter();
  const { language } = useLanguage();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<'excel' | 'csv' | null>(null);

  useEffect(() => {
    async function loadAssets() {
      try {
        const token = localStorage.getItem('sb-token');
        if (!token) {
          router.push('/auth/login');
          return;
        }

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/assets?order=created_at.desc&limit=100`,
          {
            headers: {
              apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error('Failed to load assets');
        }

        const data = (await response.json()) as Asset[];
        setAssets(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load assets');
      } finally {
        setLoading(false);
      }
    }

    loadAssets();
  }, [router]);

  const handleExport = async (format: 'excel' | 'csv') => {
    try {
      setExporting(format);
      const token = localStorage.getItem('sb-token');
      const endpoint = format === 'excel' ? '/api/assets/export/excel' : '/api/assets/export/csv';

      const response = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      const dateStr = new Date().toISOString().split('T')[0];
      link.download = format === 'excel' ? `assets_${dateStr}.xlsx` : `assets_${dateStr}.csv`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Language Selector */}
        <div className="mb-8 flex justify-end">
          <LanguageSelector />
        </div>

        {/* Header */}
        <div className="mb-12 flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">{t('assets.title', language)}</h1>
            <p className="text-gray-600 mt-2">{t('assets.subtitle', language)}</p>
          </div>
          <div className="flex gap-3">
            {assets.length > 0 && (
              <>
                <button
                  onClick={() => handleExport('excel')}
                  disabled={exporting !== null}
                  className="px-4 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {exporting === 'excel' ? t('assets.exporting', language) : t('assets.excel_download', language)}
                </button>
                <button
                  onClick={() => handleExport('csv')}
                  disabled={exporting !== null}
                  className="px-4 py-3 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {exporting === 'csv' ? t('assets.exporting', language) : t('assets.csv_download', language)}
                </button>
              </>
            )}
            <button
              onClick={() => router.push('/assets/new')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
            >
              {t('assets.add_new', language)}
            </button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-600">{t('assets.loading', language)}</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            {error}
          </div>
        ) : assets.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <p className="text-gray-600 mb-6">{t('assets.no_assets', language)}</p>
            <button
              onClick={() => router.push('/assets/new')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition inline-block"
            >
              {t('assets.register_first', language)}
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('assets.physical_tag', language)}</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('assets.name', language)}</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('assets.location', language)}</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('assets.status', language)}</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('assets.created_date', language)}</th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map((asset) => (
                    <tr
                      key={asset.id}
                      onClick={() => router.push(`/assets/${asset.id}`)}
                      className="border-b border-gray-200 hover:bg-gray-50 transition cursor-pointer"
                    >
                      <td className="px-6 py-3 text-sm font-medium text-gray-900">
                        {asset.machine_asset_number}
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-700">{asset.name_en}</td>
                      <td className="px-6 py-3 text-sm text-gray-700">{asset.location}</td>
                      <td className="px-6 py-3 text-sm">
                        <span
                          className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${
                            asset.status === 'active'
                              ? 'bg-green-100 text-green-800'
                              : asset.status === 'idle'
                              ? 'bg-yellow-100 text-yellow-800'
                              : asset.status === 'maintenance'
                              ? 'bg-blue-100 text-blue-800'
                              : asset.status === 'sold'
                              ? 'bg-gray-100 text-gray-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {asset.status}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-700">
                        {new Date(asset.created_at).toLocaleDateString('ko-KR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
