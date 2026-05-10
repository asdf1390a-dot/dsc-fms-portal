// Reads MASTER_LIST_OF_MACHINES Excel and emits 03_seed_assets.sql with
// INSERT statements for the assets table.
//
// Scope (Phase 1): sheets 01-08 (active production) + 11 (idle).
// Skipped (later phases): 09 JIG, 10 MOULD, 11A subset, 12 SALES, 13 DISPOSAL,
// 14 CNC (mostly empty), 15 PALLET (different domain).
//
// Usage:
//   node db/import-assets.mjs <path-to-MASTER_LIST.xls>
//
// Output: db/03_seed_assets.sql

import XLSX from 'xlsx';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

const xlsPath = process.argv[2];
if (!xlsPath) {
  console.error('Usage: node import-assets.mjs <path-to-MASTER_LIST.xls>');
  process.exit(1);
}

const ACTIVE_SHEETS = ['01', '02', '03', '04', '05', '06', '07', '08'];
const IDLE_SHEETS = ['11'];

const wb = XLSX.readFile(xlsPath, { cellDates: true, cellText: false });

const records = [];
const skipped = [];

function parseSheet(name, status) {
  const sh = wb.Sheets[name];
  if (!sh) { console.warn(`(skip) sheet ${name} missing`); return; }
  const rows = XLSX.utils.sheet_to_json(sh, { header: 1, defval: '', raw: false });

  for (const r of rows) {
    const a = String(r[0] || '').trim();      // NO
    const b = String(r[1] || '').trim();      // ASSET CODE CLASSIFICATION
    const c = String(r[2] || '').trim();      // MACHINE ASSET CODE
    const d = String(r[3] || '').trim();      // MACHINE ASSET NUMBER (tag)
    const e = String(r[4] || '').trim();      // SERIAL NO
    const f = String(r[5] || '').trim();      // MACHINE/EQUIPMENT NAME
    const g = String(r[6] || '').trim();      // MAKE for sheet 11; MODEL for 01-08
    const h = String(r[7] || '').trim();      // MAKE for 01-08
    const i = String(r[8] || '').trim();      // LOCATION
    const j = String(r[9] || '').trim();      // REMARK

    // Detect data row: NO numeric, asset_class_code = N.NNN, asset_code = N.NNN.NNN
    if (!/^\d+$/.test(a) || !/^\d+\.\d+[A-Z]?$/.test(b) || !/^\d+\.\d+[A-Z]?\.\d+$/.test(c)) continue;

    // Sheet 11 has slightly different column order: NAME, MAKE, MODEL (vs 01-08: NAME, MODEL, MAKE)
    let model, make;
    if (name === '11' || name === '11A') {
      make = g; model = h;
    } else {
      model = g; make = h;
    }

    // skip rows with no name
    if (!f) { skipped.push({ sheet: name, code: c, reason: 'no name' }); continue; }

    // skip rows with no asset number (tag) — can't have collision-free unique key without it
    if (!d) { skipped.push({ sheet: name, code: c, reason: 'no asset number' }); continue; }

    records.push({
      asset_class_code: b,
      machine_asset_code: c,
      machine_asset_number: d,
      serial_no: e || null,
      name_en: f,
      model: model || null,
      make: (make && make.toUpperCase() !== 'NILL') ? make : null,
      location: i || null,
      remark: j || null,
      status,
      sheet: name,
    });
  }
}

for (const s of ACTIVE_SHEETS) parseSheet(s, 'active');
for (const s of IDLE_SHEETS) parseSheet(s, 'idle');

// De-dupe by machine_asset_number (some rows in idle sheets repeat tags)
const seenTags = new Map();
const final = [];
for (const r of records) {
  const key = r.machine_asset_number;
  if (seenTags.has(key)) {
    skipped.push({ sheet: r.sheet, code: r.machine_asset_code, reason: `dup tag ${key} (kept ${seenTags.get(key)})` });
    continue;
  }
  seenTags.set(key, `${r.sheet}:${r.machine_asset_code}`);
  final.push(r);
}

// SQL builder
const esc = (v) => v == null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`;

let sql = `-- DSC FMS Portal — seed: assets (Phase 1: ~${final.length} records)
-- Source: MASTER_LIST_OF_MACHINES (Excel REV 01)
-- Run AFTER 01_schema.sql and 02_seed_master_codes.sql.
-- Tables: assets

set client_min_messages = warning;

insert into assets (asset_class_code, machine_asset_code, machine_asset_number,
  serial_no, name_en, model, make, location, remark, status) values
`;

const valueRows = final.map(r =>
  `(${esc(r.asset_class_code)}, ${esc(r.machine_asset_code)}, ${esc(r.machine_asset_number)}, ` +
  `${esc(r.serial_no)}, ${esc(r.name_en)}, ${esc(r.model)}, ${esc(r.make)}, ` +
  `${esc(r.location)}, ${esc(r.remark)}, ${esc(r.status)})`
);
sql += valueRows.join(',\n') + `\non conflict (machine_asset_number) do update set\n` +
  `  asset_class_code = excluded.asset_class_code,\n` +
  `  machine_asset_code = excluded.machine_asset_code,\n` +
  `  serial_no = excluded.serial_no,\n` +
  `  name_en = excluded.name_en,\n` +
  `  model = excluded.model,\n` +
  `  make = excluded.make,\n` +
  `  location = excluded.location,\n` +
  `  remark = excluded.remark,\n` +
  `  status = excluded.status;\n`;

const outPath = path.join(path.dirname(new URL(import.meta.url).pathname), '03_seed_assets.sql');
writeFileSync(outPath, sql);

// Summary
const bySheet = {};
for (const r of final) bySheet[r.sheet] = (bySheet[r.sheet] || 0) + 1;
console.log(`✓ Imported records: ${final.length}`);
for (const [s, n] of Object.entries(bySheet).sort()) console.log(`  sheet ${s}: ${n}`);
console.log(`✗ Skipped:          ${skipped.length}`);
const skipReasons = {};
for (const s of skipped) skipReasons[s.reason] = (skipReasons[s.reason] || 0) + 1;
for (const [r, n] of Object.entries(skipReasons)) console.log(`  ${r}: ${n}`);
console.log(`✓ Wrote: ${outPath}`);
