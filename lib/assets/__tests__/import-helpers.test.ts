import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_FILE_BYTES,
  ALLOWED_EXTENSIONS,
  VALID_BATCH_STATUSES,
  VALID_ITEM_STATUSES,
  isValidExcelFile,
  normalizePage,
  normalizePerPage,
  isValidUuid,
  analyzeDuplicates,
  deriveBatchStatus,
} from '../import-helpers.ts';

test('MAX_FILE_BYTES is 5MB', () => {
  assert.equal(MAX_FILE_BYTES, 5 * 1024 * 1024);
});

test('ALLOWED_EXTENSIONS contains .xlsx and .xls', () => {
  assert.ok(ALLOWED_EXTENSIONS.includes('.xlsx'));
  assert.ok(ALLOWED_EXTENSIONS.includes('.xls'));
});

test('VALID_BATCH_STATUSES has 4 statuses', () => {
  assert.deepEqual(VALID_BATCH_STATUSES.sort(), ['completed', 'failed', 'pending', 'processing']);
});

test('VALID_ITEM_STATUSES has 5 statuses', () => {
  assert.equal(VALID_ITEM_STATUSES.length, 5);
});

test('isValidExcelFile accepts .xlsx', () => {
  const r = isValidExcelFile({
    name: 'assets.xlsx',
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  assert.equal(r.valid, true);
});

test('isValidExcelFile accepts .xls', () => {
  const r = isValidExcelFile({ name: 'assets.xls', type: 'application/vnd.ms-excel' });
  assert.equal(r.valid, true);
});

test('isValidExcelFile accepts uppercase extension', () => {
  const r = isValidExcelFile({ name: 'ASSETS.XLSX', type: '' });
  assert.equal(r.valid, true);
});

test('isValidExcelFile rejects .csv', () => {
  const r = isValidExcelFile({ name: 'assets.csv', type: 'text/csv' });
  assert.equal(r.valid, false);
  assert.match(r.reason || '', /xlsx or \.xls/);
});

test('isValidExcelFile rejects unknown MIME', () => {
  const r = isValidExcelFile({ name: 'assets.xlsx', type: 'image/png' });
  assert.equal(r.valid, false);
  assert.match(r.reason || '', /Unexpected MIME/);
});

test('isValidExcelFile accepts empty MIME (some clients omit it)', () => {
  const r = isValidExcelFile({ name: 'assets.xlsx', type: '' });
  assert.equal(r.valid, true);
});

test('normalizePage returns default for null/invalid', () => {
  assert.equal(normalizePage(null), 1);
  assert.equal(normalizePage('abc'), 1);
  assert.equal(normalizePage('0'), 1);
  assert.equal(normalizePage('-5'), 1);
});

test('normalizePage parses positive ints', () => {
  assert.equal(normalizePage('3'), 3);
  assert.equal(normalizePage('99'), 99);
});

test('normalizePerPage clamps to max', () => {
  assert.equal(normalizePerPage('500', 20, 100), 100);
  assert.equal(normalizePerPage('300', 50, 200), 200);
});

test('normalizePerPage clamps to min 1', () => {
  assert.equal(normalizePerPage('0', 20, 100), 1);
  assert.equal(normalizePerPage('-3', 20, 100), 1);
});

test('normalizePerPage default for invalid', () => {
  assert.equal(normalizePerPage(null, 25, 100), 25);
  assert.equal(normalizePerPage('abc', 25, 100), 25);
});

test('isValidUuid accepts valid v4', () => {
  assert.equal(isValidUuid('550e8400-e29b-41d4-a716-446655440000'), true);
  assert.equal(isValidUuid('6ba7b810-9dad-11d1-80b4-00c04fd430c8'), true);
});

test('isValidUuid rejects invalid strings', () => {
  assert.equal(isValidUuid(''), false);
  assert.equal(isValidUuid(null), false);
  assert.equal(isValidUuid(undefined), false);
  assert.equal(isValidUuid('not-a-uuid'), false);
  assert.equal(isValidUuid('550e8400-e29b-41d4-a716'), false); // too short
});

test('analyzeDuplicates flags DB duplicates', () => {
  const rows = [
    { row_number: 2, data: { machine_asset_number: 'A001' }, errors: [] },
    { row_number: 3, data: { machine_asset_number: 'A002' }, errors: [] },
  ];
  const existing = new Set(['A001']);
  const r = analyzeDuplicates(rows, existing);
  assert.equal(r.duplicate_in_db, 1);
  assert.equal(r.duplicate_in_file, 0);
  assert.ok(rows[0].errors.some((e) => e.includes('already exists in DB')));
});

test('analyzeDuplicates flags in-file duplicates', () => {
  const rows = [
    { row_number: 2, data: { machine_asset_number: 'A001' }, errors: [] },
    { row_number: 3, data: { machine_asset_number: 'A001' }, errors: [] },
    { row_number: 4, data: { machine_asset_number: 'A002' }, errors: [] },
  ];
  const r = analyzeDuplicates(rows, new Set());
  assert.equal(r.duplicate_in_file, 2);
  assert.equal(r.duplicate_in_db, 0);
});

test('analyzeDuplicates handles rows with no tag', () => {
  const rows = [
    { row_number: 2, data: {}, errors: [] },
    { row_number: 3, data: { machine_asset_number: null }, errors: [] },
  ];
  const r = analyzeDuplicates(rows, new Set());
  assert.equal(r.duplicate_in_file, 0);
  assert.equal(r.duplicate_in_db, 0);
});

test('deriveBatchStatus completed when no failures', () => {
  assert.equal(deriveBatchStatus(10, 0), 'completed');
});

test('deriveBatchStatus failed when all failed', () => {
  assert.equal(deriveBatchStatus(0, 5), 'failed');
});

test('deriveBatchStatus completed for partial success', () => {
  assert.equal(deriveBatchStatus(3, 7), 'completed');
});
