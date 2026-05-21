import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { parseExcelBuffer, REQUIRED_HEADERS, VALID_STATUSES } from '../import-parser.ts';

/**
 * Helper: build an Excel buffer from an array of row objects.
 */
function buildXlsxBuffer(rows: Record<string, any>[]): Buffer {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

test('parses a clean Excel file with all required fields', () => {
  const buf = buildXlsxBuffer([
    {
      asset_class_code: 'CNC',
      machine_asset_number: 'A001',
      name_en: 'CNC Lathe 1',
      location: 'Shop A',
      status: 'active',
    },
  ]);
  const r = parseExcelBuffer(buf);
  assert.equal(r.total_rows, 1);
  assert.equal(r.valid_count, 1);
  assert.equal(r.error_count, 0);
  assert.equal(r.global_errors.length, 0);
});

test('flags missing required headers globally', () => {
  const buf = buildXlsxBuffer([
    { machine_asset_number: 'A001', name_en: 'X', location: 'L', status: 'active' },
  ]);
  const r = parseExcelBuffer(buf);
  assert.ok(r.global_errors.some((e) => e.includes('asset_class_code')));
});

test('flags missing required field per row', () => {
  const buf = buildXlsxBuffer([
    {
      asset_class_code: 'CNC',
      machine_asset_number: 'A001',
      name_en: '',
      location: 'L',
      status: 'active',
    },
  ]);
  const r = parseExcelBuffer(buf);
  assert.equal(r.error_count, 1);
  assert.ok(r.rows[0].errors.some((e) => e.includes('name_en is required')));
});

test('flags invalid status enum', () => {
  const buf = buildXlsxBuffer([
    {
      asset_class_code: 'CNC',
      machine_asset_number: 'A001',
      name_en: 'X',
      location: 'L',
      status: 'broken',
    },
  ]);
  const r = parseExcelBuffer(buf);
  assert.ok(r.rows[0].errors.some((e) => e.includes('Invalid status')));
});

test('accepts all valid statuses', () => {
  for (const s of VALID_STATUSES) {
    const buf = buildXlsxBuffer([
      {
        asset_class_code: 'CNC',
        machine_asset_number: 'A001',
        name_en: 'X',
        location: 'L',
        status: s,
      },
    ]);
    const r = parseExcelBuffer(buf);
    assert.equal(r.error_count, 0, `status "${s}" should be valid`);
  }
});

test('validates year_of_manufacture range', () => {
  const buf = buildXlsxBuffer([
    {
      asset_class_code: 'CNC',
      machine_asset_number: 'A001',
      name_en: 'X',
      location: 'L',
      status: 'active',
      year_of_manufacture: 1900,
    },
  ]);
  const r = parseExcelBuffer(buf);
  assert.ok(r.rows[0].errors.some((e) => e.includes('Invalid year_of_manufacture')));
});

test('accepts year within range', () => {
  const buf = buildXlsxBuffer([
    {
      asset_class_code: 'CNC',
      machine_asset_number: 'A001',
      name_en: 'X',
      location: 'L',
      status: 'active',
      year_of_manufacture: 2020,
    },
  ]);
  const r = parseExcelBuffer(buf);
  assert.equal(r.error_count, 0);
  assert.equal(r.rows[0].data.year_of_manufacture, 2020);
});

test('flags name_en too long', () => {
  const buf = buildXlsxBuffer([
    {
      asset_class_code: 'CNC',
      machine_asset_number: 'A001',
      name_en: 'X'.repeat(101),
      location: 'L',
      status: 'active',
    },
  ]);
  const r = parseExcelBuffer(buf);
  assert.ok(r.rows[0].errors.some((e) => e.includes('name_en too long')));
});

test('flags remark too long', () => {
  const buf = buildXlsxBuffer([
    {
      asset_class_code: 'CNC',
      machine_asset_number: 'A001',
      name_en: 'X',
      location: 'L',
      status: 'active',
      remark: 'a'.repeat(501),
    },
  ]);
  const r = parseExcelBuffer(buf);
  assert.ok(r.rows[0].errors.some((e) => e.includes('remark too long')));
});

test('trims whitespace from string values', () => {
  const buf = buildXlsxBuffer([
    {
      asset_class_code: '  CNC  ',
      machine_asset_number: 'A001',
      name_en: '  Lathe  ',
      location: 'L',
      status: 'active',
    },
  ]);
  const r = parseExcelBuffer(buf);
  assert.equal(r.rows[0].data.asset_class_code, 'CNC');
  assert.equal(r.rows[0].data.name_en, 'Lathe');
});

test('row_number starts at 2 (header row is 1)', () => {
  const buf = buildXlsxBuffer([
    {
      asset_class_code: 'CNC',
      machine_asset_number: 'A001',
      name_en: 'X',
      location: 'L',
      status: 'active',
    },
    {
      asset_class_code: 'CNC',
      machine_asset_number: 'A002',
      name_en: 'Y',
      location: 'L',
      status: 'active',
    },
  ]);
  const r = parseExcelBuffer(buf);
  assert.equal(r.rows[0].row_number, 2);
  assert.equal(r.rows[1].row_number, 3);
});

test('REQUIRED_HEADERS export has 5 fields', () => {
  assert.equal(REQUIRED_HEADERS.length, 5);
  assert.deepEqual(REQUIRED_HEADERS.sort(), [
    'asset_class_code',
    'location',
    'machine_asset_number',
    'name_en',
    'status',
  ]);
});
