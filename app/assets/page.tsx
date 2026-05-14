'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Asset } from '@/lib/assets/types';

export default function AssetsPage() {
  const router = useRouter();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-12 flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">자산 목록</h1>
            <p className="text-gray-600 mt-2">등록된 모든 자산을 확인하세요</p>
          </div>
          <button
            onClick={() => router.push('/assets/new')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
          >
            + 신규 자산
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-600">로드 중...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            {error}
          </div>
        ) : assets.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <p className="text-gray-600 mb-6">등록된 자산이 없습니다</p>
            <button
              onClick={() => router.push('/assets/new')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition inline-block"
            >
              첫 자산 등록하기
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">물리 태그</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">명칭</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">위치</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">상태</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">생성일</th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map((asset) => (
                    <tr key={asset.id} className="border-b border-gray-200 hover:bg-gray-50 transition">
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
