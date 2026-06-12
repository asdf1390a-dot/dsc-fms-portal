'use client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import type { Asset } from '@/lib/assets/types';
import type {
  AssetDetails,
  EditHistoryEntry,
  AssetClassInfo,
} from '@/app/api/assets/[assetId]/details/route';
import EditHistoryTimeline from '@/components/assets/EditHistoryTimeline';

function statusBadgeClass(status?: string) {
  switch (status) {
    case 'active':
      return 'bg-green-100 text-green-800';
    case 'idle':
      return 'bg-yellow-100 text-yellow-800';
    case 'maintenance':
      return 'bg-blue-100 text-blue-800';
    case 'sold':
      return 'bg-gray-200 text-gray-800';
    case 'scrapped':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900 break-words">
        {value === null || value === undefined || value === '' ? (
          <span className="text-gray-400">—</span>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

export default function AssetDetailPage() {
  const router = useRouter();
  const params = useParams();
  const assetId = (params?.assetId as string) || '';

  const [asset, setAsset] = useState<Asset | null>(null);
  const [assetClass, setAssetClass] = useState<AssetClassInfo | null>(null);
  const [editHistory, setEditHistory] = useState<EditHistoryEntry[]>([]);
  const [historyAvailable, setHistoryAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'basic' | 'disposal' | 'photos' | 'history'>('basic');

  useEffect(() => {
    if (!assetId) return;
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        const res = await fetch(`/api/assets/${assetId}/details`, {
          cache: 'no-store',
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json?.error?.message || `HTTP ${res.status}`);
        }
        if (cancelled) return;
        const d: AssetDetails = json.data;
        setAsset(d.asset);
        setAssetClass(d.asset_class);
        setEditHistory(d.edit_history);
        setHistoryAvailable(d.edit_history_available);
        setError(null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load asset');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [assetId]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb / back */}
        <div className="mb-6 flex items-center justify-between gap-3 flex-wrap">
          <Link
            href="/assets"
            className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
          >
            ← Back to Assets
          </Link>
          {asset && (
            <div className="flex gap-2">
              <button
                onClick={() => router.push(`/assets/${asset.id}/edit`)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition text-sm"
              >
                Edit
              </button>
            </div>
          )}
        </div>

        {loading && (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-500">
            Loading…
          </div>
        )}

        {!loading && error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
            {error}
          </div>
        )}

        {!loading && !error && asset && (
          <>
            {/* Header */}
            <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                  <p className="text-xs font-mono text-gray-500">
                    {asset.machine_asset_number}
                  </p>
                  <h1 className="text-2xl font-bold text-gray-900 mt-1">
                    {asset.name_en}
                  </h1>
                  {asset.name_ta && (
                    <p className="text-sm text-gray-600 mt-1">{asset.name_ta}</p>
                  )}
                </div>
                <span
                  className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${statusBadgeClass(
                    asset.status
                  )}`}
                >
                  {asset.status}
                </span>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="mb-4 border-b border-gray-200 flex flex-wrap gap-1" role="tablist">
              {(
                [
                  { key: 'basic', label: 'Basic Info' },
                  { key: 'disposal', label: 'Disposal' },
                  { key: 'photos', label: `Photos${asset.photos?.length ? ` (${asset.photos.length})` : ''}` },
                  { key: 'history', label: 'Edit History' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
                    activeTab === tab.key
                      ? 'border-blue-600 text-blue-700'
                      : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Basic info */}
            {activeTab === 'basic' && (
            <section className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic Info</h2>
              <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <Field label="Asset Class" value={
                  assetClass
                    ? `${assetClass.code} — ${assetClass.name_en}`
                    : asset.asset_class_code
                } />
                <Field label="Category" value={assetClass?.category_code} />
                <Field label="Location" value={asset.location} />
                <Field label="Make" value={asset.make} />
                <Field label="Model" value={asset.model} />
                <Field label="Serial No." value={asset.serial_no} />
                <Field label="Year of Manufacture" value={asset.year_of_manufacture} />
                <Field
                  label="Created"
                  value={new Date(asset.created_at).toLocaleString('ko-KR')}
                />
                <Field
                  label="Last Updated"
                  value={new Date(asset.updated_at).toLocaleString('ko-KR')}
                />
              </dl>
              {asset.remark && (
                <div className="mt-6 pt-4 border-t border-gray-100">
                  <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    Remark
                  </dt>
                  <dd className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">
                    {asset.remark}
                  </dd>
                </div>
              )}
            </section>
            )}

            {/* Disposal info (if any) */}
            {activeTab === 'disposal' && (
              (asset.disposed_at || asset.disposal_reason) ? (
              <section className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Disposal</h2>
                <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Field
                    label="Disposed At"
                    value={
                      asset.disposed_at
                        ? new Date(asset.disposed_at).toLocaleString('ko-KR')
                        : null
                    }
                  />
                  <Field label="Reason" value={asset.disposal_reason} />
                  <Field label="Price" value={asset.disposal_price} />
                  <Field label="Buyer" value={asset.buyer_name} />
                  <Field label="Buyer Contact" value={asset.buyer_contact} />
                </dl>
              </section>
              ) : (
                <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6 text-sm text-gray-500">
                  No disposal record.
                </div>
              )
            )}

            {/* Photos */}
            {activeTab === 'photos' && (
              asset.photos && asset.photos.length > 0 ? (
              <section className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Photos ({asset.photos.length})
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {asset.photos.map((url, i) => (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block aspect-square rounded-lg overflow-hidden border border-gray-200 bg-gray-50"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={`Asset photo ${i + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </a>
                  ))}
                </div>
              </section>
              ) : (
                <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6 text-sm text-gray-500">
                  No photos uploaded.
                </div>
              )
            )}

            {/* Edit history timeline */}
            {activeTab === 'history' && (
            <section className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Edit History</h2>
              <EditHistoryTimeline entries={editHistory} available={historyAvailable} />
            </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
