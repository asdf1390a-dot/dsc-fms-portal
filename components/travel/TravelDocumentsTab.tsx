'use client';

import { useState } from 'react';
import { TravelDocument } from '@/types/travel';
import { supabase } from '@/lib/supabase';

interface Props {
  travelId: string;
  documents: TravelDocument[];
  onRefresh: () => void;
}

export default function TravelDocumentsTab({ travelId, documents: initialDocuments, onRefresh }: Props) {
  const [documents, setDocuments] = useState<TravelDocument[]>(initialDocuments || []);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  async function handleFileUpload(files: File[]) {
    try {
      setUploading(true);
      setUploadError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        throw new Error('Not authenticated');
      }

      for (const file of files) {
        if (file.size > 10 * 1024 * 1024) {
          setUploadError(`파일 크기가 10MB를 초과합니다: ${file.name}`);
          continue;
        }

        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`/api/travels/${travelId}/documents`, {
          method: 'POST',
          headers: {
            'x-user-id': session.user.id,
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
          setUploadError(data.error || `업로드 실패: ${file.name}`);
          continue;
        }
      }

      onRefresh();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : '업로드 중 오류가 발생했습니다');
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteDocument(documentId: string) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`/api/travels/${travelId}/documents`, {
        method: 'DELETE',
        headers: {
          'x-user-id': session.user.id,
          'x-doc-id': documentId,
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Delete failed:', data.error);
        return;
      }

      onRefresh();
    } catch (err) {
      console.error('Delete error:', err);
    }
  }

  function getPublicUrl(filePath: string): string {
    const { data } = supabase.storage.from('travel-documents').getPublicUrl(filePath);
    return data.publicUrl;
  }

  function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function categorizeDocument(fileName: string): string {
    const lowerName = fileName.toLowerCase();
    if (lowerName.includes('visa') || lowerName.includes('passport')) return 'visa';
    if (lowerName.includes('board') || lowerName.includes('boarding')) return 'boarding';
    if (lowerName.includes('hotel') || lowerName.includes('booking')) return 'hotel';
    if (lowerName.includes('receipt') || lowerName.includes('invoice')) return 'receipt';
    return 'other';
  }

  function getCategoryLabel(category: string): string {
    switch (category) {
      case 'visa':
        return '📄 비자 & 여권';
      case 'boarding':
        return '🎫 항공권';
      case 'hotel':
        return '🏨 호텔 확인';
      case 'receipt':
        return '💳 영수증';
      default:
        return '📝 기타 서류';
    }
  }

  const categorizedDocs = documents.reduce((acc, doc) => {
    const category = categorizeDocument(doc.file_name);
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(doc);
    return acc;
  }, {} as Record<string, TravelDocument[]>);

  const totalSize = documents.reduce((sum, doc) => sum + doc.file_size, 0);
  const storageLimit = 100 * 1024 * 1024;
  const storagePercent = (totalSize / storageLimit) * 100;

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    handleFileUpload(files);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      handleFileUpload(files);
    }
  };

  return (
    <div className="space-y-6">
      {/* Storage Info */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-2">
          <p className="text-sm font-medium text-gray-500">저장소</p>
          <p className="text-sm font-semibold text-gray-900">
            {formatFileSize(totalSize)} / {formatFileSize(storageLimit)}
          </p>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all ${
              storagePercent > 80 ? 'bg-red-600' : storagePercent > 50 ? 'bg-yellow-600' : 'bg-blue-600'
            }`}
            style={{ width: `${Math.min(storagePercent, 100)}%` }}
          ></div>
        </div>
      </div>

      {/* Upload Area */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition ${
          dragActive
            ? 'border-blue-600 bg-blue-50'
            : 'border-gray-300 bg-gray-50 hover:border-gray-400'
        }`}
      >
        <div className="text-4xl mb-3">📤</div>
        <p className="font-medium text-gray-900 mb-1">파일 업로드</p>
        <p className="text-sm text-gray-600 mb-4">드래그 앤 드롭 또는 클릭하여 파일 선택</p>
        <label className="inline-block">
          <input
            type="file"
            multiple
            onChange={handleFileInputChange}
            disabled={uploading}
            className="hidden"
          />
          <button
            type="button"
            onClick={(e) => {
              const input = (e.currentTarget as HTMLElement).closest('label')?.querySelector('input') as HTMLInputElement;
              input?.click();
            }}
            disabled={uploading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg transition"
          >
            {uploading ? '업로드 중...' : '파일 선택'}
          </button>
        </label>
      </div>

      {uploadError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {uploadError}
        </div>
      )}

      {/* Documents by Category */}
      {documents.length > 0 ? (
        <div className="space-y-4">
          {['visa', 'boarding', 'hotel', 'receipt', 'other'].map((category) => {
            const categoryDocs = categorizedDocs[category];
            if (!categoryDocs || categoryDocs.length === 0) return null;

            return (
              <div key={category} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                  <h4 className="font-semibold text-gray-900">{getCategoryLabel(category)}</h4>
                </div>
                <div className="divide-y divide-gray-200">
                  {categoryDocs
                    .sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime())
                    .map((doc) => (
                      <div key={doc.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">{doc.file_name}</p>
                          <p className="text-sm text-gray-500">
                            {formatFileSize(doc.file_size)} • {new Date(doc.uploaded_at).toLocaleDateString('ko-KR')}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <a
                            href={getPublicUrl(doc.file_path)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                          >
                            다운로드
                          </a>
                          <button
                            onClick={() => handleDeleteDocument(doc.id)}
                            className="text-red-600 hover:text-red-700 font-medium text-sm"
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          등록된 서류가 없습니다
        </div>
      )}
    </div>
  );
}
