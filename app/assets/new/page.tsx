'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AssetClass, Category, CreateAssetRequest, CreateAssetResponse, Asset } from '@/lib/assets/types';

const STATUS_OPTIONS = [
  { value: 'active', label: '🟢 Active (운영 중)', color: 'bg-green-100 text-green-800' },
  { value: 'idle', label: '🟡 Idle (미사용)', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'maintenance', label: '🔧 Maintenance (수리 중)', color: 'bg-blue-100 text-blue-800' },
  { value: 'sold', label: '🚫 Sold (매각)', color: 'bg-gray-100 text-gray-800' },
  { value: 'scrapped', label: '☠️ Scrapped (폐기)', color: 'bg-red-100 text-red-800' },
];

const PREDEFINED_LOCATIONS = [
  'EB YARD',
  'EB PANNEL ROOM',
  'COMPRESSOR ROOM - 01',
  'COMPRESSOR ROOM - 02',
  'COMPRESSOR ROOM - 03',
  'SHOP FLOOR',
  'WORKSHOP',
  'TRANSFORMER YARD',
];

const PREDEFINED_MANUFACTURERS = [
  'TRINITY',
  'SIEMENS',
  'KAESER',
  'KAYSER',
  'SUMMITS',
  'DELAIR',
];

interface FilePreview {
  id: string;
  file: File;
  type: 'photo' | 'proof' | 'invoice';
}

