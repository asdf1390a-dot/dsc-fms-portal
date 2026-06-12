'use client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { AssetClass, CreateAssetResponse } from '@/lib/assets/types';

export default function NewAssetPage() {
  const router = useRouter();

  const [assetCode, setAssetCode] = useState(''); // machine_asset_number (physical tag)
  const [assetName, setAssetName] = useState(''); // name_en
  const [assetClassCode, setAssetClassCode] = useState('');
  const [location, setLocation] = useState('');

  const [classes, setClasses] = useState<AssetClass[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('sb-token') : null;
    if (!token) {
      router.push('/auth/login');
      return;
    }
    async function loadClasses() {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/asset_classes?select=code,category_code,name_en,name_ko&order=code.asc`,
          {
            headers: {
              apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
              Authorization: `Bearer ${token}`,
            },
          }
        );
        if (res.ok) {
          const data = (await res.json()) as AssetClass[];
          setClasses(data);
        }
      } catch {
        // silent
      }
    }
    loadClasses();
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const code = assetCode.trim();
    const name = assetName.trim();
    const cls = assetClassCode.trim();
    const loc = location.trim() || 'TBD';

    if (!code || !name || !cls) {
      setError('Asset Code, Asset Name, and Asset Class are required.');
      return;
    }

    try {
      setSubmitting(true);
      const token = localStorage.getItem('sb-token');
      if (!token) {
        router.push('/auth/login');
        return;
      }

      const res = await fetch('/api/assets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          asset_class_code: cls,
          machine_asset_number: code,
          name_en: name,
          location: loc,
          status: 'active',
        }),
      });

      const json = (await res.json()) as CreateAssetResponse;
      if (!res.ok || !json.success) {
        throw new Error(json?.error?.message || `HTTP ${res.status}`);
      }

      router.push('/assets');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create asset');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link href="/assets" className="text-sm text-blue-600 hover:text-blue-800 hover:underline">
            ← Back to Assets
          </Link>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-2">New Asset</h1>
        <p className="text-gray-600 mb-8">Create a new asset record with the minimum required fields.</p>

        <form
          onSubmit={handleSubmit}
          className="bg-white border border-gray-200 rounded-lg p-6 space-y-5"
        >
          <div>
            <label htmlFor="asset_code" className="block text-sm font-medium text-gray-700 mb-1">
              Asset Code (Physical Tag) <span className="text-red-600">*</span>
            </label>
            <input
              id="asset_code"
              type="text"
              required
              value={assetCode}
              onChange={(e) => setAssetCode(e.target.value)}
              placeholder="e.g. DSC-CNC-001"
              className="w-full px-3 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="asset_name" className="block text-sm font-medium text-gray-700 mb-1">
              Asset Name <span className="text-red-600">*</span>
            </label>
            <input
              id="asset_name"
              type="text"
              required
              value={assetName}
              onChange={(e) => setAssetName(e.target.value)}
              placeholder="e.g. CNC Lathe Machine"
              className="w-full px-3 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="asset_class" className="block text-sm font-medium text-gray-700 mb-1">
              Asset Class <span className="text-red-600">*</span>
            </label>
            <select
              id="asset_class"
              required
              value={assetClassCode}
              onChange={(e) => setAssetClassCode(e.target.value)}
              className="w-full px-3 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select asset class...</option>
              {classes.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.name_en}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
              Location
            </label>
            <input
              id="location"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Shop Floor A (default: TBD)"
              className="w-full px-3 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Creating...' : 'Create'}
            </button>
            <Link
              href="/assets"
              className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
