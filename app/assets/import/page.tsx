'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/i18n/context';
import { t } from '@/lib/i18n/translations';
import { LanguageSelector } from '@/components/LanguageSelector';

type PreviewRow = {
  row_number: number;
  data: Record<string, any>;
  errors: string[];
  status: 'pending' | 'error';
};

type PreviewResponse = {
  success: boolean;
  data?: {
    batch_id: string;
    total_rows: number;
    pending: number;
    error_count: number;
    rows: PreviewRow[];
  };
  error?: { message: string };
};

type ExecuteResponse = {
  success: boolean;
  data?: {
    batch_id: string;
    inserted: number;
    failed: number;
    errors?: Array<{ row: number; error: string }>;
  };
  error?: { message: string };
};

export default function AssetImportPage() {
  const router = useRouter();
  const { language } = useLanguage();

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResponse['data'] | null>(null);
  const [executing, setExecuting] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [result, setResult] = useState<ExecuteResponse['data'] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getToken = () => {
    const token = localStorage.getItem('sb-token');
    if (!token) {
      router.push('/auth/login');
      return null;
    }
    return token;
  };

  const handleTemplateDownload = async () => {
    try {
      const response = await fetch('/api/assets/import/template');
      if (!response.ok) throw new Error('Template download failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'asset_import_template.xlsx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Template download failed');
    }
  };

  const handlePreview = async () => {
    if (!file) return;
    const token = getToken();
    if (!token) return;

    try {
      setPreviewing(true);
      setError(null);
      setResult(null);

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/assets/import/preview', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const json: PreviewResponse = await response.json();
      if (!response.ok || !json.success || !json.data) {
        throw new Error(json.error?.message || 'Preview failed');
      }
      setPreview(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed');
      setPreview(null);
    } finally {
      setPreviewing(false);
    }
  };

  const handleExecute = async () => {
    if (!preview?.batch_id) return;
    const token = getToken();
    if (!token) return;

    if (
      !confirm(
        language === 'ko'
          ? `${preview.pending}개 자산을 등록합니다. 계속할까요?`
          : `Import ${preview.pending} assets. Continue?`
      )
    ) {
      return;
    }

    try {
      setExecuting(true);
      setError(null);

      const response = await fetch('/api/assets/import/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ batch_id: preview.batch_id }),
      });

      const json: ExecuteResponse = await response.json();
      if (!response.ok || !json.success || !json.data) {
        throw new Error(json.error?.message || 'Import failed');
      }
      setResult(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setExecuting(false);
    }
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8 flex justify-end">
          <LanguageSelector />
        </div>

        <div className="mb-8 flex justify-between items-start gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {t('assets.import_title', language)}
            </h1>
            <p className="text-gray-600 mt-2">
              {t('assets.import_subtitle', language)}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleTemplateDownload}
              className="px-4 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition text-sm"
            >
              {t('assets.import_template', language)}
            </button>
            <button
              onClick={() => router.push('/assets')}
              className="px-4 py-3 bg-gray-200 text-gray-800 rounded-lg font-medium hover:bg-gray-300 transition text-sm"
            >
              {t('common.back', language)}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            {error}
          </div>
        )}

        {!result && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {t('assets.import_step1', language)}
            </h2>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => {
                setFile(e.target.files?.[0] || null);
                setPreview(null);
              }}
              className="block w-full text-base text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {file && (
              <div className="mt-3 text-sm text-gray-600">
                {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </div>
            )}
            <div className="mt-4 flex gap-3">
              <button
                onClick={handlePreview}
                disabled={!file || previewing}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {previewing
                  ? t('assets.import_previewing', language)
                  : t('assets.import_preview', language)}
              </button>
            </div>
          </div>
        )}

        {preview && !result && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {t('assets.import_step2', language)}
            </h2>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="text-xs text-gray-500">
                  {t('assets.import_total', language)}
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {preview.total_rows}
                </div>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <div className="text-xs text-green-700">
                  {t('assets.import_pending', language)}
                </div>
                <div className="text-2xl font-bold text-green-900">
                  {preview.pending}
                </div>
              </div>
              <div className="bg-red-50 rounded-lg p-3 text-center">
                <div className="text-xs text-red-700">
                  {t('assets.import_errors', language)}
                </div>
                <div className="text-2xl font-bold text-red-900">
                  {preview.error_count}
                </div>
              </div>
            </div>

            {preview.rows.length > 0 && (
              <div className="overflow-x-auto border border-gray-200 rounded-lg max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">
                        Row
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">
                        Tag
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">
                        Name
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">
                        Class
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row) => (
                      <tr
                        key={row.row_number}
                        className={
                          row.status === 'error'
                            ? 'bg-red-50 border-b border-red-100'
                            : 'border-b border-gray-100'
                        }
                      >
                        <td className="px-3 py-2 text-gray-700">{row.row_number}</td>
                        <td className="px-3 py-2 text-gray-900">
                          {row.data.machine_asset_number || '—'}
                        </td>
                        <td className="px-3 py-2 text-gray-700">
                          {row.data.name_en || '—'}
                        </td>
                        <td className="px-3 py-2 text-gray-700">
                          {row.data.asset_class_code || '—'}
                        </td>
                        <td className="px-3 py-2">
                          {row.status === 'error' ? (
                            <span
                              className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800"
                              title={row.errors.join('; ')}
                            >
                              {row.errors[0] || 'error'}
                            </span>
                          ) : (
                            <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              ok
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-4 flex gap-3">
              <button
                onClick={handleExecute}
                disabled={executing || preview.pending === 0}
                className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {executing
                  ? t('assets.import_executing', language)
                  : `${t('assets.import_execute', language)} (${preview.pending})`}
              </button>
              <button
                onClick={reset}
                disabled={executing}
                className="px-4 py-3 bg-gray-200 text-gray-800 rounded-lg font-medium hover:bg-gray-300 transition disabled:opacity-50"
              >
                {t('common.cancel', language)}
              </button>
            </div>
          </div>
        )}

        {result && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {t('assets.import_step3', language)}
            </h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-green-50 rounded-lg p-4 text-center">
                <div className="text-sm text-green-700">
                  {t('assets.import_inserted', language)}
                </div>
                <div className="text-3xl font-bold text-green-900">
                  {result.inserted}
                </div>
              </div>
              <div className="bg-red-50 rounded-lg p-4 text-center">
                <div className="text-sm text-red-700">
                  {t('assets.import_failed', language)}
                </div>
                <div className="text-3xl font-bold text-red-900">
                  {result.failed}
                </div>
              </div>
            </div>

            {result.errors && result.errors.length > 0 && (
              <div className="mb-4 max-h-48 overflow-y-auto bg-red-50 rounded-lg p-3 text-sm">
                <div className="font-semibold text-red-800 mb-1">Errors</div>
                <ul className="list-disc list-inside text-red-700 space-y-1">
                  {result.errors.slice(0, 20).map((e, i) => (
                    <li key={i}>
                      Row {e.row}: {e.error}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => router.push('/assets')}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
              >
                {t('assets.import_view_assets', language)}
              </button>
              <button
                onClick={reset}
                className="px-4 py-3 bg-gray-200 text-gray-800 rounded-lg font-medium hover:bg-gray-300 transition"
              >
                {t('assets.import_another', language)}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