export default function CreateAssetPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialForm = ((searchParams?.get('form') || 'registration') as 'registration' | 'disposal') || 'registration';

  const [formType, setFormType] = useState<'registration' | 'disposal'>(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [assetClasses, setAssetClasses] = useState<AssetClass[]>([]);
  const [filteredClasses, setFilteredClasses] = useState<AssetClass[]>([]);
  const [availableAssets, setAvailableAssets] = useState<Asset[]>([]);
  const [showCustomLocation, setShowCustomLocation] = useState(false);
  const [showCustomManufacturer, setShowCustomManufacturer] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<FilePreview[]>([]);

  // Registration form data
  const [regFormData, setRegFormData] = useState({
    asset_class_code: '',
    machine_asset_number: '',
    serial_no: '',
    name_en: '',
    name_ta: '',
    model: '',
    make: '',
    year_of_manufacture: '',
    location: '',
    locationCustom: '',
    status: 'active',
    remark: '',
  });

  // Disposal form data
  const [dispFormData, setDispFormData] = useState({
    asset_id: '',
    disposal_reason: '',
    disposal_price: '',
    buyer_name: '',
    buyer_contact: '',
    remark: '',
  });

  // 데이터 로드
  useEffect(() => {
    async function loadData() {
      try {
        const token = localStorage.getItem('sb-token');
        if (!token) {
          router.push('/auth/login');
          return;
        }

        // Categories 로드
        const catRes = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/categories?order=display_order.asc`,
          {
            headers: {
              apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
              Authorization: `Bearer ${token}`,
            },
          }
        );
        const cats = (await catRes.json()) as Category[];
        setCategories(cats);

        // Asset Classes 로드
        const classRes = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/asset_classes?order=code.asc&limit=1000`,
          {
            headers: {
              apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
              Authorization: `Bearer ${token}`,
            },
          }
        );
        const classes = (await classRes.json()) as AssetClass[];
        setAssetClasses(classes);

        // Active assets 로드 (매각 양식용)
        const assetRes = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/assets?status=eq.active&order=created_at.desc`,
          {
            headers: {
              apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
              Authorization: `Bearer ${token}`,
            },
          }
        );
        const assets = (await assetRes.json()) as Asset[];
        setAvailableAssets(assets);
      } catch (err) {
        console.error('Failed to load data:', err);
      }
    }

    loadData();
  }, [router]);

  // Category 필터 적용
  useEffect(() => {
    if (regFormData.asset_class_code && assetClasses.length > 0) {
      const selectedClass = assetClasses.find((ac) => ac.code === regFormData.asset_class_code);
      if (selectedClass) {
        const filtered = assetClasses.filter((ac) => ac.category_code === selectedClass.category_code);
        setFilteredClasses(filtered);
      }
    }
  }, [regFormData.asset_class_code, assetClasses]);

  const handleCategoryChange = (categoryCode: string) => {
    const classesInCategory = assetClasses.filter((ac) => ac.category_code === categoryCode);
    setFilteredClasses(classesInCategory);
    setRegFormData((prev) => ({
      ...prev,
      asset_class_code: classesInCategory[0]?.code || '',
    }));
  };

  // Registration form handlers
  const handleRegInputChange = (field: string, value: string | number) => {
    setRegFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Disposal form handlers
  const handleDispInputChange = (field: string, value: string | number) => {
    setDispFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // File upload handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'photo' | 'proof' | 'invoice') => {
    const files = e.target.files;
    if (!files) return;

    const maxFiles = type === 'photo' ? 5 : type === 'proof' ? 3 : 2;
    const currentCount = uploadingFiles.filter((f) => f.type === type).length;

    if (currentCount >= maxFiles) {
      setError(`최대 ${maxFiles}개의 ${type === 'photo' ? '사진' : type === 'proof' ? '증빙서류' : '인보이스'}만 업로드 가능합니다`);
      return;
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 10 * 1024 * 1024) {
        setError('파일 크기는 10MB 이하여야 합니다');
        return;
      }

      const newFile: FilePreview = {
        id: `${Date.now()}_${i}`,
        file,
        type,
      };
      setUploadingFiles((prev) => [...prev, newFile]);
    }
  };

  // Remove file
  const removeFile = (id: string) => {
    setUploadingFiles((prev) => prev.filter((f) => f.id !== id));
  };

  // Registration form submit
  async function handleRegSubmit(e: React.FormEvent) {
    e.preventDefault();

    const finalLocation = showCustomLocation ? regFormData.locationCustom : regFormData.location;

    if (!regFormData.asset_class_code || !regFormData.machine_asset_number || !regFormData.name_en || !finalLocation || !regFormData.status) {
      setError('필수 필드를 모두 입력해주세요');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('sb-token');
      if (!token) {
        router.push('/auth/login');
        return;
      }

      // 자산 생성
      const payload: CreateAssetRequest = {
        asset_class_code: regFormData.asset_class_code,
        machine_asset_number: regFormData.machine_asset_number,
        serial_no: regFormData.serial_no || undefined,
        name_en: regFormData.name_en,
        name_ta: regFormData.name_ta || undefined,
        model: regFormData.model || undefined,
        make: showCustomManufacturer ? regFormData.make : (regFormData.make || undefined),
        year_of_manufacture: regFormData.year_of_manufacture ? parseInt(regFormData.year_of_manufacture) : undefined,
        location: finalLocation,
        status: regFormData.status as 'active' | 'idle' | 'maintenance' | 'sold' | 'scrapped',
        remark: regFormData.remark || undefined,
      };

      const response = await fetch('/api/assets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as CreateAssetResponse;

      if (!response.ok || !data.success || !data.data) {
        throw new Error(data.error?.message || data.message || '자산 생성 실패');
      }

      const assetId = data.data.id;

      // 파일 업로드
      for (const preview of uploadingFiles) {
        const formData = new FormData();
        formData.append('file', preview.file);
        formData.append('document_type', preview.type);

        await fetch(`/api/assets/${assetId}/documents`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: formData,
        });
      }

      router.push('/assets');
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  }

  // Disposal form submit
  async function handleDispSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!dispFormData.asset_id || !dispFormData.disposal_reason) {
      setError('필수 필드를 모두 입력해주세요');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('sb-token');
      if (!token) {
        router.push('/auth/login');
        return;
      }

      // 매각 등록
      const disposeData = {
        disposal_reason: dispFormData.disposal_reason,
        disposal_price: dispFormData.disposal_price ? parseFloat(dispFormData.disposal_price) : undefined,
        buyer_name: dispFormData.buyer_name || undefined,
        buyer_contact: dispFormData.buyer_contact || undefined,
        disposed_at: new Date().toISOString(),
      };

      const response = await fetch(`/api/assets/${dispFormData.asset_id}/dispose`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(disposeData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '매각 등록 실패');
      }

      // 파일 업로드
      for (const preview of uploadingFiles) {
        const formData = new FormData();
        formData.append('file', preview.file);
        formData.append('document_type', preview.type);

        await fetch(`/api/assets/${dispFormData.asset_id}/documents`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: formData,
        });
      }

      router.push('/assets');
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-12">
          <button
            onClick={() => router.back()}
            className="text-blue-600 hover:text-blue-700 font-medium mb-6 flex items-center gap-1"
          >
            ← 뒤로가기
          </button>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">신규 자산 등록</h1>
          <p className="text-gray-600">자산의 기본 정보를 입력해주세요</p>
        </div>

        {/* Tabs */}
        <div className="mb-8 border-b border-gray-200 flex gap-4">
          <button
            onClick={() => setFormType('registration')}
            className={`px-6 py-3 font-medium transition-colors ${
              formType === 'registration'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            등록
          </button>
          <button
            onClick={() => setFormType('disposal')}
            className={`px-6 py-3 font-medium transition-colors ${
              formType === 'disposal'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            매각
          </button>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-lg border border-gray-200 p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Registration Form */}
          {formType === 'registration' && (
            <form onSubmit={handleRegSubmit} className="space-y-8">
              {/* Asset Class Selection */}
              <div className="border-b pb-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">자산 클래스</h2>

                {/* Category selector */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-3">카테고리 선택</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {categories.map((cat) => (
                      <button
                        key={cat.code}
                        type="button"
                        onClick={() => handleCategoryChange(cat.code)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                          regFormData.asset_class_code?.startsWith(cat.code)
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        {cat.name_en}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Asset class selector */}
                <div>
                  <label htmlFor="reg_asset_class_code" className="block text-sm font-medium text-gray-700 mb-3">
                    * 자산 클래스
                  </label>
                  <select
                    id="reg_asset_class_code"
                    required
                    value={regFormData.asset_class_code}
                    onChange={(e) => handleRegInputChange('asset_class_code', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">클래스 선택</option>
                    {filteredClasses.map((ac) => (
                      <option key={ac.code} value={ac.code}>
                        {ac.code} — {ac.name_en}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Asset Identification */}
              <div className="border-b pb-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">자산 식별정보</h2>

                <div className="space-y-6">
                  {/* Physical Tag */}
                  <div>
                    <label htmlFor="reg_machine_asset_number" className="block text-sm font-medium text-gray-700 mb-2">
                      * 물리 태그 (Unique)
                    </label>
                    <input
                      id="reg_machine_asset_number"
                      type="text"
                      required
                      value={regFormData.machine_asset_number}
                      onChange={(e) => handleRegInputChange('machine_asset_number', e.target.value)}
                      placeholder="예: DCMI-UTL-PSF-01"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="mt-1 text-xs text-gray-500">중복될 수 없습니다</p>
                  </div>

                  {/* English Name */}
                  <div>
                    <label htmlFor="reg_name_en" className="block text-sm font-medium text-gray-700 mb-2">
                      * 명칭 (영문)
                    </label>
                    <input
                      id="reg_name_en"
                      type="text"
                      required
                      value={regFormData.name_en}
                      onChange={(e) => handleRegInputChange('name_en', e.target.value)}
                      placeholder="예: Power Supply"
                      maxLength={100}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Tamil Name */}
                  <div>
                    <label htmlFor="reg_name_ta" className="block text-sm font-medium text-gray-700 mb-2">
                      명칭 (타밀어)
                    </label>
                    <input
                      id="reg_name_ta"
                      type="text"
                      value={regFormData.name_ta}
                      onChange={(e) => handleRegInputChange('name_ta', e.target.value)}
                      placeholder="타밀어 명칭 (선택사항)"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Serial Number */}
                  <div>
                    <label htmlFor="reg_serial_no" className="block text-sm font-medium text-gray-700 mb-2">
                      일련번호
                    </label>
                    <input
                      id="reg_serial_no"
                      type="text"
                      value={regFormData.serial_no}
                      onChange={(e) => handleRegInputChange('serial_no', e.target.value)}
                      placeholder="제조사 일련번호"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Specifications */}
              <div className="border-b pb-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">사양</h2>

                <div className="space-y-6">
                  {/* Model */}
                  <div>
                    <label htmlFor="reg_model" className="block text-sm font-medium text-gray-700 mb-2">
                      모델
                    </label>
                    <input
                      id="reg_model"
                      type="text"
                      value={regFormData.model}
                      onChange={(e) => handleRegInputChange('model', e.target.value)}
                      placeholder="제품 모델명"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Manufacturer */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">제조사</label>
                    {!showCustomManufacturer ? (
                      <select
                        value={regFormData.make}
                        onChange={(e) => {
                          if (e.target.value === '_custom') {
                            setShowCustomManufacturer(true);
                          } else {
                            handleRegInputChange('make', e.target.value);
                          }
                        }}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">선택</option>
                        {PREDEFINED_MANUFACTURERS.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                        <option value="_custom">직접 입력</option>
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={regFormData.make}
                        onChange={(e) => handleRegInputChange('make', e.target.value)}
                        onBlur={() => {
                          if (!regFormData.make) setShowCustomManufacturer(false);
                        }}
                        placeholder="제조사명 입력"
                        autoFocus
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    )}
                  </div>

                  {/* Year */}
                  <div>
                    <label htmlFor="reg_year_of_manufacture" className="block text-sm font-medium text-gray-700 mb-2">
                      제조년도
                    </label>
                    <input
                      id="reg_year_of_manufacture"
                      type="number"
                      value={regFormData.year_of_manufacture}
                      onChange={(e) => handleRegInputChange('year_of_manufacture', e.target.value)}
                      placeholder="예: 2020"
                      min="1950"
                      max="2026"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Location & Status */}
              <div className="border-b pb-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">위치 & 상태</h2>

                <div className="space-y-6">
                  {/* Location */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">* 위치</label>
                    {!showCustomLocation ? (
                      <select
                        value={regFormData.location}
                        onChange={(e) => {
                          if (e.target.value === '_custom') {
                            setShowCustomLocation(true);
                          } else {
                            handleRegInputChange('location', e.target.value);
                          }
                        }}
                        required
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">위치 선택</option>
                        {PREDEFINED_LOCATIONS.map((l) => (
                          <option key={l} value={l}>
                            {l}
                          </option>
                        ))}
                        <option value="_custom">직접 입력</option>
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={regFormData.locationCustom}
                        onChange={(e) => handleRegInputChange('locationCustom', e.target.value)}
                        onBlur={() => {
                          if (!regFormData.locationCustom) setShowCustomLocation(false);
                        }}
                        placeholder="위치 입력"
                        autoFocus
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    )}
                  </div>

                  {/* Status */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">* 상태</label>
                    <div className="space-y-2">
                      {STATUS_OPTIONS.map((status) => (
                        <label key={status.value} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="status"
                            value={status.value}
                            checked={regFormData.status === status.value}
                            onChange={(e) => handleRegInputChange('status', e.target.value)}
                            className="w-4 h-4"
                          />
                          <span className="text-sm text-gray-700">{status.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Remark */}
                  <div>
                    <label htmlFor="reg_remark" className="block text-sm font-medium text-gray-700 mb-2">
                      비고
                    </label>
                    <textarea
                      id="reg_remark"
                      value={regFormData.remark}
                      onChange={(e) => handleRegInputChange('remark', e.target.value)}
                      placeholder="추가 정보 (선택사항)"
                      maxLength={500}
                      rows={4}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* File Upload */}
              <div className="border-b pb-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">파일 첨부</h2>

                {/* Photos */}
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">사진 (최대 5개)</h3>
                  <label className="flex items-center justify-center w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 bg-gray-50">
                    <span className="text-sm text-gray-600">📷 파일 선택</span>
                    <input
                      type="file"
                      multiple
                      accept="image/jpeg,image/png"
                      onChange={(e) => handleFileUpload(e, 'photo')}
                      className="hidden"
                    />
                  </label>
                  <div className="mt-3 space-y-2">
                    {uploadingFiles
                      .filter((f) => f.type === 'photo')
                      .map((f) => (
                        <div key={f.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                          <span className="text-sm text-gray-700">✓ {f.file.name}</span>
                          <button
                            type="button"
                            onClick={() => removeFile(f.id)}
                            className="text-red-600 hover:text-red-700 text-sm"
                          >
                            제거
                          </button>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Proofs */}
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">증빙서류 (최대 3개)</h3>
                  <label className="flex items-center justify-center w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 bg-gray-50">
                    <span className="text-sm text-gray-600">📄 파일 선택</span>
                    <input
                      type="file"
                      multiple
                      accept="application/pdf,.doc,.docx"
                      onChange={(e) => handleFileUpload(e, 'proof')}
                      className="hidden"
                    />
                  </label>
                  <div className="mt-3 space-y-2">
                    {uploadingFiles
                      .filter((f) => f.type === 'proof')
                      .map((f) => (
                        <div key={f.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                          <span className="text-sm text-gray-700">✓ {f.file.name}</span>
                          <button
                            type="button"
                            onClick={() => removeFile(f.id)}
                            className="text-red-600 hover:text-red-700 text-sm"
                          >
                            제거
                          </button>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Invoices */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">인보이스 (최대 2개)</h3>
                  <label className="flex items-center justify-center w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 bg-gray-50">
                    <span className="text-sm text-gray-600">📋 파일 선택</span>
                    <input
                      type="file"
                      multiple
                      accept="application/pdf,.doc,.docx"
                      onChange={(e) => handleFileUpload(e, 'invoice')}
                      className="hidden"
                    />
                  </label>
                  <div className="mt-3 space-y-2">
                    {uploadingFiles
                      .filter((f) => f.type === 'invoice')
                      .map((f) => (
                        <div key={f.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                          <span className="text-sm text-gray-700">✓ {f.file.name}</span>
                          <button
                            type="button"
                            onClick={() => removeFile(f.id)}
                            className="text-red-600 hover:text-red-700 text-sm"
                          >
                            제거
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 transition"
                >
                  {loading ? '저장 중...' : '저장'}
                </button>
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition"
                >
                  취소
                </button>
              </div>
            </form>
          )}

          {/* Disposal Form */}
          {formType === 'disposal' && (
            <form onSubmit={handleDispSubmit} className="space-y-8">
              {/* Asset Selection */}
              <div className="border-b pb-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">자산 선택</h2>

                <div className="space-y-6">
                  <div>
                    <label htmlFor="disp_asset_id" className="block text-sm font-medium text-gray-700 mb-2">
                      * 자산 선택
                    </label>
                    <select
                      id="disp_asset_id"
                      required
                      value={dispFormData.asset_id}
                      onChange={(e) => handleDispInputChange('asset_id', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">자산 선택</option>
                      {availableAssets.map((asset) => (
                        <option key={asset.id} value={asset.id}>
                          {asset.machine_asset_number} — {asset.name_en}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Disposal Information */}
              <div className="border-b pb-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">매각 정보</h2>

                <div className="space-y-6">
                  {/* Disposal Reason */}
                  <div>
                    <label htmlFor="disp_reason" className="block text-sm font-medium text-gray-700 mb-2">
                      * 매각 사유
                    </label>
                    <select
                      id="disp_reason"
                      required
                      value={dispFormData.disposal_reason}
                      onChange={(e) => handleDispInputChange('disposal_reason', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">사유 선택</option>
                      <option value="노후화">노후화</option>
                      <option value="폐기">폐기</option>
                      <option value="선물">선물</option>
                      <option value="기타">기타</option>
                    </select>
                  </div>

                  {/* Disposal Price */}
                  <div>
                    <label htmlFor="disp_price" className="block text-sm font-medium text-gray-700 mb-2">
                      매각 가격
                    </label>
                    <input
                      id="disp_price"
                      type="number"
                      value={dispFormData.disposal_price}
                      onChange={(e) => handleDispInputChange('disposal_price', e.target.value)}
                      placeholder="금액"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Buyer Name */}
                  <div>
                    <label htmlFor="disp_buyer_name" className="block text-sm font-medium text-gray-700 mb-2">
                      구매자명
                    </label>
                    <input
                      id="disp_buyer_name"
                      type="text"
                      value={dispFormData.buyer_name}
                      onChange={(e) => handleDispInputChange('buyer_name', e.target.value)}
                      placeholder="구매자 이름"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Buyer Contact */}
                  <div>
                    <label htmlFor="disp_buyer_contact" className="block text-sm font-medium text-gray-700 mb-2">
                      구매자 연락처
                    </label>
                    <input
                      id="disp_buyer_contact"
                      type="text"
                      value={dispFormData.buyer_contact}
                      onChange={(e) => handleDispInputChange('buyer_contact', e.target.value)}
                      placeholder="+91-98765-43210"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Remark */}
                  <div>
                    <label htmlFor="disp_remark" className="block text-sm font-medium text-gray-700 mb-2">
                      비고
                    </label>
                    <textarea
                      id="disp_remark"
                      value={dispFormData.remark}
                      onChange={(e) => handleDispInputChange('remark', e.target.value)}
                      placeholder="추가 정보"
                      rows={4}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* File Upload */}
              <div className="border-b pb-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">증명 자료</h2>

                {/* Proofs */}
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">증빙서류 (최대 5개)</h3>
                  <label className="flex items-center justify-center w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 bg-gray-50">
                    <span className="text-sm text-gray-600">📄 파일 선택</span>
                    <input
                      type="file"
                      multiple
                      accept="application/pdf,.doc,.docx"
                      onChange={(e) => handleFileUpload(e, 'proof')}
                      className="hidden"
                    />
                  </label>
                  <div className="mt-3 space-y-2">
                    {uploadingFiles
                      .filter((f) => f.type === 'proof')
                      .map((f) => (
                        <div key={f.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                          <span className="text-sm text-gray-700">✓ {f.file.name}</span>
                          <button
                            type="button"
                            onClick={() => removeFile(f.id)}
                            className="text-red-600 hover:text-red-700 text-sm"
                          >
                            제거
                          </button>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Invoices */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">인보이스 (최대 2개)</h3>
                  <label className="flex items-center justify-center w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 bg-gray-50">
                    <span className="text-sm text-gray-600">📋 파일 선택</span>
                    <input
                      type="file"
                      multiple
                      accept="application/pdf,.doc,.docx"
                      onChange={(e) => handleFileUpload(e, 'invoice')}
                      className="hidden"
                    />
                  </label>
                  <div className="mt-3 space-y-2">
                    {uploadingFiles
                      .filter((f) => f.type === 'invoice')
                      .map((f) => (
                        <div key={f.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                          <span className="text-sm text-gray-700">✓ {f.file.name}</span>
                          <button
                            type="button"
                            onClick={() => removeFile(f.id)}
                            className="text-red-600 hover:text-red-700 text-sm"
                          >
                            제거
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 transition"
                >
                  {loading ? '저장 중...' : '저장'}
                </button>
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition"
                >
                  취소
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
