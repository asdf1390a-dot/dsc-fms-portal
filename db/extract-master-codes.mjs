// Reads the existing MASTER_LIST_OF_MACHINES Excel and extracts:
//   - 15 top-level categories (UTILITY, PROCESS, ...)
//   - asset_classes (sub-categories like '01.001 POWER SUPPLY FACILITY (COMMON)')
// Writes 02_seed_master_codes.sql as Postgres INSERTs.
//
// Usage:
//   node db/extract-master-codes.mjs <path-to-MASTER_LIST.xls>
//
// Output: db/02_seed_master_codes.sql

import XLSX from 'xlsx';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

const xlsPath = process.argv[2];
if (!xlsPath) {
  console.error('Usage: node extract-master-codes.mjs <path-to-MASTER_LIST.xls>');
  process.exit(1);
}

const wb = XLSX.readFile(xlsPath, { cellDates: true, cellText: false });
const sh = wb.Sheets['MACHINE MASTER CODE'];
if (!sh) { console.error('Sheet "MACHINE MASTER CODE" not found'); process.exit(1); }

const rows = XLSX.utils.sheet_to_json(sh, { header: 1, defval: '', raw: false });

// Header row index — find row with "MAJOR CLASIFICATION CODE" in col B
const headerIdx = rows.findIndex(r => String(r[1] || '').toUpperCase().includes('MAJOR CLASIFICATION CODE'));
if (headerIdx < 0) { console.error('Could not locate header row'); process.exit(1); }

const categoriesMap = new Map(); // code -> name_en
const assetClassesMap = new Map(); // code -> { category_code, name_en, expected_qty }

let currentCategoryCode = null;
let currentCategoryName = null;

for (let i = headerIdx + 1; i < rows.length; i++) {
  const r = rows[i];
  const majorCode = String(r[1] || '').trim();
  const majorName = String(r[2] || '').trim();
  const subCode = String(r[4] || '').trim();
  const subName = String(r[5] || '').trim();
  const fullClass = String(r[6] || '').trim();
  const qty = parseInt(String(r[7] || '').trim(), 10);

  if (majorCode && /^\d+[A-Z]?$/.test(majorCode)) {
    currentCategoryCode = majorCode;
    currentCategoryName = majorName.replace(/\s+/g, ' ').trim();
    if (currentCategoryName) categoriesMap.set(currentCategoryCode, currentCategoryName);
  }

  if (fullClass && /^\d+\.\d+[A-Z]?$/.test(fullClass) && subName) {
    assetClassesMap.set(fullClass, {
      category_code: currentCategoryCode || fullClass.split('.')[0],
      name_en: subName.replace(/\s+/g, ' ').trim(),
      expected_qty: Number.isFinite(qty) ? qty : null,
    });
  }
}

// Korean names for major categories (from TITLE sheet hints + standard FMS terms)
const koMap = {
  '01': '유틸리티',
  '02': '프로세스',
  '03': '프레스',
  '04': '로봇',
  '05': '용접기',
  '06': '조립기계',
  '07': 'ETC',
  '08': '레이저',
  '09': '지그',
  '10': '금형',
  '11': '유휴기계',
  '11A': '유휴기계(A)',
  '12': '매각자산',
  '13': '폐기자산',
  '14': 'CNC',
  '15': '팔레트',
};

const sqlEsc = (s) => s == null ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`;

let sql = `-- DSC FMS Portal — seed: categories + asset_classes
-- Generated from MASTER_LIST_OF_MACHINES Excel (source of truth)
-- Run AFTER 01_schema.sql.

set client_min_messages = warning;

-- Categories
insert into categories (code, name_en, name_ko) values\n`;

const catRows = [...categoriesMap.entries()]
  .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
  .map(([code, name]) => `  (${sqlEsc(code)}, ${sqlEsc(name)}, ${sqlEsc(koMap[code] || null)})`);
sql += catRows.join(',\n') + `\non conflict (code) do update set name_en = excluded.name_en, name_ko = excluded.name_ko;\n\n`;

// Asset classes
sql += `-- Asset classes\ninsert into asset_classes (code, category_code, name_en, expected_qty) values\n`;
const acRows = [...assetClassesMap.entries()]
  .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
  .map(([code, v]) => `  (${sqlEsc(code)}, ${sqlEsc(v.category_code)}, ${sqlEsc(v.name_en)}, ${v.expected_qty ?? 'NULL'})`);
sql += acRows.join(',\n') + `\non conflict (code) do update set name_en = excluded.name_en, expected_qty = excluded.expected_qty;\n`;

const outPath = path.join(path.dirname(new URL(import.meta.url).pathname), '02_seed_master_codes.sql');
writeFileSync(outPath, sql);

console.log(`✓ Categories:    ${categoriesMap.size}`);
console.log(`✓ Asset classes: ${assetClassesMap.size}`);
console.log(`✓ Wrote: ${outPath}`);
