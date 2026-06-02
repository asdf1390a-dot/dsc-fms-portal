import { expect, test, describe, beforeAll, afterAll } from '@playwright/test';

const API_URL = process.env.API_URL || 'http://localhost:3000';
const TOKEN = process.env.TEST_TOKEN || 'test-token';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { message: string };
}

interface Asset {
  id: string;
  machine_asset_number: string;
  name_en: string;
  name_ta: string;
  asset_class_code: string;
  location: string;
  status: string;
  model: string;
  make: string;
  serial_no: string;
  year_of_manufacture: number;
  qr_payload: string;
  photos: string[];
  created_at: string;
  updated_at: string;
}

interface ImportBatch {
  id: string;
  batch_name: string;
  file_name: string;
  status: 'pending' | 'processing' | 'success' | 'failed' | 'partial';
  total_rows: number;
  successful_rows: number;
  failed_rows: number;
  created_at: string;
}

describe('Asset Master Phase 2 APIs', () => {
  let testAssetId: string;
  let testBatchId: string;

  // Helper: GET request
  async function get<T>(path: string, params?: Record<string, any>): Promise<ApiResponse<T>> {
    const url = new URL(`${API_URL}${path}`);
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) url.searchParams.append(k, String(v));
      });
    }
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${TOKEN}` },
    });
    return res.json();
  }

  // Helper: POST request
  async function post<T>(path: string, body: any): Promise<ApiResponse<T>> {
    const res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`,
      },
      body: JSON.stringify(body),
    });
    return res.json();
  }

  // Helper: PUT request
  async function put<T>(path: string, body: any): Promise<ApiResponse<T>> {
    const res = await fetch(`${API_URL}${path}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`,
      },
      body: JSON.stringify(body),
    });
    return res.json();
  }

  // Helper: DELETE request
  async function del<T>(path: string): Promise<ApiResponse<T>> {
    const res = await fetch(`${API_URL}${path}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${TOKEN}` },
    });
    return res.json();
  }

  describe('Group 1: GET Endpoints (Listing & Details)', () => {
    test('GET /api/assets - List with pagination', async () => {
      const response = await get<Asset[]>('/api/assets', { page: 1, per_page: 10 });
      
      expect(response.success).toBe(true);
      expect(Array.isArray(response.data)).toBe(true);
      expect(response.data!.length).toBeGreaterThan(0);
      
      if (response.data && response.data.length > 0) {
        testAssetId = response.data[0].id;
      }
    });

    test('GET /api/assets - With search parameter', async () => {
      const response = await get<Asset[]>('/api/assets', {
        page: 1,
        per_page: 10,
        q: 'SUB',
      });
      
      expect(response.success).toBe(true);
      expect(Array.isArray(response.data)).toBe(true);
    });

    test('GET /api/assets - With category filter', async () => {
      const response = await get<Asset[]>('/api/assets', {
        page: 1,
        per_page: 10,
        category: '01',
      });
      
      expect(response.success).toBe(true);
    });

    test('GET /api/assets - With status filter', async () => {
      const response = await get<Asset[]>('/api/assets', {
        page: 1,
        per_page: 10,
        status: 'active',
      });
      
      expect(response.success).toBe(true);
    });

    test('GET /api/assets/:id - Detail view', async () => {
      if (!testAssetId) {
        test.skip();
        return;
      }

      const response = await get<Asset>(`/api/assets/${testAssetId}`);
      
      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data!.id).toBe(testAssetId);
    });

    test('GET /api/assets/:id/audit-log - Audit history', async () => {
      if (!testAssetId) {
        test.skip();
        return;
      }

      const response = await get<any[]>(`/api/assets/${testAssetId}/audit-log`);
      
      expect(response.success).toBe(true);
      expect(Array.isArray(response.data)).toBe(true);
    });

    test('GET /api/assets/locations - Location autocomplete', async () => {
      const response = await get<string[]>('/api/assets/locations');
      
      expect(response.success).toBe(true);
      expect(Array.isArray(response.data)).toBe(true);
    });

    test('GET /api/assets/statistics - Stats dashboard', async () => {
      const response = await get<any>('/api/assets/statistics');
      
      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data!.total_assets).toBeGreaterThan(0);
      expect(response.data!.by_status).toBeDefined();
      expect(response.data!.by_category).toBeDefined();
    });
  });

  describe('Group 2: CRUD Operations', () => {
    test('POST /api/assets - Create new asset', async () => {
      const newAsset = {
        machine_asset_number: `TEST-${Date.now()}`,
        name_en: 'Test Asset',
        name_ta: 'சோதனை சম்பத்தி',
        asset_class_code: '02.001',
        location: 'TEST YARD',
        status: 'active',
        model: 'TEST MODEL',
        make: 'TEST MAKE',
        serial_no: `SN-${Date.now()}`,
        year_of_manufacture: 2026,
      };

      const response = await post<Asset>('/api/assets', newAsset);
      
      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data!.id).toBeDefined();
      
      if (response.data) {
        testAssetId = response.data.id;
      }
    });

    test('PUT /api/assets/:id - Update asset', async () => {
      if (!testAssetId) {
        test.skip();
        return;
      }

      const updateData = {
        location: 'NEW LOCATION',
        status: 'maintenance',
      };

      const response = await put<Asset>(`/api/assets/${testAssetId}`, updateData);
      
      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
    });

    test('DELETE /api/assets/:id - Delete asset', async () => {
      if (!testAssetId) {
        test.skip();
        return;
      }

      const response = await del<any>(`/api/assets/${testAssetId}`);
      
      expect(response.success).toBe(true);
    });

    test('PUT /api/assets/batch-update - Batch update', async () => {
      const updateData = {
        asset_ids: [testAssetId],
        updates: {
          location: 'BATCH LOCATION',
        },
      };

      const response = await put<any>('/api/assets/bulk-update', updateData);
      
      expect(response.success).toBe(true);
    });
  });

  describe('Group 3: Import Operations', () => {
    test('GET /api/assets/import/template.xlsx - Download template', async () => {
      const res = await fetch(`${API_URL}/api/assets/import/template`, {
        headers: { 'Authorization': `Bearer ${TOKEN}` },
      });
      
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('spreadsheet');
    });

    test('POST /api/assets/import/preview - Preview Excel', async () => {
      // This would require FormData with file upload
      // Skipping for now - requires Playwright file upload
      test.skip();
    });

    test('GET /api/assets/import/batches - List import batches', async () => {
      const response = await get<ImportBatch[]>('/api/assets/import/batches');
      
      expect(response.success).toBe(true);
      expect(Array.isArray(response.data)).toBe(true);
      
      if (response.data && response.data.length > 0) {
        testBatchId = response.data[0].id;
      }
    });

    test('GET /api/assets/import/batches/:id - Batch detail', async () => {
      if (!testBatchId) {
        test.skip();
        return;
      }

      const response = await get<ImportBatch>(`/api/assets/import/batches/${testBatchId}`);
      
      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
    });
  });

  describe('Group 4: Export & Statistics', () => {
    test('GET /api/assets/export/excel - Export to Excel', async () => {
      const res = await fetch(`${API_URL}/api/assets/export/excel`, {
        headers: { 'Authorization': `Bearer ${TOKEN}` },
      });
      
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('spreadsheet');
    });

    test('GET /api/assets/statistics - Get statistics', async () => {
      const response = await get<any>('/api/assets/statistics');
      
      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
    });
  });

  describe('Performance Tests', () => {
    test('Search performance < 100ms on 500 assets', async () => {
      const startTime = Date.now();
      
      await get<Asset[]>('/api/assets', {
        page: 1,
        per_page: 100,
        q: 'asset',
      });
      
      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeLessThan(100);
    });

    test('List pagination performance < 100ms', async () => {
      const startTime = Date.now();
      
      await get<Asset[]>('/api/assets', {
        page: 1,
        per_page: 50,
      });
      
      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeLessThan(100);
    });

    test('Statistics calculation < 500ms', async () => {
      const startTime = Date.now();
      
      await get<any>('/api/assets/statistics');
      
      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeLessThan(500);
    });
  });

  describe('Error Handling', () => {
    test('404 for non-existent asset', async () => {
      const response = await get<Asset>('/api/assets/nonexistent-id');
      
      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
    });

    test('Invalid pagination parameters', async () => {
      const response = await get<Asset[]>('/api/assets', {
        page: -1,
        per_page: -10,
      });
      
      expect(response.success).toBe(false);
    });

    test('Missing authorization token', async () => {
      const res = await fetch(`${API_URL}/api/assets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('Data Validation', () => {
    test('Search results contain valid asset objects', async () => {
      const response = await get<Asset[]>('/api/assets', { page: 1, per_page: 10 });
      
      if (response.data && response.data.length > 0) {
        const asset = response.data[0];
        
        expect(asset).toHaveProperty('id');
        expect(asset).toHaveProperty('machine_asset_number');
        expect(asset).toHaveProperty('name_en');
        expect(asset).toHaveProperty('status');
        expect(typeof asset.id).toBe('string');
      }
    });

    test('Statistics include all required fields', async () => {
      const response = await get<any>('/api/assets/statistics');
      
      if (response.data) {
        expect(response.data).toHaveProperty('total_assets');
        expect(response.data).toHaveProperty('by_status');
        expect(response.data).toHaveProperty('by_category');
        expect(response.data).toHaveProperty('top_makes');
      }
    });
  });
});
