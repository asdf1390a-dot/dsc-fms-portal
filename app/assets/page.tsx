'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Asset } from '@/lib/assets/types';
import { useLanguage } from '@/lib/i18n/context';
import { t } from '@/lib/i18n/translations';
import { LanguageSelector } from '@/components/LanguageSelector';

export default function AssetsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { language } = useLanguage();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<'excel' | 'csv' | null>(null);

  // Pagination + search + filter state (initialized from URL)
  const [currentPage, setCurrentPage] = useState(() => parseInt(searchParams?.get('page') || '1', 10));
  const [perPage, setPerPage] = useState(() => parseInt(searchParams?.get('per_page') || '50', 10));
  const [searchQuery, setSearchQuery] = useState(() => searchParams?.get('q') || '');
  const [filters, setFilters] = useState({
    location: searchParams?.get('location') || '',
    status: searchParams?.get('status') || '',
  });
  // Local input states (debounce-friendly: user types, commits via Enter/blur)
  const [searchInput, setSearchInput] = useState(searchQuery);
  const [locationInput, setLocationInput] = useState(filters.location);

  // Sync state from URL when query params change (e.g. back/forward nav)
  useEffect(() => {
    const page = parseInt(searchParams?.get('page') || '1', 10);
    const pp = parseInt(searchParams?.get('per_page') || '50', 10);
    const q = searchParams?.get('q') || '';
    const loc = searchParams?.get('location') || '';
    const st = searchParams?.get('status') || '';
    setCurrentPage(page);
    setPerPage(pp);
    setSearchQuery(q);
    setSearchInput(q);
    setFilters({ location: loc, status: st });
    setLocationInput(loc);
  }, [searchParams]);

  // Helper: push URL with current params
  const updateUrl = useCallback(
    (next: { page?: number; per_page?: number; q?: string; location?: string; status?: string }) => {
      const params = new URLSearchParams();
      const page = next.page ?? currentPage;
      const pp = next.per_page ?? perPage;
      const q = next.q ?? searchQuery;
      const loc = next.location ?? filters.location;
      const st = next.status ?? filters.status;
      if (page > 1) params.set('page', String(page));
      if (pp !== 50) params.set('per_page', String(pp));
      if (q) params.set('q', q);
      if (loc) params.set('location', loc);
      if (st) params.set('status', st);
      const qs = params.toString();
      router.push(qs ? `/assets?${qs}` : '/assets');
    },
    [currentPage, perPage, searchQuery, filters, router]
  );

  useEffect(() => {
    async function loadAssets() {
      try {
        setLoading(true);
        const token = localStorage.getItem('sb-token');
        if (!token) {
          router.push('/auth/login');
          return;
        }

        const offset = (currentPage - 1) * perPage;
        const qsParts: string[] = [
          `order=created_at.desc`,
          `limit=${perPage}`,
          `offset=${offset}`,
        ];
        if (searchQuery) {
          const safe = searchQuery.replace(/[(),*]/g, '');
          qsParts.push(`or=(machine_asset_number.ilike.*${safe}*,name_en.ilike.*${safe}*)`);
        }
        if (filters.status) {
          qsParts.push(`status=eq.${encodeURIComponent(filters.status)}`);
        }
        if (filters.location) {
          const safeLoc = filters.location.replace(/[(),*]/g, '');
          qsParts.push(`location=ilike.*${safeLoc}*`);
        }

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/assets?${qsParts.join('&')}`,
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
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load assets');
      } finally {
        setLoading(false);
      }
    }

    loadAssets();
  }, [router, currentPage, perPage, searchQuery, filters.status, filters.location]);

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
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => router.push('/assets/statistics')}
              className="px-4 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition text-sm"
            >
              {t('assets.stats_button', language)}
            </button>
            <button
              onClick={() => router.push('/assets/import')}
              className="px-4 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition text-sm"
            >
              {t('assets.import_button', language)}
            </button>
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

        {/* Search + Filter Controls */}
        <div className="mb-6 bg-white rounded-lg border border-gray-200 p-4 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-gray-600 mb-1">Search</label>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setSearchQuery(searchInput);
                  setCurrentPage(1);
                  updateUrl({ q: searchInput, page: 1 });
                }
              }}
              onBlur={() => {
                if (searchInput !== searchQuery) {
                  setSearchQuery(searchInput);
                  setCurrentPage(1);
                  updateUrl({ q: searchInput, page: 1 });
                }
              }}
              placeholder="Search by asset number or name..."
              className="w-full px-3 py-2 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="min-w-[150px]">
            <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => {
                const v = e.target.value;
                setFilters((f) => ({ ...f, status: v }));
                setCurrentPage(1);
                updateUrl({ status: v, page: 1 });
              }}
              className="w-full px-3 py-2 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All statuses</option>
              <option value="active">active</option>
              <option value="idle">idle</option>
              <option value="maintenance">maintenance</option>
              <option value="sold">sold</option>
            </select>
          </div>
          <div className="min-w-[150px]">
            <label className="block text-xs font-medium text-gray-600 mb-1">Location</label>
            <input
              type="text"
              value={locationInput}
              onChange={(e) => setLocationInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setFilters((f) => ({ ...f, location: locationInput }));
                  setCurrentPage(1);
                  updateUrl({ location: locationInput, page: 1 });
                }
              }}
              onBlur={() => {
                if (locationInput !== filters.location) {
                  setFilters((f) => ({ ...f, location: locationInput }));
                  setCurrentPage(1);
                  updateUrl({ location: locationInput, page: 1 });
                }
              }}
              placeholder="Filter by location..."
              className="w-full px-3 py-2 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="min-w-[110px]">
            <label className="block text-xs font-medium text-gray-600 mb-1">Per page</label>
            <select
              value={perPage}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                setPerPage(v);
                setCurrentPage(1);
                updateUrl({ per_page: v, page: 1 });
              }}
              className="w-full px-3 py-2 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
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

        {/* Pagination Controls */}
        {!loading && !error && (
          <div className="mt-6 flex items-center justify-between bg-white rounded-lg border border-gray-200 px-4 py-3">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => {
                const next = Math.max(1, currentPage - 1);
                setCurrentPage(next);
                updateUrl({ page: next });
              }}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-sm text-gray-700">
              Page {currentPage} {assets.length < perPage ? '(last)' : ''}
            </span>
            <button
              type="button"
              disabled={assets.length < perPage}
              onClick={() => {
                const next = currentPage + 1;
                setCurrentPage(next);
                updateUrl({ page: next });
              }}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
