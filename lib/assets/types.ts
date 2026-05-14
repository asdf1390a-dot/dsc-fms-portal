export interface Asset {
  id: string;
  asset_class_code: string;
  machine_asset_code: string;
  machine_asset_number: string;
  serial_no?: string;
  name_en: string;
  name_ta?: string;
  model?: string;
  make?: string;
  year_of_manufacture?: number;
  location: string;
  status: 'active' | 'idle' | 'maintenance' | 'sold' | 'scrapped';
  qr_payload?: string;
  photos: string[];
  remark?: string;
  extra?: Record<string, any>;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

export interface AssetClass {
  code: string;
  category_code: string;
  name_en: string;
  name_ko?: string;
  expected_qty?: number;
}

export interface Category {
  code: string;
  name_en: string;
  name_ko?: string;
  display_order: number;
}

export interface CreateAssetRequest {
  asset_class_code: string;
  machine_asset_number: string;
  serial_no?: string;
  name_en: string;
  name_ta?: string;
  model?: string;
  make?: string;
  year_of_manufacture?: number;
  location: string;
  status: 'active' | 'idle' | 'maintenance' | 'sold' | 'scrapped';
  remark?: string;
  photos?: string[];
}

export interface CreateAssetResponse {
  success: boolean;
  data?: Asset;
  error?: {
    message: string;
    field?: string;
  };
  message?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  details?: string;
  message?: string;
}
