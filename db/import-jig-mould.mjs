// Imports JIG (sheet 09) + MOULD (sheet 10) from the master Excel directly into Supabase.
// Uses service_role key to bypass RLS. Stores tooling-specific fields in extra JSONB.
//
// Required env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Usage:
//   node db/import-jig-mould.mjs <path-to-MASTER_LIST.xls>

import XLSX from 'xlsx';

const xlsPath = process.argv[2];
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SR  = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!xlsPath || !URL || !SR) {
  console.error('Need <xls> and env NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const wb = XLSX.readFile(xlsPath, { cellDates: true, cellText: false });

function parseSheet(name, category) {
  const sh = wb.Sheets[name];
  if (!sh) return [];
  const rows = XLSX.utils.sheet_to_json(sh, { header: 1, defval: '', raw: false });
  const out = [];
  for (const r of rows) {
    const a = String(r[0] || '').trim();
    const cls = String(r[1] || '').trim();
    const code = String(r[2] || '').trim();
    const num = String(r[3] || '').trim();
    if (!/^\d+$/.test(a) || !/^\d+\.\d+[A-Z]?$/.test(cls) || !/^\d+\.\d+[A-Z]?\.\d+$/.test(code)) continue;
    if (!num) continue; // need unique tag

    let payload;
    if (category === 'JIG') {
      // [NO, CLS, CODE, NUM, BOOTH_NO, CAR, MODEL, PROCESS, STAGE, PART_NAME, PART_NO, LOCATION, REMARK]
      const booth_no = String(r[4] || '').trim();
      const car = String(r[5] || '').trim();
      const model = String(r[6] || '').trim();
      const process_name = String(r[7] || '').trim();
      const stage = String(r[8] || '').trim();
      const part_name = String(r[9] || '').trim();
      const part_no = String(r[10] || '').trim();
      const location = String(r[11] || '').trim();
      const remark = String(r[12] || '').trim();
      payload = {
        asset_class_code: cls,
        machine_asset_code: code,
        machine_asset_number: num,
        name_en: part_name || `JIG ${num}`,
        model: model || null,
        location: location || null,
        remark: remark || null,
        status: 'active',
        extra: { booth_no, car, process_name, stage, part_no, kind: 'jig' },
      };
    } else { // MOULD
      // [NO, CLS, CODE, NUM, MODEL, PROCESS, PART_NAME, PART_NO, LOCATION, REMARK]
      const model = String(r[4] || '').trim();
      const process_name = String(r[5] || '').trim();
      const part_name = String(r[6] || '').trim();
      const part_no = String(r[7] || '').trim();
      const location = String(r[8] || '').trim();
      const remark = String(r[9] || '').trim();
      payload = {
        asset_class_code: cls,
        machine_asset_code: code,
        machine_asset_number: num,
        name_en: part_name || `MOULD ${num}`,
        model: model || null,
        location: location || null,
        remark: remark || null,
        status: 'active',
        extra: { process_name, part_no, kind: 'mould' },
      };
    }
    out.push(payload);
  }
  return out;
}

const jigRecords = parseSheet('09', 'JIG');
const mouldRecords = parseSheet('10', 'MOULD');
console.log(`Parsed: JIG=${jigRecords.length}, MOULD=${mouldRecords.length}`);

// De-dupe by machine_asset_number (safety)
const seen = new Set();
const all = [];
let dupes = 0;
for (const r of [...jigRecords, ...mouldRecords]) {
  if (seen.has(r.machine_asset_number)) { dupes++; continue; }
  seen.add(r.machine_asset_number);
  all.push(r);
}
console.log(`Final: ${all.length} (dupes skipped: ${dupes})`);

// Bulk insert in batches of 200 with merge-duplicates
const BATCH = 200;
let inserted = 0, failed = 0;
for (let i = 0; i < all.length; i += BATCH) {
  const slice = all.slice(i, i + BATCH);
  const res = await fetch(`${URL}/rest/v1/assets?on_conflict=machine_asset_number`, {
    method: 'POST',
    headers: {
      'apikey': SR,
      'Authorization': `Bearer ${SR}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal,resolution=merge-duplicates',
    },
    body: JSON.stringify(slice),
  });
  if (!res.ok) {
    const txt = await res.text();
    console.error(`Batch ${i}-${i + slice.length}: HTTP ${res.status} ${txt.slice(0, 300)}`);
    failed += slice.length;
  } else {
    inserted += slice.length;
    process.stdout.write(`\r  Inserted ${inserted}/${all.length}…`);
  }
}
console.log(`\nDone. inserted=${inserted}, failed=${failed}`);

// Final count
const cnt = await fetch(`${URL}/rest/v1/assets?select=count`, {
  headers: { 'apikey': SR, 'Authorization': `Bearer ${SR}`, 'Prefer': 'count=exact', 'Range': '0-0' },
});
console.log(`Total assets in DB now: ${cnt.headers.get('content-range')}`);
