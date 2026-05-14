'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Asset } from '@/lib/assets/types';

interface Document {
  id: string;
  asset_id: string;
  document_type: 'photo' | 'proof' | 'invoice' | 'other';
  filename: string;
  file_url: string;
  file_size: number;
  mime_type: string;
  uploaded_at: string;
  uploaded_by: string;
  created_at: string;
}

type TabType = 'info' | 'documents';

export default function AssetDetailPage() {
  const router = useRouter();
  const params = useParams() as { assetId: string };
  const assetId = params?.assetId as string;

  const [asset, setAsset] = useState<Asset | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('info');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    async function loadAsset() {
      try {
        const token = localStorage.getItem('sb-token');
        if (!token) {
          router.push('/auth/login');
          return;
        }

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/assets?id=eq.${assetId}`,
          {
            headers: {
              apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error('Failed to load asset');
        }

        const data = (await response.json()) as Asset[];
        if (data.length === 0) {
          throw new Error('Asset not found');
        }

        setAsset(data[0]);
        await loadDocuments(token);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load asset');
      } finally {
        setLoading(false);
      }
    }

    async function loadDocuments(token: string) {
      try {
        const response = await fetch(`/api/assets/${assetId}/documents`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          if (response.status !== 404) {
            throw new Error('Failed to load documents');
          }
          return;
        }

        const data = (await response.json()) as Document[];
        setDocuments(data);
      } catch (err) {
        console.error('Failed to load documents:', err);
      }
    }

    loadAsset();
  }, [assetId, router]);

  const handleDeleteDocument = async (docId: string) => {
    if (!confirm('파일을 삭제하시겠습니까?')) return;

    setDeleting(docId);
    try {
      const token = localStorage.getItem('sb-token');
      if (!token) {
        router.push('/auth/login');
        return;
      }

      const response = await fetch(
        `/api/assets/${assetId}/documents/${docId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to delete document');
      }

      setDocuments((prev) => prev.filter((doc) => doc.id !== docId));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete document');
    } finally {
      setDeleting(null);
    }
  };

  const handleDownload = (fileUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const documentTypeLabel: Record<string, string> = {
    photo: '사진',
    proof: '증빙서류',
    invoice: '인보이스',
    other: '기타',
  };

  const groupedDocuments = documents.reduce(
    (acc, doc) => {
      if (!acc[doc.document_type]) {
        acc[doc.document_type] = [];
      }
      acc[doc.document_type].push(doc);
      return acc;
    },
    {} as Record<string, Document[]>
  );

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">로드 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => router.back()}
            className="mb-4 px-4 py-2 text-blue-600 hover:text-blue-700 font-medium"
          >
            ← 돌아가기
          </button>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            {error}
          </div>
        </div>
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => router.back()}
            className="mb-4 px-4 py-2 text-blue-600 hover:text-blue-700 font-medium"
          >
            ← 돌아가기
          </button>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-700">
            자산을 찾을 수 없습니다.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <button
          onClick={() => router.back()}
          className="mb-6 px-4 py-2 text-blue-600 hover:text-blue-700 font-medium"
        >
          ← 돌아가기
        </button>

        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {/* Asset Header */}
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 px-6 py-8 border-b border-gray-200">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{asset.name_en}</h1>
                <p className="text-gray-700 mt-2">물리 태그: {asset.machine_asset_number}</p>
              </div>
              <span
                className={`inline-flex px-4 py-2 rounded-full text-sm font-medium ${
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
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('info')}
              className={`flex-1 px-6 py-4 text-center font-medium transition ${
                activeTab === 'info'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-700 hover:text-gray-900'
              }`}
            >
              정보
            </button>
            <button
              onClick={() => setActiveTab('documents')}
              className={`flex-1 px-6 py-4 text-center font-medium transition ${
                activeTab === 'documents'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-700 hover:text-gray-900'
              }`}
            >
              문서
            </button>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'info' ? (
              <div className="space-y-8">
                {/* Basic Info */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">기본 정보</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700">영문명</label>
                      <p className="text-gray-900">{asset.name_en}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">타밀명</label>
                      <p className="text-gray-900">{asset.name_ta || '-'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">자산 분류</label>
                      <p className="text-gray-900">{asset.asset_class_code || '-'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">모델</label>
                      <p className="text-gray-900">{asset.model || '-'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">제조사</label>
                      <p className="text-gray-900">{asset.make || '-'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">제조년도</label>
                      <p className="text-gray-900">{asset.year_of_manufacture || '-'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">시리얼번호</label>
                      <p className="text-gray-900">{asset.serial_no || '-'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">위치</label>
                      <p className="text-gray-900">{asset.location}</p>
                    </div>
                  </div>
                </div>

                {/* Remarks */}
                {asset.remark && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">비고</h3>
                    <p className="text-gray-700 whitespace-pre-wrap">{asset.remark}</p>
                  </div>
                )}

                {/* Disposal Info (if sold) */}
                {asset.status === 'sold' && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">매각 정보</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-700">매각 사유</label>
                        <p className="text-gray-900">{asset.disposal_reason || '-'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700">매각 가격</label>
                        <p className="text-gray-900">
                          {asset.disposal_price ? `₹ ${asset.disposal_price.toLocaleString()}` : '-'}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700">구매자명</label>
                        <p className="text-gray-900">{asset.buyer_name || '-'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700">구매자 연락처</label>
                        <p className="text-gray-900">{asset.buyer_contact || '-'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700">매각 일자</label>
                        <p className="text-gray-900">
                          {asset.disposed_at
                            ? new Date(asset.disposed_at).toLocaleDateString('ko-KR')
                            : '-'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Metadata */}
                <div className="border-t border-gray-200 pt-4 text-sm text-gray-500">
                  <p>생성일: {new Date(asset.created_at).toLocaleString('ko-KR')}</p>
                  {asset.updated_at && (
                    <p>수정일: {new Date(asset.updated_at).toLocaleString('ko-KR')}</p>
                  )}
                </div>
              </div>
            ) : (
              /* Documents Tab */
              <div className="space-y-8">
                {Object.keys(groupedDocuments).length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-600">업로드된 문서가 없습니다</p>
                  </div>
                ) : (
                  Object.entries(groupedDocuments).map(([docType, docs]) => (
                    <div key={docType}>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">
                        {documentTypeLabel[docType]}
                      </h3>
                      <div className="space-y-3">
                        {docs.map((doc) => (
                          <div
                            key={doc.id}
                            className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg p-4"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {doc.filename}
                              </p>
                              <div className="flex items-center gap-4 mt-2 text-xs text-gray-600">
                                <span>{formatFileSize(doc.file_size)}</span>
                                <span>
                                  {new Date(doc.created_at).toLocaleDateString('ko-KR')}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 ml-4">
                              <button
                                onClick={() => handleDownload(doc.file_url, doc.filename)}
                                className="px-4 py-2 text-blue-600 hover:text-blue-700 font-medium text-sm transition"
                              >
                                다운로드
                              </button>
                              <button
                                onClick={() => handleDeleteDocument(doc.id)}
                                disabled={deleting === doc.id}
                                className="px-4 py-2 text-red-600 hover:text-red-700 font-medium text-sm transition disabled:opacity-50"
                              >
                                {deleting === doc.id ? '삭제 중...' : '삭제'}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
