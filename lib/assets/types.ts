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
  disposal_reason?: string;
  disposal_price?: number;
  buyer_name?: string;
  buyer_contact?: string;
  disposed_at?: string;
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

export interface AssetQRScan {
  id: string;
  asset_id: string;
  qr_payload: string;
  scanned_at: string;
  scanned_by?: string;
  device_info?: string;
  location_gps?: string;
}

export interface ImportBatch {
  batch_id: string;
  file_name: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  total_rows: number;
  inserted: number;
  updated: number;
  failed: number;
  created_at: string;
  created_by?: string;
}

export interface ImportValidationResult {
  file_name: string;
  total_rows: number;
  valid_rows: number;
  errors: Array<{
    row: number;
    field: string;
    value?: any;
    message: string;
  }>;
  preview: Partial<Asset>[];
  validation_summary: {
    ready_to_import: number;
    has_errors: number;
    duplicate_tags: number;
    invalid_class_codes: number;
  };
}

export interface AssetStats {
  total_assets: number;
  by_status: Record<string, number>;
  by_category: Record<string, number>;
  last_updated: string;
}
