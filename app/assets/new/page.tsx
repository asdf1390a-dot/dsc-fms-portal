'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AssetClass, Category, CreateAssetRequest, CreateAssetResponse } from '@/lib/assets/types';

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

export default function CreateAssetPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [assetClasses, setAssetClasses] = useState<AssetClass[]>([]);
  const [filteredClasses, setFilteredClasses] = useState<AssetClass[]>([]);
  const [showCustomLocation, setShowCustomLocation] = useState(false);
  const [showCustomManufacturer, setShowCustomManufacturer] = useState(false);

  const [formData, setFormData] = useState({
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
      } catch (err) {
        console.error('Failed to load data:', err);
      }
    }

    loadData();
  }, [router]);

  // Category 필터 적용 (asset_class_code 변경 시)
  useEffect(() => {
    if (formData.asset_class_code && assetClasses.length > 0) {
      const selectedClass = assetClasses.find(ac => ac.code === formData.asset_class_code);
      if (selectedClass) {
        const filtered = assetClasses.filter((ac) => ac.category_code === selectedClass.category_code);
        setFilteredClasses(filtered);
      }
    }
  }, [formData.asset_class_code, assetClasses]);

  const handleInputChange = (field: string, value: string | number) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleCategoryChange = (categoryCode: string) => {
    const classesInCategory = assetClasses.filter((ac) => ac.category_code === categoryCode);
    setFilteredClasses(classesInCategory);
    setFormData((prev) => ({
      ...prev,
      asset_class_code: classesInCategory[0]?.code || '',
    }));
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // 클라이언트 검증
    const finalLocation = showCustomLocation ? formData.locationCustom : formData.location;

    if (!formData.asset_class_code || !formData.machine_asset_number || !formData.name_en || !finalLocation || !formData.status) {
      setError('필수 필드를 모두 입력해주세요');
      return;
    }

    if (formData.name_en.length > 100) {
      setError('영문 명칭은 100자 이하여야 합니다');
      return;
    }

    if (formData.remark && formData.remark.length > 500) {
      setError('비고는 500자 이하여야 합니다');
      return;
    }

    if (formData.year_of_manufacture && (parseInt(formData.year_of_manufacture) < 1950 || parseInt(formData.year_of_manufacture) > 2026)) {
      setError('제조년도는 1950~2026 사이여야 합니다');
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

      const payload: CreateAssetRequest = {
        asset_class_code: formData.asset_class_code,
        machine_asset_number: formData.machine_asset_number,
        serial_no: formData.serial_no || undefined,
        name_en: formData.name_en,
        name_ta: formData.name_ta || undefined,
        model: formData.model || undefined,
        make: showCustomManufacturer ? formData.make : (formData.make || undefined),
        year_of_manufacture: formData.year_of_manufacture ? parseInt(formData.year_of_manufacture) : undefined,
        location: showCustomLocation ? formData.locationCustom : formData.location,
        status: formData.status as 'active' | 'idle' | 'maintenance' | 'sold' | 'scrapped',
        remark: formData.remark || undefined,
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

      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || data.message || '자산 생성 실패');
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

        {/* Form Card */}
        <div className="bg-white rounded-lg border border-gray-200 p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Asset Class Selection */}
            <div className="border-b pb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">자산 클래스</h2>

              {/* Category selector */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  카테고리 선택
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {categories.map((cat) => (
                    <button
                      key={cat.code}
                      type="button"
                      onClick={() => handleCategoryChange(cat.code)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                        formData.asset_class_code?.startsWith(cat.code)
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
                <label htmlFor="asset_class_code" className="block text-sm font-medium text-gray-700 mb-3">
                  * 자산 클래스
                </label>
                <select
                  id="asset_class_code"
                  required
                  value={formData.asset_class_code}
                  onChange={(e) => handleInputChange('asset_class_code', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  <label htmlFor="machine_asset_number" className="block text-sm font-medium text-gray-700 mb-2">
                    * 물리 태그 (Unique)
                  </label>
                  <input
                    id="machine_asset_number"
                    type="text"
                    required
                    value={formData.machine_asset_number}
                    onChange={(e) => handleInputChange('machine_asset_number', e.target.value)}
                    placeholder="예: DCMI-UTL-PSF-01"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="mt-1 text-xs text-gray-500">중복될 수 없습니다</p>
                </div>

                {/* English Name */}
                <div>
                  <label htmlFor="name_en" className="block text-sm font-medium text-gray-700 mb-2">
                    * 자산 명칭 (영어)
                  </label>
                  <input
                    id="name_en"
                    type="text"
                    required
                    value={formData.name_en}
                    onChange={(e) => handleInputChange('name_en', e.target.value.substring(0, 100))}
                    placeholder="예: SUB STATION"
                    maxLength={100}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="mt-1 text-xs text-gray-500">{formData.name_en.length}/100</p>
                </div>

                {/* Tamil Name */}
                <div>
                  <label htmlFor="name_ta" className="block text-sm font-medium text-gray-700 mb-2">
                    자산 명칭 (타밀어) [선택]
                  </label>
                  <input
                    id="name_ta"
                    type="text"
                    value={formData.name_ta}
                    onChange={(e) => handleInputChange('name_ta', e.target.value)}
                    placeholder="예: சப் ஸ்டேஷன்"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Serial Number */}
                <div>
                  <label htmlFor="serial_no" className="block text-sm font-medium text-gray-700 mb-2">
                    일련번호 [선택]
                  </label>
                  <input
                    id="serial_no"
                    type="text"
                    value={formData.serial_no}
                    onChange={(e) => handleInputChange('serial_no', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  <label htmlFor="model" className="block text-sm font-medium text-gray-700 mb-2">
                    모델
                  </label>
                  <input
                    id="model"
                    type="text"
                    value={formData.model}
                    onChange={(e) => handleInputChange('model', e.target.value)}
                    placeholder="예: EB - SUB STATION"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Manufacturer */}
                <div>
                  <label htmlFor="make" className="block text-sm font-medium text-gray-700 mb-2">
                    제조사
                  </label>
                  {!showCustomManufacturer ? (
                    <div className="flex gap-2">
                      <select
                        id="make"
                        value={formData.make}
                        onChange={(e) => handleInputChange('make', e.target.value)}
                        className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">선택 또는 입력</option>
                        {PREDEFINED_MANUFACTURERS.map((mfg) => (
                          <option key={mfg} value={mfg}>
                            {mfg}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setShowCustomManufacturer(true)}
                        className="px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition text-sm font-medium"
                      >
                        직접 입력
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={formData.make}
                        onChange={(e) => handleInputChange('make', e.target.value)}
                        placeholder="제조사명 입력"
                        className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setShowCustomManufacturer(false);
                          handleInputChange('make', '');
                        }}
                        className="px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition text-sm font-medium"
                      >
                        목록 선택
                      </button>
                    </div>
                  )}
                </div>

                {/* Year of Manufacture */}
                <div>
                  <label htmlFor="year_of_manufacture" className="block text-sm font-medium text-gray-700 mb-2">
                    제조년도
                  </label>
                  <input
                    id="year_of_manufacture"
                    type="number"
                    value={formData.year_of_manufacture}
                    onChange={(e) => handleInputChange('year_of_manufacture', e.target.value)}
                    placeholder="예: 2015"
                    min="1950"
                    max="2026"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="mt-1 text-xs text-gray-500">1950~2026 범위</p>
                </div>
              </div>
            </div>

            {/* Location & Status */}
            <div className="border-b pb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">위치 & 상태</h2>

              <div className="space-y-6">
                {/* Location */}
                <div>
                  <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-2">
                    * 위치
                  </label>
                  {!showCustomLocation ? (
                    <div className="flex gap-2">
                      <select
                        id="location"
                        value={formData.location}
                        onChange={(e) => handleInputChange('location', e.target.value)}
                        className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">위치 선택</option>
                        {PREDEFINED_LOCATIONS.map((loc) => (
                          <option key={loc} value={loc}>
                            {loc}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setShowCustomLocation(true)}
                        className="px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition text-sm font-medium"
                      >
                        직접 입력
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={formData.locationCustom}
                        onChange={(e) => handleInputChange('locationCustom', e.target.value)}
                        placeholder="위치 입력"
                        className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setShowCustomLocation(false);
                          handleInputChange('locationCustom', '');
                        }}
                        className="px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition text-sm font-medium"
                      >
                        목록 선택
                      </button>
                    </div>
                  )}
                </div>

                {/* Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    * 상태
                  </label>
                  <div className="space-y-2">
                    {STATUS_OPTIONS.map((status) => (
                      <label key={status.value} className="flex items-center">
                        <input
                          type="radio"
                          name="status"
                          value={status.value}
                          checked={formData.status === status.value}
                          onChange={(e) => handleInputChange('status', e.target.value)}
                          className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                        />
                        <span className="ml-3 text-sm font-medium text-gray-700">
                          {status.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="pb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">추가 정보</h2>

              <div>
                <label htmlFor="remark" className="block text-sm font-medium text-gray-700 mb-2">
                  비고 [선택]
                </label>
                <textarea
                  id="remark"
                  value={formData.remark}
                  onChange={(e) => handleInputChange('remark', e.target.value.substring(0, 500))}
                  placeholder="특이사항이나 추가 정보를 입력하세요"
                  maxLength={500}
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
                <p className="mt-1 text-xs text-gray-500">{formData.remark.length}/500</p>
              </div>
            </div>

            {/* Submit Buttons */}
            <div className="flex gap-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
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
        </div>
      </div>
    </div>
  );
}
