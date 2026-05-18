import * as XLSX from 'xlsx';

export const REQUIRED_HEADERS = [
  'asset_class_code',
  'machine_asset_number',
  'name_en',
  'location',
  'status',
];

export const OPTIONAL_HEADERS = [
  'serial_no',
  'name_ta',
  'model',
  'make',
  'year_of_manufacture',
  'remark',
];

export const ALL_HEADERS = [...REQUIRED_HEADERS, ...OPTIONAL_HEADERS];

export const VALID_STATUSES = ['active', 'idle', 'maintenance', 'sold', 'scrapped'];

export interface ParsedRow {
  row_number: number;
  data: Record<string, any>;
  errors: string[];
}

export interface ParseResult {
  total_rows: number;
  headers: string[];
  rows: ParsedRow[];
  valid_count: number;
  error_count: number;
  global_errors: string[];
}

export function parseExcelBuffer(buffer: Buffer | ArrayBuffer): ParseResult {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, {
    defval: null,
    raw: false,
  });

  const headers = rawRows.length > 0 ? Object.keys(rawRows[0]) : [];
  const global_errors: string[] = [];

  // Validate headers
  for (const h of REQUIRED_HEADERS) {
    if (!headers.includes(h)) {
      global_errors.push(`Missing required column: ${h}`);
    }
  }

  const rows: ParsedRow[] = rawRows.map((raw, idx) => {
    const row_number = idx + 2; // +1 for 0-index, +1 for header row
    const errors: string[] = [];
    const data: Record<string, any> = {};

    for (const h of ALL_HEADERS) {
      let val = raw[h];
      if (typeof val === 'string') val = val.trim();
      if (val === '' || val === undefined) val = null;
      data[h] = val;
    }

    // Required field validation
    for (const h of REQUIRED_HEADERS) {
      if (data[h] == null) errors.push(`${h} is required`);
    }

    // Status enum
    if (data.status && !VALID_STATUSES.includes(data.status)) {
      errors.push(`Invalid status "${data.status}". Allowed: ${VALID_STATUSES.join(', ')}`);
    }

    // Year integer & range
    if (data.year_of_manufacture != null) {
      const y = Number(data.year_of_manufacture);
      if (!Number.isInteger(y) || y < 1950 || y > 2026) {
        errors.push(`Invalid year_of_manufacture: ${data.year_of_manufacture}`);
      } else {
        data.year_of_manufacture = y;
      }
    }

    // Length limits
    if (data.name_en && String(data.name_en).length > 100) {
      errors.push('name_en too long (max 100)');
    }
    if (data.remark && String(data.remark).length > 500) {
      errors.push('remark too long (max 500)');
    }

    return { row_number, data, errors };
  });

  const valid_count = rows.filter((r) => r.errors.length === 0).length;
  const error_count = rows.length - valid_count;

  return {
    total_rows: rows.length,
    headers,
    rows,
    valid_count,
    error_count,
    global_errors,
  };
}
